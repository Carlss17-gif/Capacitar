/* ============================================================
   utils.js — Utilidades compartidas · Carl's Jr. Capacitación

   Antes: core.js

   EXPORTA (globales):
   ─────────────────────────────────────────────────────────────
   Sesión:
     getSesionEntrenador()
     getSesionEmpleado()
     requireEntrenador()
     cerrarSesion()

   Supabase helpers:
     queryEmpleadosPorEntrenador(sesion, campos?)
     queryStarPerformance(empIds)
     upsertStar(empId, empNombre, columna, valor, sesion)

   UI:
     toast(msg, dur?)
     mostrarFechaHoy(elId)

   Formato:
     formatFecha(isoStr)
     cortar(str, max)
     abreviar(str, max)   ← alias de cortar
   ============================================================ */

// ── SESIÓN ────────────────────────────────────────────────────

function getSesionEntrenador() {
  return JSON.parse(localStorage.getItem('sesion_entrenador') || 'null');
}

function getSesionEmpleado() {
  return JSON.parse(localStorage.getItem('empleado') || 'null');
}

/**
 * Protege páginas de entrenador.
 * Si no hay sesión válida redirige a index.html.
 */
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

// ── SUPABASE HELPERS ──────────────────────────────────────────

/**
 * Devuelve los empleados asignados al entrenador de la sesión.
 */
async function queryEmpleadosPorEntrenador(sesion, campos = 'id, nombre, fecha_ingreso, sucursal, entrenador') {
  const filtro = sesion.nombre_entrenador || sesion.nombre;
  return mysupabase
    .from('empleados')
    .select(campos)
    .eq('entrenador', filtro)
    .order('nombre');
}

/**
 * Obtiene filas de star_performance para un array de IDs.
 */
async function queryStarPerformance(empIds) {
  if (!empIds?.length) return { data: [], error: null };
  return mysupabase.from('star_performance').select('*').in('empleado_id', empIds);
}

/**
 * Hace upsert de una columna de star_performance
 * y registra en avance_capacitacion si el valor es true.
 */
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

// ── UI ────────────────────────────────────────────────────────

/**
 * Notificación flotante temporal.
 */
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

/**
 * Escribe la fecha de hoy dentro del elemento con el id dado.
 */
function mostrarFechaHoy(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const hoy   = new Date();
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  el.innerHTML = `Hoy es <span style="font-weight:700">${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}</span>`;
}

// ── FORMATO ───────────────────────────────────────────────────

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
