
const params    = new URLSearchParams(window.location.search);
const DIA       = params.get('dia')  ? parseInt(params.get('dia'))  : null;
const AREA      = params.get('area') || null;
const BACK_URL  = params.get('back') || '';
const EXAMEN_ID = params.get('examen') || null;
const NOM_EMP   = params.get('nom') || '';

// Colores por área
const AREA_COLORS = {
  cocina:    { color: '#ff9800', rgb: '255,152,0',   label: 'Cocina',              icono: '🍔' },
  tenders:   { color: '#ff5722', rgb: '255,87,34',   label: 'Tenders',             icono: '🍗' },
  feeder:    { color: '#f44336', rgb: '244,67,54',   label: 'Feeder',              icono: '🔥' },
  onboarding:{ color: '#2196f3', rgb: '33,150,243',  label: 'Orientación',         icono: '📖' },
  seguridad: { color: '#4caf50', rgb: '76,175,80',   label: 'Seguridad Alimentaria',icono: '🛡' },
  frontline: { color: '#9c27b0', rgb: '156,39,176',  label: 'Servicio al Invitado', icono: '⭐' },
  servicio:  { color: '#9c27b0', rgb: '156,39,176',  label: 'Servicio al Invitado', icono: '⭐' },
  descanso:  { color: '#607d8b', rgb: '96,125,139',  label: 'Descanso',            icono: '🌙' },
};

let _guia    = null;  // guia_estudio.json cargado
let _base    = null;  // cronograma_base.json cargado
let _modActivo = null; // id del módulo activo en tabs

function irAtras() {
  if (BACK_URL) window.location.href = BACK_URL;
  else history.back();
}

function setAccent(cat) {
  const c = AREA_COLORS[cat] || AREA_COLORS['cocina'];
  document.documentElement.style.setProperty('--accent', c.color);
  document.documentElement.style.setProperty('--accent-rgb', c.rgb);
  document.getElementById('areaDot').style.background = c.color;
}

// ── CARGA INICIAL ────────────────────────────────────────────

async function init() {
  const [guia, base] = await Promise.all([
    fetch('guia_estudio.json').then(r => r.json()),
    fetch('cronograma_base.json').then(r => r.json()),
  ]);
  _guia = guia.modulos;
  _base = base;

  if (DIA !== null) {
    mostrarDia(DIA);
  } else if (AREA) {
    mostrarArea(AREA);
  } else {
    document.getElementById('heroTitulo').textContent = 'Sin parámetros';
    document.getElementById('contenido').innerHTML =
      '<div class="estado-vacio"><div class="icono-grande">🤔</div><p>No se especificó día ni área.</p></div>';
  }
}

// ── MODO DÍA ─────────────────────────────────────────────────

function mostrarDia(dia) {
  const diaData = _base.dias.find(d => d.dia === dia);
  if (!diaData) {
    document.getElementById('heroTitulo').textContent = `Día ${dia} no encontrado`;
    return;
  }

  const cat   = diaData.categoria || 'cocina';
  const info  = AREA_COLORS[cat]  || AREA_COLORS['cocina'];
  setAccent(cat);

  // Topbar
  document.title = `Día ${dia} — ${diaData.titulo}`;
  document.getElementById('topbarTitulo').textContent = diaData.titulo;
  const diaBadge = document.getElementById('diaBadge');
  diaBadge.textContent = `DÍA ${dia}`;
  diaBadge.style.display = '';

  // Hero
  document.getElementById('heroAreaLabel').textContent = info.label;
  document.getElementById('heroTitulo').textContent    = diaData.titulo;
  document.getElementById('heroSubtitulo').textContent = diaData.subtitulo || '';

  // Filtrar módulos reales (quitar DESCANSO)
  const modIds = (diaData.modulos || []).filter(m => m !== 'DESCANSO' && _guia[m]);

  if (!modIds.length) {
    document.getElementById('contenido').innerHTML =
      `<div class="estado-vacio"><div class="icono-grande">${diaData.icono}</div><p>${diaData.titulo === 'Descanso' ? '🌙 Día de descanso' : 'Sin contenido asignado para este día.'}</p></div>`;
    return;
  }

  // Si hay varios módulos: mostrar tabs
  if (modIds.length > 1) {
    construirModulosNav(modIds);
  }

  // Renderizar el primer módulo por defecto
  _modActivo = modIds[0];
  renderModulo(_modActivo);

  // Botón examen si el día lo requiere
  if (EXAMEN_ID) mostrarBotonExamen();
}

function construirModulosNav(modIds) {
  const nav = document.getElementById('modulosNav');
  nav.style.display = '';
  nav.innerHTML = '';

  modIds.forEach(id => {
    const mod = _guia[id];
    if (!mod) return;
    const btn = document.createElement('button');
    btn.className = 'mod-tab' + (id === modIds[0] ? ' activo' : '');
    btn.innerHTML = `<span>${mod.icono || '📄'}</span> ${mod.titulo}`;
    btn.onclick = () => {
      nav.querySelectorAll('.mod-tab').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      _modActivo = id;
      renderModulo(id);
    };
    nav.appendChild(btn);
  });
}

// ── MODO ÁREA ────────────────────────────────────────────────

function mostrarArea(areaKey) {
  const areaData = _base.areas?.[areaKey];
  const info     = AREA_COLORS[areaKey] || AREA_COLORS['cocina'];
  setAccent(areaKey);

  document.title = `${info.label} — Carl's Jr.`;
  document.getElementById('topbarTitulo').textContent  = info.label;
  document.getElementById('heroAreaLabel').textContent = info.label;
  document.getElementById('heroTitulo').textContent    = info.label;
  document.getElementById('heroSubtitulo').textContent = areaData?.descripcion || '';

  const modIds = (areaData?.modulos || []).filter(id => _guia[id]);
  if (!modIds.length) {
    document.getElementById('contenido').innerHTML =
      '<div class="estado-vacio"><div class="icono-grande">📭</div><p>Sin módulos para esta área.</p></div>';
    return;
  }

  // Construir tabs de área
  const tabsWrap = document.getElementById('areaTabsWrap');
  tabsWrap.style.display = '';
  const tabs = document.getElementById('areaTabs');
  tabs.innerHTML = '';

  modIds.forEach((id, i) => {
    const mod = _guia[id];
    if (!mod) return;
    const btn = document.createElement('button');
    btn.className = 'area-tab' + (i === 0 ? ' activo' : '');
    btn.innerHTML = `<span class="area-tab-icono">${mod.icono || '📄'}</span> ${mod.titulo}`;
    btn.onclick = () => {
      tabs.querySelectorAll('.area-tab').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      renderModulo(id);
    };
    tabs.appendChild(btn);
  });

  renderModulo(modIds[0]);
}

// ── RENDER DE UN MÓDULO ───────────────────────────────────────

function renderModulo(modId) {
  const mod = _guia[modId];
  if (!mod) {
    document.getElementById('contenido').innerHTML =
      `<div class="estado-vacio"><div class="icono-grande">😕</div><p>Módulo "${modId}" no encontrado en guia_estudio.json.</p></div>`;
    return;
  }

  const cont = document.getElementById('contenido');
  cont.innerHTML = '';

  // Header del módulo
  const header = document.createElement('div');
  header.className = 'mod-header';
  header.innerHTML = `
    <div class="mod-header-icono">${mod.icono || '📄'}</div>
    <div>
      <div class="mod-header-titulo">${mod.titulo}</div>
      <div class="mod-header-cat">${CAT_LABEL[mod.cat] || mod.cat}</div>
    </div>`;
  cont.appendChild(header);

  // Secciones
  (mod.secciones || []).forEach((sec, i) => {
    const el = crearSeccion(sec, i);
    cont.appendChild(el);
  });

  if (!mod.secciones?.length) {
    cont.innerHTML += '<div class="estado-vacio"><div class="icono-grande">📭</div><p>Este módulo no tiene contenido todavía.</p></div>';
  }
}

const CAT_LABEL = {
  cocina:    '🍳 Cocina',
  seguridad: '🛡 Seguridad Alimentaria',
  servicio:  '⭐ Servicio al Invitado',
};

// ── CREAR SECCIÓN ─────────────────────────────────────────────

function crearSeccion(sec, idx) {
  // Alertas e Info: sin colapsable, solo el bloque
  if (sec.tipo === 'video') {
    const div = document.createElement('div');
    div.className = 'video-wrap';
    div.style.animationDelay = `${idx * 50}ms`;
    if (sec.titulo) {
      const label = document.createElement('div');
      label.className = 'video-label';
      label.textContent = sec.titulo;
      div.appendChild(label);
    }
    const iframe = document.createElement('iframe');
    iframe.src = sec.url;
    iframe.allow = 'autoplay';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    div.appendChild(iframe);
    return div;
  }
  if (sec.tipo === 'alerta') {
    const div = document.createElement('div');
    div.className = 'alerta-box';
    div.style.animationDelay = `${idx * 50}ms`;
    div.textContent = sec.texto || '';
    return div;
  }
  if (sec.tipo === 'info') {
    const div = document.createElement('div');
    div.className = 'info-box';
    div.style.animationDelay = `${idx * 50}ms`;
    div.textContent = sec.texto || '';
    return div;
  }

  // Sección colapsable
  const sec_el = document.createElement('div');
  sec_el.className = 'seccion abierta';
  sec_el.style.animationDelay = `${idx * 50}ms`;

  const header = document.createElement('div');
  header.className = 'seccion-header';
  header.innerHTML = `
    <span class="seccion-titulo">${sec.titulo || tipoLabel(sec.tipo)}</span>
    <span class="seccion-toggle">▾</span>`;
  header.addEventListener('click', () => {
    sec_el.classList.toggle('cerrada');
    sec_el.classList.toggle('abierta');
  });
  sec_el.appendChild(header);

  const body = document.createElement('div');
  body.className = 'seccion-body';

  switch (sec.tipo) {
    case 'tabla':
      body.appendChild(renderTabla(sec)); break;
    case 'pasos':
      body.appendChild(renderPasos(sec)); break;
    case 'lista':
      body.appendChild(renderLista(sec)); break;
    case 'temperaturas':
      body.appendChild(renderTemps(sec)); break;
    case 'parrafos':
      body.appendChild(renderParrafos(sec)); break;
    default:
      body.innerHTML = `<p style="color:var(--muted);font-size:13px">Tipo "${sec.tipo}" no soportado.</p>`;
  }

  sec_el.appendChild(body);
  return sec_el;
}

function tipoLabel(tipo) {
  const m = { tabla:'Tabla', pasos:'Pasos', lista:'Lista', temperaturas:'Temperaturas', alerta:'Aviso', info:'Información', video:'Video' };
  return m[tipo] || tipo;
}

function mostrarBotonExamen() {
  const cta = document.getElementById('examCta');
  if (!cta) return;
  cta.style.display = '';
  cta.querySelector('.btn-examen').onclick = () => {
    const back = encodeURIComponent(BACK_URL);
    const nom  = encodeURIComponent(NOM_EMP);
    window.location.href = `examen.html?id=${encodeURIComponent(EXAMEN_ID)}&nom=${nom}&back=${back}`;
  };
}

function renderTabla(sec) {
  const wrap = document.createElement('div');
  wrap.className = 'tabla-wrap';
  const cols = sec.columnas || [];
  const rows = sec.filas    || [];
  const ths  = cols.map(c => `<th>${c}</th>`).join('');
  const trs  = rows.map(row => {
    const cells = Array.isArray(row) ? row : cols.map(c => row[c] || '');
    return `<tr>${cells.map(v => `<td>${v}</td>`).join('')}</tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  return wrap;
}

function renderPasos(sec) {
  const list = document.createElement('div');
  list.className = 'pasos-list';
  (sec.pasos || []).forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'paso-item';
    item.innerHTML = `<div class="paso-num">${i + 1}</div><span class="paso-text">${p}</span>`;
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

function renderTemps(sec) {
  const grid = document.createElement('div');
  grid.className = 'temp-grid';
  (sec.items || []).forEach(item => {
    const el = document.createElement('div');
    el.className = 'temp-item';
    el.innerHTML = `<div class="temp-num">${item.temp}</div><div class="temp-desc">${item.desc}</div>`;
    grid.appendChild(el);
  });
  return grid;
}

function renderParrafos(sec) {
  const wrap = document.createElement('div');
  wrap.className = 'parrafos-wrap';
  (sec.items || []).forEach(txt => {
    const p = document.createElement('p');
    p.className = 'parrafo-item';
    p.textContent = txt;
    wrap.appendChild(p);
  });
  return wrap;
}

// ── ARRANCAR ─────────────────────────────────────────────────
init().catch(err => {
  document.getElementById('contenido').innerHTML =
    `<div class="estado-vacio"><div class="icono-grande">❌</div><p>Error al cargar: ${err.message}</p></div>`;
});
