/* ============================================================
   modulos.js — Catálogo de módulos y configuración base
   Carl's Jr. Capacitación
   ============================================================ */

const MODULOS_INDEX = [
  { id: 'coccion',        titulo: 'Tiempos de Cocción y Retención', icono: '⏱', cat: 'cocina'    },
  { id: 'freidor',        titulo: 'Freidoras — Prince Castle',      icono: '🍟', cat: 'cocina'    },
  { id: 'hamburguesas',   titulo: 'Preparación de Hamburguesas',    icono: '🍔', cat: 'cocina'    },
  { id: 'sandwiches',     titulo: 'Sándwiches de Pollo',            icono: '🍗', cat: 'cocina'    },
  { id: 'vegetales',      titulo: 'Vegetales',                      icono: '🥬', cat: 'cocina'    },
  { id: 'descongelacion', titulo: 'Descongelación',                 icono: '❄️', cat: 'cocina'    },
  { id: 'tenders',        titulo: 'Tenders / Filetitos de Pollo',   icono: '🍗', cat: 'cocina'    },
  { id: 'tocino',         titulo: 'Tocino',                         icono: '🥓', cat: 'cocina'    },
  { id: 'panes',          titulo: 'Panes',                          icono: '🍞', cat: 'cocina'    },
  { id: 'postres',        titulo: 'Postres y Helados',              icono: '🍦', cat: 'cocina'    },
  { id: 'aguas',          titulo: 'Aguas Frescas',                  icono: '💧', cat: 'cocina'    },
  { id: 'ensaladas',      titulo: 'Ensaladas',                      icono: '🥙', cat: 'cocina'    },
  { id: 'pinzas',         titulo: 'Pinzas y Utensilios',            icono: '🥢', cat: 'cocina'    },
  { id: 'recepcion',      titulo: 'Recepción de Mercancía',         icono: '📦', cat: 'cocina'    },
  { id: 'zonapeligro',    titulo: 'Zona de Peligro de Temperatura', icono: '🌡', cat: 'seguridad' },
  { id: 'lavado',         titulo: 'Lavado de Manos',                icono: '🙌', cat: 'seguridad' },
  { id: 'limpieza',       titulo: 'Limpieza y Sanitización',        icono: '🧼', cat: 'seguridad' },
  { id: 'alergenos',      titulo: 'Alérgenos y Seguridad',          icono: '⚠️', cat: 'seguridad' },
  { id: 'enfermedades',   titulo: 'Enfermedades por Alimentos',     icono: '🏥', cat: 'seguridad' },
  { id: 'Feeder',         titulo: 'Feeder / Producción',            icono: '🔥', cat: 'cocina'    },
  { id: 'autoservicio',   titulo: 'Auto Servicio — Drive Thru',     icono: '🚗', cat: 'servicio'  },
  { id: 'delivery',       titulo: 'Delivery / Uber Eats',           icono: '🛵', cat: 'servicio'  },
  { id: 'Super Star',     titulo: 'Servicio Super Star',            icono: '⭐', cat: 'servicio'  },
  { id: 'quejas',         titulo: 'Manejo de Quejas',               icono: '🗣', cat: 'servicio'  },
  { id: 'datos',          titulo: 'Datos del Negocio',              icono: '📖', cat: 'servicio'  },
  { id: 'mostrador',      titulo: 'Área Mostrador / Comedor',       icono: '🏪', cat: 'servicio'  },
];

const MAP_MODULOS = Object.fromEntries(MODULOS_INDEX.map(m => [m.id, m]));
const CAT_COLOR   = { cocina: '#ff9800', seguridad: '#4caf50', servicio: '#9c27b0' };

// ── COLUMNAS STAR — igual al PDF físico ──────────────────────
// Eliminadas: Grill Station, Green Burrito Station, Biscuits Station
const COLUMNAS_STAR = [
  { id: 'onboarding',         label: 'Onboarding / Orientación',   grupo: 'ob', emoji: '📖' },
  { id: 'fry',                label: 'Estación Freidoras',          grupo: 'bl', emoji: '🍟' },
  { id: 'feeder',             label: 'Feeder / Producción',         grupo: 'bl', emoji: '🍔' },
  { id: 'cocina',             label: 'Cocina / Cocinero',           grupo: 'bl', emoji: '🍳' },
  { id: 'tenders',            label: 'Tenders',                     grupo: 'bl', emoji: '🍗' },
  { id: 'comedor',            label: 'Comedor',                     grupo: 'fl', emoji: '🍽' },
  { id: 'cajero',             label: 'Cajero',                      grupo: 'fl', emoji: '💳' },
  { id: 'drive_thru',         label: 'Drive-Thru',                  grupo: 'fl', emoji: '🚗' },
  { id: 'drive_speed',        label: 'Drive Speed Team',            grupo: 'fl', emoji: '⚡' },
  { id: 'crew_trainer_back',  label: 'Crew Trainer Backline',       grupo: 'ct', emoji: '⭐' },
  { id: 'crew_trainer_front', label: 'Crew Trainer Frontline',      grupo: 'ct', emoji: '⭐' },
  { id: 'centerpost',         label: 'Centerpost / PIC',            grupo: 'ct', emoji: '🏆' },
];

const GRUPOS_STAR = {
  ob: { label: 'Orientación',              cls: 'g-ob', color: '#4caf50' },
  bl: { label: 'Backline / Producción',    cls: 'g-bl', color: '#c62828' },
  fl: { label: 'Frontline / Hospitalidad', cls: 'g-fl', color: '#1565c0' },
  ct: { label: 'Crew Trainer',             cls: 'g-ct', color: '#2e7d32' },
};

// Mapa: día del cronograma base → columna star que activa
// (basado en cronograma_base.json)
const DIA_A_STAR = {
  1:  'onboarding',  // Orientación + Feeder Inducción
  2:  'onboarding',  // Seguridad Alimentaria
  3:  'feeder',      // Super Star + Feeder Evaluación
  5:  'cocina',      // Descongelación + Vegetales
  6:  'fry',         // Freidora Inducción
  7:  'fry',         // Freidora Práctica
  8:  'fry',         // Freidora Evaluación
  9:  'tenders',     // Tenders Inducción
  11: 'tenders',     // Tenders Práctica
  12: 'tenders',     // Tenders Evaluación
  13: 'cocina',      // Cocina Inducción
  14: 'cocina',      // Cocina Práctica
  15: 'cocina',      // Cocina Evaluación
  17: 'cocina',      // Aguas y Postres
  18: 'comedor',     // Comedor Inducción
  19: 'comedor',     // Comedor Práctica
  20: 'comedor',     // Comedor Evaluación
  21: 'cajero',      // Cajero Inducción
  22: 'cajero',      // Cajero Práctica
  23: 'cajero',      // Cajero Evaluación
  25: 'drive_thru',  // Auto Servicio Inducción
  26: 'drive_thru',  // Auto Servicio Práctica
  27: 'drive_thru',  // Auto Servicio Evaluación
  28: 'drive_thru',  // Delivery Inducción
  29: 'drive_thru',  // Delivery Evaluación
  30: 'onboarding',  // Certificación Final
};

// Mapa: qué categoría del cronograma auto-rellena qué columna star
const CRONO_STAR_MAP = {
  onboarding: 'onboarding',
  tenders:    'tenders',
  cocina:     'cocina',
  frontline:  'comedor',
};

function getTituloDia(dia, mods) {
  if (dia === 1) return 'Orientación y Seguridad';
  if (dia === 2) return 'Seguridad Alimentaria';
  if (dia === 3) return 'Cocción y Estaciones';
  if (!mods?.length) return `Día ${dia}`;
  const info = MAP_MODULOS[mods[0]];
  return info ? info.titulo : mods[0];
}

function getCategoriaDia(mods) {
  if (!mods?.length) return 'general';
  const info = MAP_MODULOS[mods[0]];
  if (!info) return 'general';
  return { cocina: 'backline', seguridad: 'onboarding', servicio: 'frontline' }[info.cat] || 'general';
}
