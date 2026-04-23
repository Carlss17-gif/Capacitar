/* ============================================================
   cronograma-motor.js — Motor del cronograma 31 días
   Carl's Jr. Capacitación

   Antes: cronograma-engine.js

   CÓMO FUNCIONA:
   ─────────────────────────────────────────────────────────────
   1. cronograma_base.json  → plantilla de 31 días (JSON estático)
   2. empleados.cronograma  → integer[] | NULL en Supabase
      NULL = plantilla por defecto
      [4,9,6,...] = orden personalizado (días 4-31)
   3. cronograma_personalizado → overrides de módulos por día
   4. avance_capacitacion → días completados

   DEPENDE DE: supabase.js, utils.js
   ============================================================ */

let _baseCache = null;

// ── CARGA DEL JSON BASE ───────────────────────────────────────

async function cargarBase() {
  if (_baseCache) return _baseCache;
  const res  = await fetch('cronograma_base.json');
  const json = await res.json();
  _baseCache = json.dias;
  return _baseCache;
}

// ── CONSTRUCCIÓN COMPLETA DEL CRONOGRAMA ─────────────────────

/**
 * Construye el cronograma completo de un empleado:
 * base + overrides + avance.
 *
 * @param {string}    empleadoId
 * @param {int[]|null} ordenPersonalizado  — empleados.cronograma
 * @returns {Array} 31 objetos de día
 */
async function construirCronograma(empleadoId, ordenPersonalizado = null) {
  const [base, overrides, avance] = await Promise.all([
    cargarBase(),
    cargarOverrides(empleadoId),
    cargarAvance(empleadoId),
  ]);

  const overrideMap = {};
  (overrides || []).forEach(o => { overrideMap[o.dia] = o; });

  const completadosSet = new Set((avance || []).map(a => a.dia_completado));

  let diasOrdenados;
  if (ordenPersonalizado && ordenPersonalizado.length > 0) {
    const fijos = [1, 2, 3];
    const resto = ordenPersonalizado.filter(d => d > 3);
    diasOrdenados = [...fijos, ...resto];
  } else {
    diasOrdenados = base.map(d => d.dia);
  }

  return diasOrdenados.map((numDia, posicion) => {
    const baseDia    = base.find(b => b.dia === numDia) || base[numDia - 1] || {};
    const override   = overrideMap[numDia] || {};
    const completado = completadosSet.has(numDia);

    return {
      posicion:        posicion + 1,
      dia:             numDia,
      titulo:          override.titulo    || baseDia.titulo    || `Día ${numDia}`,
      icono:           baseDia.icono      || '📋',
      categoria:       override.categoria || baseDia.categoria || 'general',
      modulos:         override.modulos   || baseDia.modulos   || [],
      obligatorio:     baseDia.obligatorio || false,
      completado,
      fechaCompletado: completado
        ? (avance.find(a => a.dia_completado === numDia)?.fecha_completado || null)
        : null,
    };
  });
}

// ── QUERIES ───────────────────────────────────────────────────

async function cargarOverrides(empleadoId) {
  if (!empleadoId) return [];
  const { data } = await mysupabase
    .from('cronograma_personalizado')
    .select('dia, modulos, titulo, categoria')
    .eq('empleado_id', empleadoId);
  return data || [];
}

async function cargarAvance(empleadoId) {
  if (!empleadoId) return [];
  const { data } = await mysupabase
    .from('avance_capacitacion')
    .select('dia_completado, fecha_completado')
    .eq('empleado_id', empleadoId)
    .eq('completado', true);
  return data || [];
}

// ── GUARDAR ORDEN ─────────────────────────────────────────────

async function guardarOrden(empleadoId, nuevoOrden) {
  const { error } = await mysupabase
    .from('empleados')
    .update({ cronograma: nuevoOrden.filter(d => d > 3) })
    .eq('id', empleadoId);
  return error;
}

async function restablecerOrden(empleadoId) {
  const { error } = await mysupabase
    .from('empleados')
    .update({ cronograma: null })
    .eq('id', empleadoId);
  return error;
}

// ── GUARDAR OVERRIDE DE MÓDULOS ───────────────────────────────

async function guardarOverrideDia(empleadoId, empleadoNombre, entrenador, dia, modulos, titulo) {
  const { error } = await mysupabase
    .from('cronograma_personalizado')
    .upsert({
      empleado_id:     empleadoId,
      empleado_nombre: empleadoNombre,
      entrenador,
      dia,
      modulos,
      titulo,
    }, { onConflict: 'empleado_id,dia' });
  return error;
}

// ── MARCAR DÍA COMPLETADO ─────────────────────────────────────

async function marcarDiaCompleto(empleado, sesion, dia, estacion) {
  const { error } = await mysupabase
    .from('avance_capacitacion')
    .upsert({
      empleado_id:      empleado.id,
      empleado_nombre:  empleado.nombre,
      entrenador:       sesion.nombre,
      sucursal:         empleado.sucursal || sesion.sucursal || '',
      estacion:         estacion || 'general',
      dia_completado:   dia,
      completado:       true,
      fecha_completado: new Date().toISOString().split('T')[0],
    }, { onConflict: 'empleado_id,dia_completado' });

  if (error) return error;

  // Mapeo categoría → estrella (cronograma-motor no tiene acceso a modulos del día)
  const STAR_MAP = {
    onboarding: 'onboarding',
    tenders:    'tenders',
    cocina:     'cocina',
    frontline:  'comedor',
    backline:   'cocina',
  };
  const colStar = STAR_MAP[estacion] || null;
  if (colStar) await upsertStar(empleado.id, empleado.nombre, colStar, true, sesion);

  return null;
}

// ── ESTADÍSTICAS ──────────────────────────────────────────────

function calcularProgreso(cronograma) {
  const total       = cronograma.filter(d => d.categoria !== 'descanso').length;
  const completados = cronograma.filter(d => d.completado && d.categoria !== 'descanso').length;
  return {
    completados,
    total,
    pct: total > 0 ? Math.round((completados / total) * 100) : 0,
  };
}
