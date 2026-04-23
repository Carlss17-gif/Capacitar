/* ════════════════════════════════════════════════════════════
   modulo-detalle.js
   ─────────────────────────────────────────────────────────────
   Lee los parámetros de la URL y carga el módulo correspondiente
   desde guia_estudio.json.

   PARÁMETROS URL:
   ─────────────────────────────────────────────────────────────
   ?id=coccion          → carga el módulo con ese id
   &dia=5               → muestra "Día 5" en el topbar
   &back=cronograma.html → URL de regreso (default: history.back())
   ════════════════════════════════════════════════════════════ */

// ── INICIALIZACIÓN ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const params  = new URLSearchParams(window.location.search);
  const modId   = params.get('id')   || '';
  const dia     = params.get('dia')  || '';
  const backURL = params.get('back') || '';

  // Configurar botón de regreso
  if (backURL) {
    document.getElementById('btnRegresar').href = backURL;
  }

  // Mostrar número de día si viene en la URL
  if (dia) {
    const badge = document.getElementById('topbarDia');
    badge.textContent = `DÍA ${dia}`;
    badge.style.display = '';
  }

  if (!modId) {
    mostrarError('No se especificó ningún módulo.');
    return;
  }

  try {
    // Cargar guia_estudio.json
    const res  = await fetch('guia_estudio.json');
    if (!res.ok) throw new Error('No se pudo cargar guia_estudio.json');
    const guia = await res.json();

    const modulo = guia.modulos?.[modId];
    if (!modulo) {
      mostrarError(`Módulo "${modId}" no encontrado en la guía de estudio.`);
      return;
    }

    renderModulo(modulo, dia);

  } catch (err) {
    console.error(err);
    mostrarError('Error al cargar el contenido: ' + err.message);
  }
});

// ── RENDER PRINCIPAL ───────────────────────────────────────────
function renderModulo(m, dia) {
  // Topbar
  document.title = `${m.titulo} — Carl's Jr.`;
  document.getElementById('topbarTitulo').textContent = m.titulo;

  // Hero
  document.getElementById('heroIcono').textContent   = m.icono  || '📋';
  document.getElementById('heroCat').textContent     = CAT_LABEL[m.cat] || m.cat || '';
  document.getElementById('heroTitulo').textContent  = m.titulo;
  document.getElementById('heroSub').textContent     = dia
    ? `Día ${dia} de capacitación`
    : 'Material de capacitación Carl\'s Jr.';

  // Color acento según categoría
  const color = CAT_COLOR[m.cat] || 'var(--rojo)';
  document.documentElement.style.setProperty('--rojo', color);

  // Filtros
  construirFiltros(m.secciones || []);

  // Secciones
  const contenido = document.getElementById('contenido');
  contenido.innerHTML = '';

  if (!m.secciones?.length) {
    contenido.innerHTML = '<div class="estado-vacio"><div class="icono-grande">📭</div><p>Este módulo aún no tiene contenido.</p></div>';
    return;
  }

  m.secciones.forEach((sec, i) => {
    const el = crearSeccion(sec, i);
    contenido.appendChild(el);
  });
}

// ── FILTROS DE SECCIONES ───────────────────────────────────────
const TIPOS_LABEL = {
  tabla:        '📊 Tablas',
  pasos:        '📋 Pasos',
  lista:        '📌 Listas',
  alerta:       '⚠️ Alertas',
  info:         'ℹ️ Info',
  temperaturas: '🌡 Temperaturas',
};

function construirFiltros(secciones) {
  const bar    = document.getElementById('filtroBar');
  const tipos  = [...new Set(secciones.map(s => s.tipo))];

  if (tipos.length <= 1) { bar.style.display = 'none'; return; }

  // Botón "Todos"
  const btnTodos = crearFiltroBtn('Todos', true, () => {
    document.querySelectorAll('.seccion').forEach(el => el.style.display = '');
    bar.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
    btnTodos.classList.add('activo');
  });
  bar.appendChild(btnTodos);

  tipos.forEach(tipo => {
    const label = TIPOS_LABEL[tipo] || tipo;
    const btn   = crearFiltroBtn(label, false, () => {
      document.querySelectorAll('.seccion').forEach(el => {
        el.style.display = el.dataset.tipo === tipo ? '' : 'none';
      });
      bar.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
    });
    bar.appendChild(btn);
  });
}

function crearFiltroBtn(label, activo, onClick) {
  const btn = document.createElement('button');
  btn.className = 'filtro-btn' + (activo ? ' activo' : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// ── CREAR SECCIÓN ─────────────────────────────────────────────
function crearSeccion(sec, idx) {
  const div = document.createElement('div');
  div.className = 'seccion abierta';
  div.dataset.tipo = sec.tipo;
  div.style.animationDelay = (idx * 60) + 'ms';

  const tieneCabecera = sec.titulo || sec.tipo === 'tabla' || sec.tipo === 'pasos';

  if (sec.tipo === 'alerta') {
    div.className = '';
    div.style.marginBottom = '18px';
    div.innerHTML = `<div class="alerta-box">${sec.texto || ''}</div>`;
    return div;
  }

  if (sec.tipo === 'info') {
    div.className = '';
    div.style.marginBottom = '18px';
    div.innerHTML = `<div class="info-box">${sec.texto || ''}</div>`;
    return div;
  }

  // Header colapsable
  const header = document.createElement('div');
  header.className = 'seccion-header';
  header.innerHTML = `
    <span class="seccion-titulo">${sec.titulo || TIPOS_LABEL[sec.tipo] || 'Sección'}</span>
    <span class="seccion-toggle">▾</span>
  `;
  header.addEventListener('click', () => {
    div.classList.toggle('cerrada');
    div.classList.toggle('abierta');
  });
  div.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'seccion-body';

  switch (sec.tipo) {
    case 'tabla':       body.appendChild(renderTabla(sec));       break;
    case 'pasos':       body.appendChild(renderPasos(sec));       break;
    case 'lista':       body.appendChild(renderLista(sec));       break;
    case 'temperaturas':body.appendChild(renderTempGrid(sec));    break;
    default:
      body.innerHTML = `<p style="color:var(--gris);font-size:13px">Tipo no soportado: ${sec.tipo}</p>`;
  }

  div.appendChild(body);
  return div;
}

// ── RENDERIZADORES ────────────────────────────────────────────

function renderTabla(sec) {
  const wrap = document.createElement('div');
  wrap.className = 'tabla-wrap';

  const cols = sec.columnas || [];
  const rows = sec.filas    || [];

  const ths = cols.map(c => `<th>${c}</th>`).join('');
  const trs = rows.map(row => {
    const tds = (Array.isArray(row) ? row : cols.map(c => row[c] || ''))
      .map(v => `<td>${v}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
  return wrap;
}

function renderPasos(sec) {
  const list = document.createElement('div');
  list.className = 'pasos-list';

  (sec.pasos || []).forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'paso-item';
    item.innerHTML = `
      <div class="paso-num">${i + 1}</div>
      <span class="paso-text">${p}</span>`;
    list.appendChild(item);
  });
  return list;
}

function renderLista(sec) {
  const ul = document.createElement('ul');
  ul.className = 'bullet-list';
  (sec.items || []).forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.textContent = item;
    ul.appendChild(li);
  });
  return ul;
}

function renderTempGrid(sec) {
  const grid = document.createElement('div');
  grid.className = 'temp-grid';
  (sec.items || []).forEach(item => {
    const el = document.createElement('div');
    el.className = 'temp-item';
    el.innerHTML = `
      <div class="temp-num">${item.temp}</div>
      <div class="temp-desc">${item.desc}</div>`;
    grid.appendChild(el);
  });
  return grid;
}

// ── ERROR ──────────────────────────────────────────────────────
function mostrarError(msg) {
  document.getElementById('heroTitulo').textContent = 'Error';
  document.getElementById('heroIcono').textContent  = '❌';
  document.getElementById('contenido').innerHTML    = `
    <div class="estado-vacio">
      <div class="icono-grande">😕</div>
      <p>${msg}</p>
    </div>`;
}

// ── CATÁLOGO DE CATEGORÍAS ─────────────────────────────────────
const CAT_LABEL = {
  cocina:    '🍳 COCINA',
  seguridad: '🛡 SEGURIDAD ALIMENTARIA',
  servicio:  '⭐ SERVICIO AL INVITADO',
};

// Acento de color por categoría
const CAT_COLOR = {
  cocina:    '#e31e24',   // rojo Carl's Jr
  seguridad: '#2ecc71',   // verde
  servicio:  '#f5c518',   // amarillo / dorado
};
