

let ROL        = null;
let SESION     = null;
let EMPLEADO   = null;
let CRONO      = [];
let VISTA      = 'grid';
let DIA_PANEL  = null;
let DIA_EDITOR = null;
let ASIG_ED    = [];

// Mapa: módulo → id de examen en examenes.json
const EVAL_EXAM_MAP = {
  'Feeder':       'Feeder',
  'Super Star':   'Feeder',
  'freidor':      'Freír',
  'tenders':      'Tenders',
  'hamburguesas': 'Cocinero',
  'coccion':      'Cocinero',
  'mostrador':    'Comedor',
  'quejas':       'Comedor',
  'datos':        'Cajero',
  'autoservicio': 'AutoServicio',
  'delivery':     'uber',
  'lavado':       'SeguridadAlimentaria',
  'limpieza':     'SeguridadAlimentaria',
  'enfermedades': 'SeguridadAlimentaria',
  'alergenos':    'SeguridadAlimentaria',
};

function getExamenId(item) {
  if (!/evaluaci[oó]n/i.test(item.titulo) && !/certificaci[oó]n/i.test(item.titulo)) return null;
  for (const mod of item.modulos) {
    if (EVAL_EXAM_MAP[mod]) return EVAL_EXAM_MAP[mod];
  }
  return null;
}

function irExamenOEstudio(item) {
  const examId = getExamenId(item);
  const back   = encodeURIComponent(window.location.href);
  if (examId) {
    const nom = encodeURIComponent(EMPLEADO?.nombre || '');
    window.location.href = `examen.html?id=${encodeURIComponent(examId)}&nom=${nom}&back=${back}`;
  } else {
    window.location.href = `area-estudio.html?dia=${item.posicion}&back=${back}`;
  }
}

// Determina la columna star a partir de los módulos del día (más preciso que solo categoría)
function getStarColPorItem(item) {
  const mods = item.modulos || [];
  if (mods.includes('freidor'))                                    return 'fry';
  if (mods.includes('Feeder') && item.categoria !== 'onboarding') return 'feeder';
  if (mods.includes('tenders'))                                    return 'tenders';
  if (mods.includes('autoservicio') || mods.includes('delivery'))  return 'drive_thru';
  if (mods.includes('datos'))                                      return 'cajero';
  if (mods.includes('mostrador'))                                  return 'comedor';
  const catMap = {
    onboarding: 'onboarding',
    tenders:    'tenders',
    cocina:     'cocina',
    frontline:  'comedor',
  };
  return catMap[item.categoria] || null;
}

document.addEventListener('DOMContentLoaded', async () => {
  mostrarFechaHoy('fechaHoy');
  detectarRol();
  if (!ROL) { window.location.href = 'index.html'; return; }

  if (ROL === 'entrenador') {
    document.getElementById('selectorEnt').classList.remove('hidden');
    await cargarSelectorEmpleados();
  } else {
    document.getElementById('infoEmpleado').classList.remove('hidden');
    await iniciarModoEmpleado();
  }
});

function detectarRol() {
  const sesEnt = localStorage.getItem('sesion_entrenador');
  const sesEmp = localStorage.getItem('empleado');
  const modo   = new URLSearchParams(window.location.search).get('modo');
  if (sesEnt && modo !== 'empleado') {
    ROL = 'entrenador'; SESION = JSON.parse(sesEnt);
    document.getElementById('rolBadge').textContent = '🎓 Entrenador';
  } else if (sesEnt) {
    ROL = 'empleado'; SESION = JSON.parse(sesEnt);
    document.getElementById('rolBadge').textContent = '👤 Mi capacitación';
  } else if (sesEmp) {
    ROL = 'empleado'; SESION = JSON.parse(sesEmp);
    document.getElementById('rolBadge').textContent = '👤 Empleado';
  }
}

async function iniciarModoEmpleado() {
  const { data } = await mysupabase
    .from('empleados')
    .select('id, nombre, fecha_ingreso, entrenador, sucursal, cronograma')
    .eq('nombre', SESION.nombre).limit(1).single();
  EMPLEADO = data || { id: null, nombre: SESION.nombre, fecha_ingreso: null, sucursal: SESION.sucursal, cronograma: null };
  document.getElementById('empAvatar').textContent  = EMPLEADO.nombre.charAt(0).toUpperCase();
  document.getElementById('empNombre').textContent  = EMPLEADO.nombre;
  document.getElementById('empIngreso').textContent = EMPLEADO.fecha_ingreso
    ? 'Ingreso: ' + formatFecha(EMPLEADO.fecha_ingreso) : 'Empleado activo';
  window.MES_ACTUAL = null;
  await actualizarCrono();
  renderVista();
}

async function cargarSelectorEmpleados() {
  const { data } = await queryEmpleadosPorEntrenador(SESION, 'id, nombre, fecha_ingreso, sucursal, cronograma');
  const sel = document.getElementById('empleadoSel');
  (data || []).forEach(e => {
    const op = document.createElement('option');
    op.value = e.id; op.textContent = e.nombre;
    op.dataset.nombre = e.nombre; op.dataset.ingreso = e.fecha_ingreso || '';
    op.dataset.sucursal = e.sucursal || '';
    op.dataset.cronograma = JSON.stringify(e.cronograma || null);
    sel.appendChild(op);
  });
  sel.addEventListener('change', async () => {
    if (!sel.value) { limpiarVista(); return; }
    const op = sel.options[sel.selectedIndex];
    EMPLEADO = { id: op.value, nombre: op.dataset.nombre,
      fecha_ingreso: op.dataset.ingreso || null, sucursal: op.dataset.sucursal,
      cronograma: JSON.parse(op.dataset.cronograma) };
    document.getElementById('progBarWrap').style.display = '';
    window.MES_ACTUAL = null;
    await actualizarCrono(); renderVista();
  });
}

async function actualizarCrono() {
  if (!EMPLEADO?.id) { CRONO = []; return; }
  CRONO = await construirCronograma(EMPLEADO.id, EMPLEADO.cronograma);
  const { completados, total, pct } = calcularProgreso(CRONO);
  document.getElementById('progBarWrap').style.display = '';
  document.getElementById('progNum').textContent = `${completados} / ${total}`;
  document.getElementById('progFill').style.width = `${pct}%`;
}

function setVista(vista, el) {
  VISTA = vista;
  document.querySelectorAll('.vtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('vistaGrid').classList.toggle('hidden', vista !== 'grid');
  document.getElementById('vistaCal').classList.toggle('hidden',  vista !== 'cal');
  renderVista();
}

function renderVista() { VISTA === 'grid' ? renderGrid() : renderCalendario(); }

// ── VISTA GRID: BOTONES REALES ────────────────────────────────

function renderGrid() {
  const grid = document.getElementById('vistaGrid');
  if (!EMPLEADO || !CRONO.length) { limpiarVista(); return; }
  const wrapR = document.getElementById('wrapReorganizar');
  if (wrapR) wrapR.style.display = ROL === 'entrenador' ? '' : 'none';
  grid.innerHTML = '';

  CRONO.forEach(item => {
    const esDesc  = item.categoria === 'descanso';
    const done    = item.completado;
    const modInfo = MAP_MODULOS[item.modulos[0]];
    const color   = modInfo ? CAT_COLOR[modInfo.cat] : '#666';

    const wrap = document.createElement('div');
    wrap.className   = 'day-wrap';

    // Botón principal
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = ['day-btn', done && 'done', esDesc && 'descanso'].filter(Boolean).join(' ');
    btn.style.cssText = `--day-color:${color}`;

    // Etiqueta de fase encima
    const faseLabel = esDesc ? '' : _getFaseLabel(item.titulo);

    btn.innerHTML = `
      <div class="day-btn-header">
        <span class="day-num-circle">${item.posicion}</span>
        ${done ? '<span class="done-star">★</span>' : ''}
        ${faseLabel ? `<span class="fase-tag">${faseLabel}</span>` : ''}
      </div>
      <div class="day-icon-big">${item.icono}</div>
      <div class="day-title">${cortar(item.titulo, 24)}</div>
      ${item.subtitulo ? `<div class="day-sub">${cortar(item.subtitulo || '', 28)}</div>` : ''}
      <div class="day-pills">${_pillsMods(item.modulos, color)}</div>`;

    btn.addEventListener('click', () => {
      if (esDesc) { toast('🌙 Día de descanso'); return; }
      if (ROL === 'empleado') { irExamenOEstudio(item); } else { abrirPanel(item.posicion); }
    });
    wrap.appendChild(btn);

    // Botones de acción (solo entrenador, no descanso)
    if (ROL === 'entrenador' && !esDesc) {
      const bar = document.createElement('div');
      bar.className = 'day-actions-bar';
      bar.innerHTML = `
        <button type="button" class="dab ${done ? 'dab-undo' : 'dab-check'}"
          title="${done ? 'Desmarcar' : 'Completado'}"
          onclick="event.stopPropagation();${done ? `desmarcarDia(${item.posicion})` : `marcarCompletoDirecto(${item.posicion})`}">
          ${done ? '↩' : '✓'}
        </button>
        <button type="button" class="dab dab-edit"
          title="Editar módulos"
          onclick="event.stopPropagation();abrirEditor(${item.posicion})">
          ✏
        </button>`;
      wrap.appendChild(bar);
    }

    grid.appendChild(wrap);
  });
}

function _getFaseLabel(titulo) {
  if (/inducción/i.test(titulo)) return 'Inducción';
  if (/práctica/i.test(titulo))  return 'Práctica';
  if (/evaluación/i.test(titulo))return 'Evaluación';
  if (/certificación/i.test(titulo)) return 'Cert.';
  return '';
}

function _pillsMods(mods, baseColor) {
  return mods.filter(id => id !== 'DESCANSO').slice(0, 3).map(id => {
    const m = MAP_MODULOS[id];
    const c = m ? CAT_COLOR[m.cat] : baseColor;
    return `<span class="mod-pill" style="background:${c}22;color:${c};border:1px solid ${c}55">${m?.icono || '📄'} ${cortar(m?.titulo || id, 12)}</span>`;
  }).join('');
}

// ── VISTA CALENDARIO ─────────────────────────────────────────

function renderCalendario() {
  if (!EMPLEADO || !CRONO.length) { limpiarVista(); return; }
  const hoy = new Date();
  if (!window.MES_ACTUAL) {
    const fechaBase = EMPLEADO.fecha_ingreso
      ? new Date(EMPLEADO.fecha_ingreso + 'T00:00:00')
      : hoy;
    window.MES_ACTUAL = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
  }

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('calMesLabel').textContent =
    `${meses[window.MES_ACTUAL.getMonth()]} ${window.MES_ACTUAL.getFullYear()}`;

  const fechaMap = {};
  if (EMPLEADO.fecha_ingreso) {
    CRONO.forEach(item => {
      const d = new Date(EMPLEADO.fecha_ingreso + 'T00:00:00');
      d.setDate(d.getDate() + item.posicion - 1);
      fechaMap[d.toISOString().split('T')[0]] = item;
    });
  }

  const anio   = window.MES_ACTUAL.getFullYear();
  const mes    = window.MES_ACTUAL.getMonth();
  const primer = new Date(anio, mes, 1).getDay();
  const ultDia = new Date(anio, mes + 1, 0).getDate();
  const grid   = document.getElementById('calGrid');
  const hoyStr = hoy.toISOString().split('T')[0];
  grid.innerHTML = '';

  for (let i = 0; i < primer; i++) {
    const v = document.createElement('div');
    v.className = 'cal-celda cal-vacia';
    grid.appendChild(v);
  }

  for (let d = 1; d <= ultDia; d++) {
    const fStr   = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const item   = fechaMap[fStr];
    const esHoy  = fStr === hoyStr;
    const done   = item?.completado;
    const esDesc = item?.categoria === 'descanso';
    const modInfo = item ? MAP_MODULOS[item.modulos[0]] : null;
    const color   = modInfo ? CAT_COLOR[modInfo.cat] : '#555';

    const celda = document.createElement('div');
    const esFuturo = item && !done && fStr > hoyStr;
    celda.className = ['cal-celda',
      esHoy && 'cal-hoy', done && 'cal-done', !item && 'cal-libre',
      esFuturo && 'cal-bloqueado'].filter(Boolean).join(' ');

    // Número del mes siempre visible
    const numMes = document.createElement('span');
    numMes.className = 'cal-num-mes';
    numMes.textContent = d;
    celda.appendChild(numMes);

    if (item) {
      const bloqueado = esFuturo && ROL === 'empleado';
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = ['cal-day-btn',
        done && 'cal-day-done', esDesc && 'cal-day-desc',
        bloqueado && 'cal-day-lock'].filter(Boolean).join(' ');
      btn.style.cssText = `--cc:${color}`;
      btn.innerHTML = `
        <span class="cal-day-pos">Día ${item.posicion}</span>
        <span class="cal-day-ico">${bloqueado ? '🔒' : item.icono}</span>
        <span class="cal-day-tit">${cortar(item.titulo, 14)}</span>
        ${done ? '<span class="cal-done-badge">★</span>' : ''}`;

      if (!bloqueado) {
        btn.addEventListener('click', () => {
          if (esDesc) { toast('🌙 Día de descanso'); return; }
          if (ROL === 'empleado') { irExamenOEstudio(item); } else { abrirPanel(item.posicion); }
        });
      } else {
        btn.disabled = true;
      }
      celda.appendChild(btn);

      if (ROL === 'entrenador' && !esDesc && !done && !esFuturo) {
        const chk = document.createElement('button');
        chk.type      = 'button';
        chk.className = 'cal-quick-check';
        chk.title     = 'Marcar completado';
        chk.textContent = '✓';
        chk.addEventListener('click', e => { e.stopPropagation(); marcarCompletoDirecto(item.posicion); });
        celda.appendChild(chk);
      }
    }
    grid.appendChild(celda);
  }
}

function irMes(delta) {
  if (!window.MES_ACTUAL) return;
  window.MES_ACTUAL = new Date(window.MES_ACTUAL.getFullYear(), window.MES_ACTUAL.getMonth() + delta, 1);
  renderCalendario();
}

// ── PANEL LATERAL ─────────────────────────────────────────────

async function abrirPanel(posicion) {
  DIA_PANEL = posicion;
  const item = CRONO[posicion - 1];
  if (!item) return;

  document.getElementById('spDiaLabel').textContent = `Día ${posicion} de ${CRONO.length}`;
  document.getElementById('spTitulo').textContent   = item.titulo;

  const modsDiv = document.getElementById('spModulos');
  modsDiv.innerHTML = '';

  if (!item.modulos.length || item.categoria === 'descanso') {
    modsDiv.innerHTML = '<p class="sp-sin-contenido">🌙 Día de descanso</p>';
  } else {
    item.modulos.filter(id => id !== 'DESCANSO').forEach(modId => {
      const info = MAP_MODULOS[modId];
      const c    = info ? CAT_COLOR[info.cat] : '#555';
      const btn  = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'sp-mod-btn';
      btn.style.cssText = `--mc:${c}`;
      btn.innerHTML = `
        <span class="sp-mod-ico">${info?.icono || '📄'}</span>
        <div class="sp-mod-info">
          <span class="sp-mod-name">${info?.titulo || modId}</span>
          <span class="sp-mod-cat">${info?.cat || ''}</span>
        </div>
        <span class="sp-mod-arrow">→</span>`;
      btn.addEventListener('click', () => {
        window.location.href = `modulo-detalle.html?id=${modId}&dia=${posicion}&back=${encodeURIComponent(window.location.href)}`;
      });
      modsDiv.appendChild(btn);
    });
  }

  const accion = document.getElementById('spAccionCompletar');
  if (ROL === 'entrenador' && EMPLEADO?.id && item.categoria !== 'descanso') {
    accion.classList.remove('hidden');
    const btn = accion.querySelector('.btn-completar');
    if (item.completado) {
      btn.textContent = '↩ Desmarcar día';
      btn.className   = 'btn-completar btn-desmarcar-full';
      btn.onclick     = () => desmarcarDia(posicion);
    } else {
      btn.textContent = '★ Marcar como completado';
      btn.className   = 'btn-completar';
      btn.onclick     = () => marcarCompleto();
    }
  } else { accion.classList.add('hidden'); }

  const fechaEl = document.getElementById('spFechaCompletado');
  if (fechaEl) fechaEl.textContent = item.completado && item.fechaCompletado
    ? `✓ Completado el ${formatFecha(item.fechaCompletado)}` : '';

  document.getElementById('overlay').classList.add('open');
  document.getElementById('sidePanel').classList.add('open');
}

function cerrarPanel() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('sidePanel').classList.remove('open');
  DIA_PANEL = null;
}

// ── MARCAR / DESMARCAR ────────────────────────────────────────

async function marcarCompleto() {
  if (!EMPLEADO?.id || !DIA_PANEL) return;
  const btn  = document.querySelector('.btn-completar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
  const item = CRONO[DIA_PANEL - 1];
  const err  = await marcarDiaCompleto(EMPLEADO, SESION, item.dia, item.categoria);
  if (err)  { toast('❌ Error'); if (btn) { btn.disabled = false; btn.textContent = '★ Marcar como completado'; } return; }
  const col = getStarColPorItem(item);
  if (col) await upsertStar(EMPLEADO.id, EMPLEADO.nombre, col, true, SESION);
  toast('★ Completado'); cerrarPanel();
  await actualizarCrono(); renderVista();
}

async function marcarCompletoDirecto(posicion) {
  if (!EMPLEADO?.id) return;
  const item = CRONO[posicion - 1];
  const err  = await marcarDiaCompleto(EMPLEADO, SESION, item.dia, item.categoria);
  if (err) { toast('❌ Error'); return; }
  const col = getStarColPorItem(item);
  if (col) await upsertStar(EMPLEADO.id, EMPLEADO.nombre, col, true, SESION);
  toast('★ Completado'); await actualizarCrono(); renderVista();
}

async function desmarcarDia(posicion) {
  if (!EMPLEADO?.id) return;
  const item = CRONO[posicion - 1];
  const { error } = await mysupabase.from('avance_capacitacion').delete()
    .eq('empleado_id', EMPLEADO.id).eq('dia_completado', item.dia);
  if (error) { toast('❌ Error'); return; }
  toast('↩ Desmarcado'); cerrarPanel();
  await actualizarCrono(); renderVista();
}

// ── EDITOR DE MÓDULOS ─────────────────────────────────────────

function abrirEditor(pos) {
  DIA_EDITOR = pos;
  const item = CRONO[pos - 1];
  ASIG_ED    = [...(item?.modulos || [])];
  document.getElementById('modalDiaLabel').textContent = `Editar Día ${pos}`;
  document.getElementById('modalNotaTxt').textContent  = item?.titulo || '';
  renderEditorListas();
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalEditor').classList.add('open');
}

function cerrarEditor() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalEditor').classList.remove('open');
  DIA_EDITOR = null; ASIG_ED = [];
}

function renderEditorListas() {
  const lista = document.getElementById('modulosDisp');
  lista.innerHTML = '';
  MODULOS_INDEX.forEach(mod => {
    const ya = ASIG_ED.includes(mod.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `mod-chip ${ya ? 'ya-asignado' : ''}`;
    chip.innerHTML = `<span>${mod.icono}</span><span>${mod.titulo}</span>`;
    if (!ya) chip.addEventListener('click', () => { ASIG_ED.push(mod.id); renderEditorListas(); });
    lista.appendChild(chip);
  });

  const drop = document.getElementById('dropZone');
  Array.from(drop.querySelectorAll('.mod-chip')).forEach(c => c.remove());
  document.getElementById('dropHint').style.display = ASIG_ED.length ? 'none' : '';
  ASIG_ED.forEach(id => {
    const mod = MAP_MODULOS[id]; if (!mod) return;
    const chip = document.createElement('div');
    chip.className = 'mod-chip assigned';
    chip.innerHTML = `<span>${mod.icono}</span><span>${mod.titulo}</span>
      <button type="button" class="mod-chip-remove" onclick="quitarDelEditor('${id}')">✕</button>`;
    drop.appendChild(chip);
  });
}

function quitarDelEditor(id) { ASIG_ED = ASIG_ED.filter(x => x !== id); renderEditorListas(); }
function filtrarModulos(txt) {
  document.querySelectorAll('#modulosDisp .mod-chip').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(txt.toLowerCase()) ? '' : 'none';
  });
}
function soltar(event) {
  event.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const id = event.dataTransfer?.getData('text/plain');
  if (!id || ASIG_ED.includes(id)) return;
  ASIG_ED.push(id); renderEditorListas();
}

async function guardarAsignacion() {
  if (!EMPLEADO?.id || DIA_EDITOR === null) return;
  const item = CRONO[DIA_EDITOR - 1];
  const err  = await guardarOverrideDia(EMPLEADO.id, EMPLEADO.nombre, SESION.nombre, item.dia, ASIG_ED, item.titulo);
  if (err) { toast('❌ Error'); return; }
  toast('💾 Guardado'); cerrarEditor();
  await actualizarCrono(); renderVista();
}

async function resetearCronograma() {
  if (!EMPLEADO?.id) { toast('⚠️ Selecciona un empleado'); return; }
  if (!confirm(`¿Restablecer el cronograma de ${EMPLEADO.nombre}?`)) return;
  await mysupabase.from('cronograma_personalizado').delete().eq('empleado_id', EMPLEADO.id);
  await restablecerOrden(EMPLEADO.id);
  EMPLEADO.cronograma = null;
  toast('↺ Restablecido'); await actualizarCrono(); renderVista();
}

function limpiarVista() {
  document.getElementById('vistaGrid').innerHTML =
    '<div class="loading-msg">Selecciona un empleado para ver su cronograma</div>';
}
