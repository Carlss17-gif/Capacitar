

function getSesionEntrenador() {
  return JSON.parse(localStorage.getItem('sesion_entrenador') || 'null');
}

function getSesionEmpleado() {
  return JSON.parse(localStorage.getItem('empleado') || 'null');
}

function requireEntrenador() {
  const s = getSesionEntrenador();
  if (!s || !s.nombre) {
    window.location.href = 'index.html';
    return {};
  }
  return s;
}

function cerrarSesion() {
  localStorage.removeItem('sesion_entrenador');
  window.location.href = 'index.html';
}


async function queryEmpleadosPorEntrenador(sesion, campos = 'id, nombre, fecha_ingreso, sucursal, entrenador') {
  const filtro = sesion.nombre_entrenador || sesion.nombre;

  const palabras = filtro.split(/\s+/).filter(p => p.length > 2);
  let query = mysupabase.from('empleados').select(campos);

  if (palabras.length > 0) {
    const condiciones = palabras.map(p => `entrenador.ilike.%${p}%`).join(',');
    query = query.or(condiciones);
  } else {
    query = query.ilike('entrenador', `%${filtro}%`);
  }

  return query.order('nombre');
}

/**
 * Obtiene filas de star_performance para un array de IDs.
 */
async function queryStarPerformance(empIds) {
  if (!empIds?.length) return { data: [], error: null };
  return mysupabase.from('star_performance').select('*').in('empleado_id', empIds);
}

async function upsertStar(empId, empNombre, columna, nuevoValor, sesion) {
  const { error } = await mysupabase
    .from('star_performance')
    .upsert({
      empleado_id:     empId,
      empleado_nombre: empNombre,
      entrenador:      sesion.nombre,
      sucursal:        sesion.sucursal || '',
      [columna]:       nuevoValor,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'empleado_id' });

  if (!error && nuevoValor) {
    await mysupabase.from('avance_capacitacion').upsert({
      empleado_id:      empId,
      empleado_nombre:  empNombre,
      entrenador:       sesion.nombre,
      sucursal:         sesion.sucursal || '',
      estacion:         columna,
      completado:       true,
      fecha_completado: new Date().toISOString().split('T')[0],
    }, { onConflict: 'empleado_id,estacion' });
  }

  return error;
}

function toast(msg, dur = 2800) {
  let t = document.getElementById('_toast_global');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast_global';
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%) translateY(20px)',
      background: '#333', color: '#fff', padding: '10px 20px',
      borderRadius: '20px', fontSize: '13px', opacity: '0',
      transition: 'all .3s', zIndex: '9999', whiteSpace: 'nowrap',
      pointerEvents: 'none',
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity   = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._to);
  t._to = setTimeout(() => {
    t.style.opacity   = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, dur);
}

function mostrarFechaHoy(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const hoy   = new Date();
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  el.innerHTML = `Hoy es <span style="font-weight:700">${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}</span>`;
}


const _MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${parseInt(d)} ${_MESES_CORTO[parseInt(m) - 1]} ${y}`;
}

function cortar(str, max) {
  return str?.length > max ? str.substring(0, max) + '…' : (str || '');
}

// Alias para compatibilidad
const abreviar = cortar;
