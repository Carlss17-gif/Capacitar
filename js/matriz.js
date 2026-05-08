
let _sesion         = null;
let _datos          = [];
let _esGeneral      = false;
let _verBajas       = false;
let _empPanel       = null;
let _vistaEmpleados = 'mios'; // 'mios' | 'sucursal' (solo Star Performance)

/* Normaliza un string para comparación: minúsculas, sin acentos, sin espacios extra */
function normalizarTexto(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

document.addEventListener('DOMContentLoaded', async () => {
  _sesion    = requireEntrenador();
  _esGeneral = new URLSearchParams(window.location.search).get('general') === '1';
  document.getElementById('tituloMatriz').textContent = _esGeneral ? 'Matriz' : 'Star Performance';

  // Mostrar/ocultar toggle de vista según el modo
  const toggleBar = document.getElementById('vistaToggle');
  if (toggleBar) toggleBar.style.display = _esGeneral ? 'none' : 'flex';

  construirTabla();
  await cargarDatos();
});

// ── CAMBIAR VISTA (Star Performance) ─────────────────────────

function cambiarVista(vista) {
  _vistaEmpleados = vista;
  document.getElementById('btnVistaM').classList.toggle('active',  vista === 'mios');
  document.getElementById('btnVistaS').classList.toggle('active', vista === 'sucursal');
  cargarDatos();
}

// ── CONSTRUCCIÓN DE CABECERA ──────────────────────────────────

function construirTabla() {
  const thead = document.getElementById('sp-thead');
  const gruposOrden = _esGeneral
    ? ['ob', 'bl', 'fl']
    : ['ob', 'bl', 'fl', 'ct'];

  const colsFiltradas = COLUMNAS_STAR.filter(c => gruposOrden.includes(c.grupo));
  const conteo = {};
  colsFiltradas.forEach(c => { conteo[c.grupo] = (conteo[c.grupo] || 0) + 1; });

  // ── FILA 1: logo colspan=2+rowspan=2 (cubre cols fecha+nombre) + grupos + % ──
  // El logo abarca las 2 columnas de datos fijos (fecha + nombre), sin celda vacía
  let f1 = `<tr>
    <th class="th-logo" rowspan="2" colspan="2">
      <div class="logo-box">
        <img src="CarlsLogo.png" alt="Carl's Jr." onerror="this.style.display='none'">
        <span class="star-perf-label">"Be A Star!"</span>
        <div class="logo-labels">
          <span class="logo-lbl-fecha">FECHA<br>DE INGRESO</span>
          <span class="logo-lbl-nombre">NOMBRE DEL EMPLEADO</span>
        </div>
      </div>
    </th>`;

  gruposOrden.forEach(g => {
    const cnt = conteo[g] || 0;
    if (!cnt) return;
    const grp = GRUPOS_STAR[g];
    f1 += `<th class="th-grupo" colspan="${cnt}" style="background:${grp.color}">${grp.label.toUpperCase()}</th>`;
  });
  f1 += `<th class="th-pct" rowspan="2">%</th></tr>`;

  // ── FILA 2: columnas individuales (rotadas) — fecha+nombre cubiertos por logo ──
  let f2 = '<tr>';
  colsFiltradas.forEach(col => {
    const col_color = GRUPOS_STAR[col.grupo].color;
    f2 += `<th class="th-col" style="border-top:3px solid ${col_color}" title="${col.label}">
      <div class="th-col-inner">${col.label}</div>
    </th>`;
  });
  f2 += '</tr>';

  thead.innerHTML = f1 + f2;
  window._colsRender = colsFiltradas;
}

// ── CARGA DE DATOS ────────────────────────────────────────────

async function cargarDatos() {
  const tbody = document.getElementById('sp-tbody');
  tbody.innerHTML = '<tr><td colspan="30" class="loading-cell">Cargando…</td></tr>';

  const esVistaSucursal = _esGeneral || _vistaEmpleados === 'sucursal';
  const sucursalSesion  = (_sesion.sucursal || '').trim();

  let q = mysupabase.from('empleados')
    .select('id, nombre, fecha_ingreso, entrenador, sucursal, activo, email');

  if (esVistaSucursal) {
    // Vista sucursal completa o Matriz: filtra por la misma sucursal del entrenador logueado
    if (sucursalSesion) {
      q = q.eq('sucursal', sucursalSesion);
    }
  } else {
    // Vista "Mis empleados": filtra por sucursal + luego filtra por entrenador en JS
    // Filtrar por sucursal en DB reduce el set antes del filtro JS, evitando el límite de 1000
    if (sucursalSesion) {
      q = q.eq('sucursal', sucursalSesion);
    }
  }

  let { data: empleados, error } = await q.order('fecha_ingreso');
  if (error) {
    tbody.innerHTML = '<tr><td colspan="30" class="loading-cell">No hay empleados registrados</td></tr>';
    return;
  }
  empleados = empleados || [];

  // Filtro JS para "Mis empleados": compara el campo entrenador del empleado
  // contra el nombre del entrenador logueado, sin acentos ni mayúsculas
  if (_vistaEmpleados === 'mios' && !_esGeneral) {
    const nombreNorm = normalizarTexto(_sesion.nombre_entrenador || _sesion.nombre || '');

    empleados = empleados.filter(e => {
      const entNorm = normalizarTexto(e.entrenador || '');
      // Coincide si el nombre normalizado del entrenador logueado
      // está contenido en el campo entrenador del empleado, o viceversa
      return entNorm === nombreNorm ||
             entNorm.includes(nombreNorm) ||
             nombreNorm.includes(entNorm);
    });
  }

  // Asegurar que el entrenador actual aparezca en vistas de sucursal completa
  if (esVistaSucursal && _sesion.email) {
    const yaEsta = empleados.some(e => e.email === _sesion.email);
    if (!yaEsta) {
      const { data: propioRec } = await mysupabase
        .from('empleados')
        .select('id, nombre, fecha_ingreso, entrenador, sucursal, activo, email')
        .eq('email', _sesion.email)
        .maybeSingle();
      if (propioRec) empleados.unshift(propioRec);
    }
  }

  if (!empleados.length) {
    tbody.innerHTML = '<tr><td colspan="30" class="loading-cell">No hay empleados registrados</td></tr>';
    return;
  }

  const ids = empleados.map(e => e.id);
  const { data: stars } = await queryStarPerformance(ids);
  const mapaStars = {};
  (stars || []).forEach(s => { mapaStars[s.empleado_id] = s; });

  // Para la Matriz también cargamos avance_capacitacion para auto-poblar
  let avanceMap = {};
  if (_esGeneral) {
    const { data: avances } = await mysupabase
      .from('avance_capacitacion')
      .select('empleado_id, dia_completado, estacion, completado')
      .in('empleado_id', ids)
      .eq('completado', true);

    (avances || []).forEach(a => {
      if (!avanceMap[a.empleado_id]) avanceMap[a.empleado_id] = {};
      // Mapeo por número de día
      if (a.dia_completado && DIA_A_STAR[a.dia_completado]) {
        avanceMap[a.empleado_id][DIA_A_STAR[a.dia_completado]] = true;
      }
      // Mapeo directo si estacion == id de columna star
      if (a.estacion && COLUMNAS_STAR.find(c => c.id === a.estacion)) {
        avanceMap[a.empleado_id][a.estacion] = true;
      }
    });
  }

  _datos = empleados.map(e => {
    const starRow = mapaStars[e.id] || {};
    const avRow   = avanceMap[e.id]  || {};
    // Fusionar: star_performance tiene prioridad, avance_capacitacion rellena huecos
    const merged = Object.assign({}, avRow);
    Object.keys(starRow).forEach(k => { if (starRow[k]) merged[k] = true; });
    return { empleado: e, star: merged };
  });
  renderTabla();
}

// ── RENDER DE TABLA ───────────────────────────────────────────

function renderTabla() {
  const tbody = document.getElementById('sp-tbody');
  tbody.innerHTML = '';
  const cols = window._colsRender || COLUMNAS_STAR;

  const emailSesion = _sesion?.email || '';
  const filtrados = _verBajas
    ? _datos
    : _datos.filter(d => d.empleado.activo !== false || d.empleado.email === emailSesion);
  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="30" class="loading-cell">Sin empleados</td></tr>';
    return;
  }

  filtrados.forEach(({ empleado, star }, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.nombre = (empleado.nombre || '').toLowerCase();
    tr.dataset.id     = empleado.id;
    if (empleado.activo === false) tr.classList.add('baja');
    if (idx % 2 === 0) tr.classList.add('fila-par');

    // Fecha
    const tdFecha = document.createElement('td');
    tdFecha.className   = 'td-hire';
    tdFecha.textContent = empleado.fecha_ingreso
      ? new Date(empleado.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit' })
      : '—';
    tr.appendChild(tdFecha);

    // Nombre
    const tdN = document.createElement('td');
    tdN.className = 'td-nombre';
    tdN.innerHTML = `<span class="td-nombre-txt">${empleado.nombre || '—'}</span>
      <span class="td-nombre-sub">${empleado.entrenador || ''}</span>`;
    tdN.onclick = () => abrirPanel(empleado, star);
    tr.appendChild(tdN);

    // Celdas de estrellas
    let doneCt = 0;
    cols.forEach(col => {
      const td    = document.createElement('td');
      td.className = 'td-star';
      const hecho = !!star[col.id];
      if (hecho) doneCt++;
      const color = GRUPOS_STAR[col.grupo].color;

      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = `star-btn ${hecho ? 'star-on' : 'star-off'}`;
      btn.title     = col.label;
      if (hecho) {
        btn.style.background  = `${color}22`;
        btn.style.borderColor = color;
      }
      btn.textContent = hecho ? '★' : '☆';

      // FIX: leer estado actual del botón en cada clic (no closure)
      btn.addEventListener('click', () => {
        const estadoActual = btn.classList.contains('star-on');
        toggleEstrella(empleado.id, empleado.nombre, col.id, !estadoActual, td, col.grupo, btn);
      });

      td.appendChild(btn);
      tr.appendChild(td);
    });

    // Columna Promedio
    const pct   = cols.length ? Math.round((doneCt / cols.length) * 100) : 0;
    const tdPct = document.createElement('td');
    tdPct.className = 'td-pct';
    tdPct.innerHTML = `<span class="pct-porcent">${pct}%</span><br><span class="pct-fraccion">${doneCt}/${cols.length}</span>`;
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  });

  // Fila de totales (Matriz)
  if (_esGeneral) _appendFilaTotales(cols, filtrados);
}

function _appendFilaTotales(cols, filtrados) {
  const tbody = document.getElementById('sp-tbody');
  const totales = {};
  cols.forEach(c => {
    totales[c.id] = filtrados.filter(d => !!d.star[c.id]).length;
  });

  const tr = document.createElement('tr');
  tr.classList.add('fila-totales');

  const tdLbl = document.createElement('td');
  tdLbl.colSpan = 2;
  tdLbl.className = 'td-total-lbl';
  tdLbl.textContent = 'Promedio Sucursal';
  tr.appendChild(tdLbl);

  let sumPct = 0;
  cols.forEach(c => {
    const td = document.createElement('td');
    td.className = 'td-star td-total';
    const pct = filtrados.length ? Math.round((totales[c.id] / filtrados.length) * 100) : 0;
    sumPct += pct;
    td.innerHTML = `<span class="tot-num">${totales[c.id]}</span>`;
    tr.appendChild(td);
  });

  const tdTotPct = document.createElement('td');
  tdTotPct.className = 'td-pct td-total';
  const avgPct = cols.length ? Math.round(sumPct / cols.length) : 0;
  tdTotPct.innerHTML = `<span class="pct-porcent">${avgPct}%</span>`;
  tr.appendChild(tdTotPct);

  tbody.appendChild(tr);
}

// ── TOGGLE ESTRELLA ───────────────────────────────────────────

async function toggleEstrella(empId, empNombre, columna, nuevoValor, tdEl, grupo, btn) {
  const color = GRUPOS_STAR[grupo].color;

  // Actualización visual optimista
  btn.textContent = nuevoValor ? '★' : '☆';
  btn.className   = `star-btn ${nuevoValor ? 'star-on' : 'star-off'}`;
  btn.style.background  = nuevoValor ? `${color}22` : '';
  btn.style.borderColor = nuevoValor ? color : '';

  const error = await upsertStar(empId, empNombre, columna, nuevoValor, _sesion);
  if (error) {
    // Revertir si falló
    btn.textContent = nuevoValor ? '☆' : '★';
    btn.className   = `star-btn ${nuevoValor ? 'star-off' : 'star-on'}`;
    btn.style.background  = nuevoValor ? '' : `${color}22`;
    btn.style.borderColor = nuevoValor ? '' : color;
    console.error('Error guardando estrella:', error);
    toast(`❌ Error al guardar: ${error.message || error.code || 'Verifica permisos'}`);
    return;
  }

  // Actualizar datos en memoria
  const item = _datos.find(d => d.empleado.id === empId);
  if (item) item.star[columna] = nuevoValor;

  toast(nuevoValor ? '★ Estrella asignada' : '☆ Removida');
}

// ── PANEL LATERAL ─────────────────────────────────────────────

function abrirPanel(empleado, star) {
  _empPanel = empleado;
  const cols = window._colsRender || COLUMNAS_STAR;
  document.getElementById('panelNombre').textContent = empleado.nombre;

  const estDone = cols.filter(c => !!star[c.id]);
  const pct     = Math.round((estDone.length / cols.length) * 100);

  document.getElementById('panelBody').innerHTML = `
    <div class="panel-info-row">Entrenador: <strong>${empleado.entrenador || '—'}</strong></div>
    <div class="panel-info-row">Sucursal: <strong>${empleado.sucursal || '—'}</strong></div>
    <div class="panel-info-row">Ingreso: <strong>${formatFecha(empleado.fecha_ingreso)}</strong></div>
    <div class="panel-info-row">Avance: <strong style="color:#ffde21">${pct}% (${estDone.length}/${cols.length})</strong></div>
    <div class="panel-progress"><div class="panel-prog-fill" style="width:${pct}%"></div></div>
    <div class="panel-estaciones">
      ${cols.map(c => {
        const hecho = !!star[c.id];
        const color = GRUPOS_STAR[c.grupo].color;
        return `<div class="panel-est ${hecho ? 'done' : 'pend'}" style="${hecho ? `border-color:${color};background:${color}18` : ''}">
          ${c.emoji} ${c.label.split('/')[0].trim()} ${hecho ? '★' : '☆'}
        </div>`;
      }).join('')}
    </div>`;

  const btnBaja = document.getElementById('btnDarBaja');
  const esBaja  = empleado.activo === false;
  btnBaja.textContent = esBaja ? '✅ Reactivar' : '🚫 Dar de baja';

  document.getElementById('overlay').classList.add('open');
  document.getElementById('sidePanel').classList.add('open');
}

function cerrarPanel() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('sidePanel').classList.remove('open');
  _empPanel = null;
}

async function confirmarBaja() {
  if (!_empPanel) return;
  const esActivo = _empPanel.activo !== false;
  if (!confirm(`¿${esActivo ? 'Dar de baja' : 'Reactivar'} a ${_empPanel.nombre}?`)) return;
  const { error } = await mysupabase.from('empleados').update({ activo: !esActivo }).eq('id', _empPanel.id);
  if (error) { toast('❌ Error'); return; }
  toast(esActivo ? '🚫 Dado de baja' : '✅ Reactivado');
  cerrarPanel();
  await cargarDatos();
}

// ── FILTROS ───────────────────────────────────────────────────

function filtrar(texto) {
  const q = texto.toLowerCase().trim();
  document.querySelectorAll('#sp-tbody tr').forEach(tr => {
    tr.classList.toggle('hidden-row', !(tr.dataset.nombre || '').includes(q));
  });
}

function toggleBajas() {
  _verBajas = !_verBajas;
  document.getElementById('btnBaja').textContent = _verBajas ? 'Ocultar bajas' : 'Ver bajas';
  renderTabla();
}

// ── EXPORTAR CSV ──────────────────────────────────────────────

function exportarCSV() {
  const cols    = window._colsRender || COLUMNAS_STAR;
  const headers = ['Nombre', 'Entrenador', 'Sucursal', 'Ingreso', ...cols.map(c => c.label), '%'];
  const filas   = _datos.map(({ empleado, star }) => {
    const doneCt = cols.filter(c => !!star[c.id]).length;
    const pct    = Math.round((doneCt / cols.length) * 100);
    return [
      empleado.nombre || '', empleado.entrenador || '',
      empleado.sucursal || '', empleado.fecha_ingreso || '',
      ...cols.map(c => star[c.id] ? '★' : '☆'),
      `${pct}%`,
    ];
  });
  const csv = [headers, ...filas].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: `${_esGeneral ? 'matriz' : 'star_performance'}_${new Date().toISOString().split('T')[0]}.csv`,
  });
  a.click();
}

