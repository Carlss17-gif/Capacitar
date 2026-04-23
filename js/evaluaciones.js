/* ============================================================
   evaluaciones.js — Análisis de exámenes por pregunta
   Solo para entrenadores · Carl's Jr.
   
   DEPENDE DE: supabase.js, core.js
   ============================================================ */

let _sesion      = null;
let _todasAreas  = {};     // { claveExamen: [resultados] }
let _examenBase  = null;   // preguntas del examen seleccionado
let _claveActual = null;
let _statsPreg   = [];     // [{ correctas, incorrectas, total, pctCorrectas, pctOpciones[] }]
let _pregActiva  = null;

// Reutiliza el cache de examenes.js si está disponible
let _cacheExamenes = null;
async function cargarExamenesJSON() {
  if (_cacheExamenes) return _cacheExamenes;
  try {
    const res = await fetch('examenes.json');
    _cacheExamenes = await res.json();
  } catch (e) {
    console.warn('No se pudo cargar examenes.json:', e);
    _cacheExamenes = {};
  }
  return _cacheExamenes;
}

document.addEventListener('DOMContentLoaded', async () => {
  _sesion = requireEntrenador();
  await cargarResultados();
});

// ── PASO 1: Cargar resultados del entrenador ──────────────────

async function cargarResultados() {
  const { data: empleados } = await queryEmpleadosPorEntrenador(_sesion, 'nombre');
  const nombres = (empleados || []).map(e => e.nombre);

  let q = mysupabase
    .from('resultados_examen')
    .select('nombre, examen, area, respuestas, correctas, total, fecha')
    .order('fecha', { ascending: false });

  if (nombres.length > 0) q = q.in('nombre', nombres);

  const { data, error } = await q;
  if (error) { console.error('Error evaluaciones:', error); return; }

  if (!data?.length) {
    document.getElementById('totalChip').textContent = 'Sin datos';
    document.getElementById('filtroArea').innerHTML  = '<option value="">Sin resultados aún</option>';
    return;
  }

  document.getElementById('totalChip').textContent = `${data.length} exámenes registrados`;

  // Agrupar por clave de examen
  _todasAreas = {};
  data.forEach(r => {
    const k = r.examen || 'Sin clave';
    if (!_todasAreas[k]) _todasAreas[k] = [];
    _todasAreas[k].push(r);
  });

  const sel = document.getElementById('filtroArea');
  Object.entries(_todasAreas)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([clave, arr]) => {
      const op = document.createElement('option');
      op.value = clave;
      op.textContent = `${arr[0].area || clave} (${arr.length} intentos)`;
      sel.appendChild(op);
    });
}

// ── PASO 2: Seleccionar examen ────────────────────────────────

async function cambiarArea() {
  _claveActual = document.getElementById('filtroArea').value;
  if (!_claveActual) return;

  const resultados = _todasAreas[_claveActual] || [];
  const examenes   = await cargarExamenesJSON();
  _examenBase      = examenes[_claveActual] || null;

  _statsPreg = _examenBase ? calcularStats(resultados) : [];

  mostrarResumen(resultados);
  llenarSelectPreguntas();
  renderListaPreguntas();

  document.getElementById('resumenArea').style.display        = '';
  document.getElementById('listaPreguntasWrap').style.display = '';
  document.getElementById('rowPregunta').style.display        = '';
  document.getElementById('detallePregunta').style.display    = 'none';
}

// ── CALCULAR STATS POR PREGUNTA ───────────────────────────────

function calcularStats(resultados) {
  if (!_examenBase?.preguntas?.length) return [];

  return _examenBase.preguntas.map((preg, i) => {
    let correctas = 0, total = 0;
    const conteo  = preg.opciones ? new Array(preg.opciones.length).fill(0) : [];

    resultados.forEach(r => {
      if (!Array.isArray(r.respuestas)) return;
      const resp = r.respuestas[i];
      if (resp == null) return;
      total++;
      if (preg.tipo === 'opcion') {
        const idx = parseInt(resp);
        if (!isNaN(idx) && conteo[idx] !== undefined) conteo[idx]++;
        if (idx === preg.correcta) correctas++;
      }
    });

    const pct        = total > 0 ? Math.round((correctas / total) * 100) : 0;
    const pctOpciones = conteo.map(c => total > 0 ? Math.round((c / total) * 100) : 0);
    return { correctas, incorrectas: total - correctas, total, pctCorrectas: pct, pctOpciones, conteoOpciones: conteo };
  });
}

// ── RESUMEN ───────────────────────────────────────────────────

function mostrarResumen(resultados) {
  const intentos  = resultados.length;
  const empleados = new Set(resultados.map(r => r.nombre)).size;
  const prom      = intentos
    ? Math.round(resultados.reduce((s, r) => s + (r.correctas / (r.total || 1)) * 100, 0) / intentos)
    : 0;

  let peorIdx = -1, peorPct = 101;
  _statsPreg.forEach((s, i) => {
    if (s.total > 0 && s.pctCorrectas < peorPct) { peorPct = s.pctCorrectas; peorIdx = i; }
  });

  document.getElementById('resIntentos').textContent  = intentos;
  document.getElementById('resEmpleados').textContent = empleados;
  document.getElementById('resProm').textContent      = prom + '%';
  document.getElementById('resPeor').textContent      = peorIdx >= 0 ? `P${peorIdx + 1} (${peorPct}%)` : '—';
}

// ── LISTA DE PREGUNTAS ────────────────────────────────────────

function llenarSelectPreguntas() {
  const sel = document.getElementById('filtroPregunta');
  sel.innerHTML = '<option value="">— Ver todas las preguntas —</option>';
  if (!_examenBase?.preguntas) return;

  _examenBase.preguntas.forEach((p, i) => {
    const pct = _statsPreg[i]?.pctCorrectas ?? 0;
    const op  = document.createElement('option');
    op.value = i;
    op.textContent = `P${i + 1}: ${cortar(p.texto, 55)} (${pct}% aciertos)`;
    sel.appendChild(op);
  });
}

function renderListaPreguntas() {
  const cont = document.getElementById('listaPreguntas');
  cont.innerHTML = '';

  if (!_examenBase?.preguntas?.length) {
    cont.innerHTML = '<p style="padding:14px 16px;color:var(--muted);font-size:13px">No hay preguntas base en examenes.json para este examen.</p>';
    return;
  }

  _examenBase.preguntas.forEach((preg, i) => {
    const stat = _statsPreg[i] || { pctCorrectas: 0, total: 0 };
    const pct  = stat.pctCorrectas;
    const cls  = pct >= 70 ? 'pr-alto' : pct >= 40 ? 'pr-medio' : 'pr-bajo';

    const div = document.createElement('div');
    div.className    = `preg-row ${cls}`;
    div.dataset.idx  = i;
    div.innerHTML = `
      <div class="pr-num">${i + 1}</div>
      <div class="pr-texto">${cortar(preg.texto, 80)}</div>
      <div class="pr-barra-wrap">
        <div class="pr-pct">${pct}%</div>
        <div class="pr-track"><div class="pr-fill" style="width:${pct}%"></div></div>
      </div>`;
    div.addEventListener('click', () => {
      document.getElementById('filtroPregunta').value = i;
      cambiarPregunta();
    });
    cont.appendChild(div);
  });
}

// ── DETALLE DE PREGUNTA ───────────────────────────────────────

function cambiarPregunta() {
  const val = document.getElementById('filtroPregunta').value;
  if (val === '') {
    document.getElementById('detallePregunta').style.display = 'none';
    document.querySelectorAll('.preg-row').forEach(r => r.classList.remove('activa'));
    return;
  }

  _pregActiva = parseInt(val);
  const preg  = _examenBase.preguntas[_pregActiva];
  const stat  = _statsPreg[_pregActiva] || { correctas: 0, incorrectas: 0, total: 0, pctCorrectas: 0, pctOpciones: [] };

  document.getElementById('dpNumero').textContent = `Pregunta ${_pregActiva + 1} de ${_examenBase.preguntas.length}`;
  document.getElementById('dpTexto').textContent  = preg.texto;

  const pctC = stat.total ? Math.round((stat.correctas   / stat.total) * 100) : 0;
  const pctI = stat.total ? Math.round((stat.incorrectas  / stat.total) * 100) : 0;
  document.getElementById('psCorrectas').textContent   = `${pctC}% (${stat.correctas})`;
  document.getElementById('psIncorrectas').textContent = `${pctI}% (${stat.incorrectas})`;
  document.getElementById('psTotal').textContent       = stat.total;

  dibujarPastelEval(stat.correctas, stat.incorrectas, stat.total);
  renderOpciones(preg, stat);

  document.querySelectorAll('.preg-row').forEach(r =>
    r.classList.toggle('activa', parseInt(r.dataset.idx) === _pregActiva)
  );
  document.getElementById('detallePregunta').style.display = '';
  document.getElementById('detallePregunta').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderOpciones(preg, stat) {
  const cont = document.getElementById('opcionesDetalle');
  if (!preg.opciones?.length) { cont.innerHTML = ''; return; }

  cont.innerHTML = preg.opciones.map((texto, i) => {
    const esCorrecta = i === preg.correcta;
    const pct        = stat.pctOpciones[i] ?? 0;
    const count      = stat.conteoOpciones?.[i] ?? 0;
    return `
      <div class="opcion-row ${esCorrecta ? 'opcion-correcta' : ''}">
        <div class="op-texto">
          <span>${String.fromCharCode(65 + i)}. ${texto}</span>
          ${esCorrecta ? '<span class="op-correcta-badge">✓ Correcta</span>' : ''}
        </div>
        <div class="op-barra-row">
          <div class="op-track"><div class="op-fill" style="width:${pct}%"></div></div>
          <span class="op-pct">${pct}% (${count})</span>
        </div>
      </div>`;
  }).join('');
}

function dibujarPastelEval(correctas, incorrectas, total) {
  const canvas = document.getElementById('canvasPastel');
  const ctx    = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (total === 0) {
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#666'; ctx.font = '13px DM Sans,Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Sin datos', w / 2, h / 2);
    return;
  }

  const cx = w / 2, cy = h / 2, r = w / 2 - 5;
  [[correctas, '#4caf50'], [incorrectas, '#f44336']].reduce((start, [v, color]) => {
    if (!v) return start;
    const end = start + (v / total) * Math.PI * 2;
    const mid = start + (end - start) / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px DM Sans,Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round((v / total) * 100)}%`,
      cx + r * 0.6 * Math.cos(mid), cy + r * 0.6 * Math.sin(mid));
    return end;
  }, -Math.PI / 2);
}
