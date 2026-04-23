/* ============================================================
   cronograma-reorganizar.js — Reorganizar orden de días
   Carl's Jr. Capacitación

   NUEVO MODELO:
   ─────────────────────────────────────────────────────────────
   El entrenador intercambia días 4-31 en la pantalla.
   Al guardar → se actualiza empleados.cronograma con el
   array de enteros [4,9,6,7,...] (solo días 4+).
   Los días 1-3 son siempre fijos al inicio.

   DEPENDE DE: supabase.js · core.js · modulos-config.js · cronograma-motor.js
   ============================================================ */

let _sesion     = null;
let _empleado   = null;
let _crono      = [];     // resultado de construirCronograma()
let _planOrden  = [];     // [4,5,6,...31] — orden actual editable
let _diaSelec   = null;   // posición seleccionada para intercambio
let _modificado = false;

document.addEventListener('DOMContentLoaded', async () => {
  _sesion = requireEntrenador();
  await cargarEmpleados();
});

// ── EMPLEADOS ─────────────────────────────────────────────────

async function cargarEmpleados() {
  const { data } = await queryEmpleadosPorEntrenador(_sesion, 'id, nombre, fecha_ingreso, sucursal, cronograma');
  const sel = document.getElementById('empSel');

  (data || []).forEach(e => {
    const op = document.createElement('option');
    op.value              = e.id;
    op.textContent        = e.nombre;
    op.dataset.nombre     = e.nombre;
    op.dataset.ingreso    = e.fecha_ingreso || '';
    op.dataset.cronograma = JSON.stringify(e.cronograma || null);
    sel.appendChild(op);
  });

  sel.addEventListener('change', async () => {
    if (!sel.value) { limpiarGrid(); return; }
    const op = sel.options[sel.selectedIndex];
    _empleado = {
      id: op.value, nombre: op.dataset.nombre,
      fecha_ingreso: op.dataset.ingreso,
      cronograma: JSON.parse(op.dataset.cronograma),
    };
    document.getElementById('empleadoChip').textContent = _empleado.nombre;
    await cargarPlan();
  });
}

// ── CARGAR PLAN ───────────────────────────────────────────────

async function cargarPlan() {
  if (!_empleado?.id) return;

  // Usar el motor para construir el cronograma completo
  _crono = await construirCronograma(_empleado.id, _empleado.cronograma);

  // Extraer el orden actual de días 4+ (los primeros 3 son fijos)
  _planOrden = _crono.filter(item => item.posicion > 3).map(item => item.dia);
  _diaSelec  = null;
  _modificado = false;

  document.getElementById('instrucciones').style.display = '';
  document.getElementById('accionesBar').style.display   = '';
  renderGrid();
}

// ── RENDER ────────────────────────────────────────────────────

function renderGrid() {
  const grid = document.getElementById('reorgGrid');
  grid.innerHTML = '';

  const selInd = document.getElementById('selIndicador');
  if (selInd) {
    if (_diaSelec !== null) {
      const item = _crono[_diaSelec - 1];
      selInd.style.display = '';
      selInd.textContent   = `✅ Posición ${_diaSelec} ("${item?.titulo || ''}") seleccionada — toca otra para intercambiar, o la misma para cancelar`;
    } else {
      selInd.style.display = 'none';
    }
  }

  _crono.forEach(item => {
    const pos     = item.posicion;
    const esFijo  = pos <= 3;
    const esSelec = pos === _diaSelec;
    const esMod   = _modificado && pos > 3;   // indicar si ha habido cambios

    const card = document.createElement('div');
    card.className = 'dia-card';
    card.dataset.pos = pos;
    if (esFijo)  card.classList.add('fijo');
    if (esSelec) card.classList.add('seleccionado');

    const labelBtn = esSelec ? '✓ Seleccionado'
      : (_diaSelec !== null ? 'Intercambiar aquí' : 'Seleccionar');
    const clsBtn = esSelec ? 'btn-seleccionar seleccionado-btn'
      : (_diaSelec !== null ? 'btn-seleccionar intercambiar-btn' : 'btn-seleccionar');

    card.innerHTML = `
      ${esSelec ? '<span class="sel-badge">→</span>' : ''}
      <div class="dia-num">${pos}</div>
      <div class="dia-emoji">${item.icono}</div>
      <div class="dia-label">${cortar(item.titulo, 20)}</div>
      <div class="dia-cat-badge">${item.categoria}</div>
      ${!esFijo
        ? `<button class="${clsBtn}" data-pos="${pos}">${labelBtn}</button>`
        : '<div class="fijo-label">🔒 Fijo</div>'}`;

    if (!esFijo) {
      card.querySelector('[data-pos]').onclick = () => manejarSeleccion(pos);
    }
    grid.appendChild(card);
  });
}

// ── LÓGICA DE INTERCAMBIO ─────────────────────────────────────

function manejarSeleccion(pos) {
  if (pos <= 3) { toast('🔒 Los días 1-3 son fijos'); return; }

  if (_diaSelec === null) {
    _diaSelec = pos;
    renderGrid();
    toast(`Posición ${pos} seleccionada — toca el destino`);

  } else if (_diaSelec === pos) {
    _diaSelec = null;
    renderGrid();
    toast('Selección cancelada');

  } else {
    // Intercambiar los días en el orden
    const idxA = _diaSelec - 1;  // posición = índice + 1
    const idxB = pos - 1;

    // Guardar los días reales de cada posición
    const diaA = _crono[idxA].dia;
    const diaB = _crono[idxB].dia;

    // Intercambiar dentro de _crono (solo el campo "dia" y datos asociados)
    [_crono[idxA], _crono[idxB]] = [_crono[idxB], _crono[idxA]];
    // Corregir posicion
    _crono[idxA].posicion = idxA + 1;
    _crono[idxB].posicion = idxB + 1;

    // Recalcular _planOrden (array de días 4+)
    _planOrden = _crono.filter(i => i.posicion > 3).map(i => i.dia);
    _modificado = true;
    _diaSelec  = null;

    toast(`🔀 Posición ${_diaSelec || idxA+1} ↔ ${pos} intercambiadas`);
    renderGrid();

    // Resaltar botón guardar
    const btnG = document.querySelector('.btn-guardar');
    if (btnG) btnG.style.cssText = 'background:#ffde21;color:#000;font-weight:800;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;';
  }
}

// ── GUARDAR ───────────────────────────────────────────────────

async function guardarTodo() {
  if (!_empleado?.id) { toast('⚠️ Selecciona un empleado'); return; }
  if (!_modificado)   { toast('No hay cambios que guardar'); return; }

  const btn = document.querySelector('.btn-guardar');
  if (btn) { btn.textContent = '⏳ Guardando…'; btn.disabled = true; }

  // guardarOrden está en cronograma-motor.js
  // Guarda solo el array de días 4+ en empleados.cronograma
  const error = await guardarOrden(_empleado.id, _planOrden);

  if (btn) { btn.textContent = '💾 Guardar cambios'; btn.disabled = false; btn.style.cssText = ''; }

  if (error) {
    console.error(error);
    toast('❌ Error: ' + error.message);
    return;
  }

  _modificado = false;
  _empleado.cronograma = _planOrden;
  toast('✅ Orden guardado — ' + _planOrden.length + ' días personalizados');
}

async function restablecerDefault() {
  if (!_empleado?.id) { toast('⚠️ Selecciona un empleado'); return; }
  if (!confirm(`¿Restablecer el cronograma de ${_empleado.nombre} al plan base?`)) return;

  const error = await restablecerOrden(_empleado.id);
  if (error) { toast('❌ Error al restablecer'); return; }

  _empleado.cronograma = null;
  await cargarPlan();
  toast('↺ Cronograma restablecido al plan base');
}

// ── LIMPIAR ───────────────────────────────────────────────────

function limpiarGrid() {
  document.getElementById('reorgGrid').innerHTML =
    '<div class="loading-msg">Selecciona un empleado para comenzar…</div>';
  document.getElementById('instrucciones').style.display = 'none';
  document.getElementById('accionesBar').style.display   = 'none';
  document.getElementById('empleadoChip').textContent    = '—';
}
