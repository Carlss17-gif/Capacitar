/* ============================================================
   dashboard-entrenador.js — Resultados de exámenes por empleado
   Carl's Jr. Capacitación

   Antes: entrenadores.js

   BUG CORREGIDO:
   ─────────────────────────────────────────────────────────────
   La función generarPDF() ahora pasa el objeto completo del
   empleado seleccionado (con todos sus datos: nombre, entrenador,
   sucursal, distrito, fecha_ingreso) y sus resultados directamente
   a pdf-reporte.js, en lugar de depender de localStorage o de
   variables globales que podían estar vacías o contener datos
   incorrectos del entrenador.
   ─────────────────────────────────────────────────────────────

   DEPENDE DE: supabase.js, utils.js, pdf-reporte.js
   ============================================================ */

let _datos        = [];    // todos los resultados del entrenador
let _empActual    = null;  // registros del empleado seleccionado
let _empleadoInfo = null;  // objeto completo del empleado seleccionado (para el PDF)

window.onload = async () => {
  requireEntrenador();
  await cargarEmpleados();
};

// ── CARGA INICIAL ─────────────────────────────────────────────

async function cargarEmpleados() {
  const sesion = getSesionEntrenador();

  // 1. Obtener empleados del entrenador (con todos los campos necesarios para el PDF)
  const { data: empleados, error: e1 } = await queryEmpleadosPorEntrenador(
    sesion,
    'id, nombre, entrenador, sucursal, distrito, fecha_ingreso'
  );

  if (e1 || !empleados?.length) {
    console.warn('Sin empleados asignados o error:', e1);
    document.getElementById('empleadoSelect').innerHTML =
      '<option value="">Sin empleados asignados</option>';
    return;
  }

  // Guardar mapa de empleados para acceder después por nombre
  const mapaEmpleados = {};
  empleados.forEach(e => { mapaEmpleados[e.nombre] = e; });

  const nombres = empleados.map(e => e.nombre);

  // 2. Resultados de examen de esos empleados
  const { data, error: e2 } = await mysupabase
    .from('resultados_examen')
    .select('*')
    .in('nombre', nombres);

  if (e2) { console.error(e2); return; }

  _datos = data || [];

  // Llenar selector con TODOS los empleados asignados (no solo los que tienen resultados)
  const select = document.getElementById('empleadoSelect');
  select.innerHTML = '<option value="">Selecciona empleado</option>';

  empleados.forEach(e => {
    const opt = document.createElement('option');
    opt.value       = e.nombre;
    opt.textContent = e.nombre;
    opt.dataset.entrenador   = e.entrenador   || '';
    opt.dataset.sucursal     = e.sucursal     || '';
    opt.dataset.distrito     = e.distrito     || '';
    opt.dataset.fechaIngreso = e.fecha_ingreso || '';
    select.appendChild(opt);
  });

  select.onchange = e => seleccionarEmpleado(e.target.value);
}

// ── SELECCIÓN DE EMPLEADO ─────────────────────────────────────

function seleccionarEmpleado(nombre) {
  if (!nombre) return;
  _empActual = _datos.filter(d => d.nombre === nombre);

  const select = document.getElementById('empleadoSelect');
  const opt    = select.options[select.selectedIndex];
  _empleadoInfo = {
    nombre,
    entrenador:    opt.dataset.entrenador   || '',
    sucursal:      opt.dataset.sucursal     || '',
    distrito:      opt.dataset.distrito     || '',
    fecha_ingreso: opt.dataset.fechaIngreso || '',
  };

  if (!_empActual.length) {
    // Empleado sin resultados de examen aún
    const canvas = document.getElementById('graficaBarra');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('cardPastel').style.display    = 'none';
    document.getElementById('areaSelect').innerHTML        = '<option value="">Sin exámenes aún</option>';
    document.getElementById('tituloExamen').innerText      = nombre;
    document.getElementById('detalleExamen').innerHTML     =
      '<p style="color:#aaa;padding:16px 0;">Este empleado aún no ha presentado ningún examen.</p>';
    return;
  }

  generarGrafica();
  generarSelectorAreas();
}

// ── GRÁFICA DE BARRAS ─────────────────────────────────────────

function generarGrafica() {
  setTimeout(() => dibujarBarras(procesarDatos()), 50);
}

function procesarDatos() {
  const areasMap = {};
  _empActual.forEach(r => {
    areasMap[r.area] = (areasMap[r.area] || 0) + r.correctas;
  });
  const ordenado = Object.entries(areasMap).sort((a, b) => b[1] - a[1]);
  return {
    labels:  ordenado.map(e => e[0]),
    valores: ordenado.map(e => e[1]),
  };
}

function dibujarBarras({ labels, valores }) {
  const canvas = document.getElementById('graficaBarra');
  const ctx    = canvas.getContext('2d');

  canvas.width  = canvas.offsetWidth  || 600;
  canvas.height = canvas.offsetHeight || 250;

  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const max           = Math.max(...valores, 1);
  const barWidth      = w / valores.length;
  const paddingBottom = 30;

  valores.forEach((v, i) => {
    const barH = (v / max) * (h - paddingBottom - 10);
    const x    = i * barWidth + 2;
    const y    = h - paddingBottom - barH;

    ctx.fillStyle = `hsl(${i * 40}, 70%, 60%)`;
    ctx.fillRect(x, y, barWidth - 6, barH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(v, i * barWidth + barWidth / 2, y - 4);

    ctx.fillStyle = '#aaa';
    ctx.font = '9px Arial';
    const label = labels[i].length > 12 ? labels[i].substring(0, 12) + '…' : labels[i];
    ctx.fillText(label, i * barWidth + barWidth / 2, h - 8);
  });
}

// ── GRÁFICA DE PASTEL ─────────────────────────────────────────

function dibujarPastel(areaSeleccionada) {
  const cardPastel = document.getElementById('cardPastel');
  if (!areaSeleccionada) { cardPastel.style.display = 'none'; return; }
  cardPastel.style.display = 'flex';

  setTimeout(() => {
    const canvas = document.getElementById('graficaPastel');
    const ctx    = canvas.getContext('2d');
    canvas.width  = canvas.offsetWidth  || 300;
    canvas.height = canvas.offsetHeight || 250;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    const datosArea = _empActual.filter(r => r.area === areaSeleccionada);
    let correctas = 0, total = 0;
    datosArea.forEach(r => { correctas += r.correctas; total += r.total; });

    const valores   = [correctas, total - correctas];
    const etiquetas = ['Correctas', 'Incorrectas'];
    const colores   = ['#ffde21', '#ef4444'];

    const cx = w / 2, cy = (h - 30) / 2;
    const radio = Math.min(w, h - 30) / 2 - 15;
    let startAngle = -Math.PI / 2;

    valores.forEach((v, i) => {
      const slice = (v / total) * 2 * Math.PI;
      const mid   = startAngle + slice / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radio, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = colores[i];
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${Math.round((v / total) * 100)}%`,
        cx + radio * 0.6 * Math.cos(mid),
        cy + radio * 0.6 * Math.sin(mid)
      );
      startAngle += slice;
    });

    const legendY = h - 10;
    let lx = cx - 70;
    etiquetas.forEach((label, i) => {
      ctx.fillStyle = colores[i];
      ctx.fillRect(lx, legendY - 12, 12, 12);
      ctx.fillStyle = '#fff';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 16, legendY - 6);
      lx += 80;
    });
  }, 50);
}

// ── SELECTOR DE ÁREAS ─────────────────────────────────────────

function generarSelectorAreas() {
  const select = document.getElementById('areaSelect');
  select.innerHTML = '<option value="">Área</option>';
  document.getElementById('cardPastel').style.display    = 'none';
  document.getElementById('tituloExamen').innerText      = '';
  document.getElementById('detalleExamen').innerHTML     = '';

  [...new Set(_empActual.map(r => r.area))].forEach(area => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = area;
    select.appendChild(opt);
  });

  select.onchange = e => {
    const area = e.target.value;
    dibujarPastel(area);
    if (area) {
      const reg = _empActual.find(r => r.area === area);
      if (reg) verExamen(reg);
    } else {
      document.getElementById('tituloExamen').innerText  = '';
      document.getElementById('detalleExamen').innerHTML = '';
    }
  };
}

// ── DETALLE DEL EXAMEN ────────────────────────────────────────

async function verExamen(registro) {
  document.getElementById('tituloExamen').innerText = 'Área: ' + registro.area;

  const examenes   = await cargarExamenes();
  const examenBase = examenes[registro.examen];
  if (!examenBase) return;

  const cont = document.getElementById('detalleExamen');
  cont.innerHTML = '';

  examenBase.preguntas.forEach((p, i) => {
    let respU    = registro.respuestas[i];
    let correcta = '';

    if (p.tipo === 'opcion') {
      correcta = p.opciones[p.correcta];
      respU    = p.opciones[respU] || 'Sin responder';
    } else {
      correcta = 'Respuesta abierta';
    }

    const esOk = respU === correcta;
    const div  = document.createElement('div');
    div.innerHTML = `
      <div class="pregunta">
        <b>${i + 1}. ${p.texto}</b><br><br>
        <span class="${esOk ? 'correcta' : 'incorrecta'}">Tu respuesta: ${respU}</span><br>
        <span class="correcta">Correcta: ${correcta}</span>
      </div>`;
    cont.appendChild(div);
  });
}

// ── GENERAR PDF ───────────────────────────────────────────────

/**
 * Llamado desde el botón "Generar PDF" del HTML.
 * Pasa los datos correctos del empleado seleccionado.
 */
async function generarPDFEmpleado() {
  if (!_empleadoInfo) {
    alert('⚠️ Selecciona un empleado primero.');
    return;
  }
  await generarPDF(_empleadoInfo, _empActual);
}

// ── NAVEGACIÓN ────────────────────────────────────────────────

function irAHabilidades() {
  const emp = _empleadoInfo?.nombre
    ? `?emp=${encodeURIComponent(_empleadoInfo.nombre)}`
    : '';
  window.location.href = 'habilidades.html' + emp;
}

// ── CACHE EXAMENES.JSON ───────────────────────────────────────

let _cacheExamenes = null;
async function cargarExamenes() {
  if (_cacheExamenes) return _cacheExamenes;
  const res = await fetch('examenes.json');
  _cacheExamenes = await res.json();
  return _cacheExamenes;
}
