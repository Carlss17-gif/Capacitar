/* ============================================================
   habilidades.js — Evaluación de habilidades prácticas
   Carl's Jr. Capacitación
   
   DEPENDE DE: supabase.js, core.js
   ============================================================ */

let _examenesData   = {};
let _estacionActual = '';
let _nombreEmpleado = '';

window.onload = async () => {
  // Prioridad: ?emp= en URL > sesión empleado > sesión entrenador
  const params   = new URLSearchParams(window.location.search);
  const empParam = params.get('emp');

  const sesionEmp = getSesionEmpleado() || {};
  const sesionEnt = JSON.parse(localStorage.getItem('sesion_entrenador') || '{}');

  _nombreEmpleado = empParam || sesionEmp.nombre || sesionEnt.nombre || '';

  // Mostrar a quién se está evaluando
  const header = document.querySelector('.header h1');
  if (header && _nombreEmpleado) {
    header.textContent = `Evaluación de Habilidades — ${_nombreEmpleado}`;
  }

  try {
    const res = await fetch('habilidades.json');
    _examenesData = await res.json();
    poblarSelector();
  } catch (e) {
    console.error('Error cargando habilidades.json:', e);
    document.getElementById('contenido').innerHTML =
      '<div id="sinSeleccion">Error al cargar habilidades.json.</div>';
  }
};

// ── SELECTOR ──────────────────────────────────────────────────

function poblarSelector() {
  const sel = document.getElementById('selectEstacion');
  sel.innerHTML = '<option value="">— Elige una estación —</option>';

  Object.entries(_examenesData).forEach(([key, val]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = val.area;
    sel.appendChild(opt);
  });

  sel.onchange = () => {
    _estacionActual = sel.value;
    renderHabilidades();
  };
}

// ── RENDER ────────────────────────────────────────────────────

function renderHabilidades() {
  const cont = document.getElementById('contenido');

  if (!_estacionActual) {
    cont.innerHTML = '<div id="sinSeleccion">Selecciona una estación para comenzar.</div>';
    return;
  }

  const examen = _examenesData[_estacionActual];
  let html = `
    <div class="examen-header">
      <h2>${examen.area}</h2>
      <span class="badge-puntaje">Pasar: ${examen.puntaje_aprobar} / ${examen.habilidades.length}</span>
    </div>`;

  examen.habilidades.forEach((hab, i) => {
    html += `
      <div class="habilidad-row" id="row-${i}">
        <div class="habilidad-numero">${i + 1}</div>
        <div class="habilidad-texto">${hab}</div>
        <div class="habilidad-btns">
          <button class="hab-btn" id="btn-cumple-${i}" onclick="seleccionar(${i},'cumple')">✓ Cumple</button>
          <button class="hab-btn" id="btn-mejora-${i}" onclick="seleccionar(${i},'mejora')">✗ Necesita mejorar</button>
        </div>
      </div>`;
  });

  html += `
    <div class="notas-area">
      <label>Plan de acción</label>
      <textarea id="plan-accion" placeholder="Escribe el plan de acción…"></textarea>
    </div>
    <div class="notas-area">
      <label>Comentarios del entrenador</label>
      <textarea id="comentarios" placeholder="Escribe los comentarios…"></textarea>
    </div>
    <button class="btn-resultado" onclick="guardarYMostrarResultado()">Guardar y ver resultado</button>
    <div id="resultado-box" style="display:none;"></div>
    <button class="btn-reiniciar" id="btn-reiniciar" style="display:none;" onclick="renderHabilidades()">Reiniciar evaluación</button>`;

  cont.innerHTML = html;
}

// ── SELECCIÓN CUMPLE / MEJORA ─────────────────────────────────

function seleccionar(i, tipo) {
  const btnC   = document.getElementById(`btn-cumple-${i}`);
  const btnM   = document.getElementById(`btn-mejora-${i}`);
  const row    = document.getElementById(`row-${i}`);
  const eraC   = btnC.classList.contains('cumple-activo');
  const eraM   = btnM.classList.contains('mejora-activo');

  btnC.classList.remove('cumple-activo');
  btnM.classList.remove('mejora-activo');
  row.classList.remove('cumple', 'mejora');

  if (tipo === 'cumple' && !eraC) { btnC.classList.add('cumple-activo'); row.classList.add('cumple'); }
  if (tipo === 'mejora' && !eraM) { btnM.classList.add('mejora-activo'); row.classList.add('mejora'); }
}

// ── GUARDAR ───────────────────────────────────────────────────

async function guardarYMostrarResultado() {
  const examen = _examenesData[_estacionActual];
  let cumple = 0, mejora = 0, sinResp = 0;
  const resultadoHabilidades = [];

  examen.habilidades.forEach((hab, i) => {
    const esCumple = document.getElementById(`btn-cumple-${i}`).classList.contains('cumple-activo');
    const esMejora = document.getElementById(`btn-mejora-${i}`).classList.contains('mejora-activo');
    if (esCumple)       { cumple++;   resultadoHabilidades.push({ habilidad: hab, resultado: 'cumple' }); }
    else if (esMejora)  { mejora++;   resultadoHabilidades.push({ habilidad: hab, resultado: 'mejora' }); }
    else                { sinResp++;  resultadoHabilidades.push({ habilidad: hab, resultado: 'sin_evaluar' }); }
  });

  if (sinResp > 0 && !confirm(`Hay ${sinResp} habilidad(es) sin evaluar. ¿Guardar de todas formas?`)) return;

  const planAccion  = document.getElementById('plan-accion').value;
  const comentarios = document.getElementById('comentarios').value;
  const aprueba     = cumple >= examen.puntaje_aprobar;

  const { error } = await mysupabase.from('resultados_habilidades').insert([{
    nombre:      _nombreEmpleado,
    area:        examen.area,
    habilidades: resultadoHabilidades,
    plan_accion: planAccion,
    comentarios,
    cumple,
    total:       examen.habilidades.length,
    aprobado:    aprueba,
  }]);

  if (error) {
    console.error('Error al guardar:', error);
    alert('Error al guardar. Revisa la consola.');
    return;
  }

  const resDiv = document.getElementById('resultado-box');
  resDiv.innerHTML = `
    <div class="resultado-box">
      <div class="resultado-score">${cumple}<span> / ${examen.habilidades.length}</span></div>
      <div class="resultado-label">habilidades que cumplen con los estándares</div>
      <div class="resultado-estado ${aprueba ? 'aprobado' : 'reprobado'}">
        ${aprueba ? '✓ CERTIFICADO' : '✗ NECESITA MÁS PRÁCTICA'}
      </div>
      <div class="resultado-label" style="margin-top:10px;">
        Necesita mejorar: <strong>${mejora}</strong> &nbsp;|&nbsp; Sin evaluar: <strong>${sinResp}</strong>
      </div>
      <div class="resultado-label" style="margin-top:6px;color:#22c55e;">✓ Guardado correctamente</div>
    </div>`;

  resDiv.style.display = 'block';
  document.getElementById('btn-reiniciar').style.display = 'block';
  resDiv.scrollIntoView({ behavior: 'smooth' });
}
