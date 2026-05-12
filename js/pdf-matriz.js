
function _normSucursal(s) {
  return (s || '').toLowerCase()
    .normalize('NFC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

async function _cargarEmpleadosConStars(sesion) {
  const sucNorm = _normSucursal(sesion.sucursal || '');
  const { data: todos } = await mysupabase
    .from('empleados')
    .select('id, nombre, fecha_ingreso, entrenador, sucursal, activo')
    .order('fecha_ingreso');

  const empleados = (todos || []).filter(e =>
    e.activo !== false && _normSucursal(e.sucursal || '') === sucNorm
  );
  if (!empleados.length) return [];

  const ids = empleados.map(e => e.id);
  const { data: stars } = await queryStarPerformance(ids);
  const mapaStars = {};
  (stars || []).forEach(s => { mapaStars[s.empleado_id] = s; });

  return empleados.map(e => ({ emp: e, star: mapaStars[e.id] || {} }));
}

function _formatFechaCorta(f) {
  if (!f) return '—';
  const d = new Date(f + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── STAR PERFORMANCE PDF ──────────────────────────────────────
// Estilo: fondo blanco, grupos con color (verde/rojo/azul/verde),
// columnas con cabecera rotada, estrellas coloreadas por grupo

async function generarPDFStarPerformance() {
  const sesion = getSesionEntrenador ? getSesionEntrenador() : JSON.parse(localStorage.getItem('sesion_entrenador') || '{}');
  if (!sesion?.sucursal) { alert('Sin sucursal en sesión.'); return; }

  const btn = document.getElementById('btnPDFStar');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }

  try {
    const filas = await _cargarEmpleadosConStars(sesion);
    if (!filas.length) { alert('No hay empleados activos en esta sucursal.'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;
    const MAR = 8;

    // Colores de grupo (RGB)
    const GC = {
      ob: [46, 125, 50],   // verde
      bl: [198, 40, 40],   // rojo
      fl: [21, 101, 192],  // azul
      ct: [46, 125, 50],   // verde
    };

    const COLS = COLUMNAS_STAR;
    const GRUPOS = ['ob', 'bl', 'fl', 'ct'];

    // Anchos de columnas fijas
    const W_FECHA = 16;
    const W_NOMBRE = 50;
    const W_PCT = 12;
    const W_STAR = (W - MAR * 2 - W_FECHA - W_NOMBRE - W_PCT) / COLS.length;

    // ── LOGO Y ENCABEZADO ──
    // Franja superior amarilla
    doc.setFillColor(255, 222, 33);
    doc.rect(0, 0, W, 18, 'F');

    // Logo Carl's Jr texto
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("CARL'S JR.", MAR + 2, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('"Be A Star Performer!"', MAR + 40, 12);

    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text('SUCURSAL: ' + (sesion.sucursal || '').toUpperCase(), W - MAR, 8, { align: 'right' });
    doc.text('Fecha: ' + hoy, W - MAR, 14, { align: 'right' });

    // ── CABECERA GRUPOS (fila 1) ──
    const Y_GRP = 19;
    const H_GRP = 6;

    // Celda fecha+nombre vacía
    doc.setFillColor(240, 240, 240);
    doc.rect(MAR, Y_GRP, W_FECHA + W_NOMBRE - 0.3, H_GRP, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(MAR, Y_GRP, W_FECHA + W_NOMBRE - 0.3, H_GRP, 'S');

    // Grupos
    let xG = MAR + W_FECHA + W_NOMBRE;
    GRUPOS.forEach(g => {
      const gcols = COLS.filter(c => c.grupo === g);
      if (!gcols.length) return;
      const gw = gcols.length * W_STAR;
      doc.setFillColor(...GC[g]);
      doc.rect(xG, Y_GRP, gw - 0.3, H_GRP, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(GRUPOS_STAR[g].label.toUpperCase(), xG + gw / 2, Y_GRP + 4, { align: 'center' });
      xG += gw;
    });

    // Celda %
    doc.setFillColor(240, 240, 240);
    doc.rect(xG, Y_GRP, W_PCT - 0.3, H_GRP, 'F');

    // ── CABECERA COLUMNAS (fila 2, rotada) ──
    const Y_COL = Y_GRP + H_GRP;
    const H_COL = 28;

    // Fecha
    doc.setFillColor(245, 245, 245);
    doc.rect(MAR, Y_COL, W_FECHA - 0.3, H_COL, 'F');
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
    doc.rect(MAR, Y_COL, W_FECHA - 0.3, H_COL, 'S');
    doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
    doc.text('HIRE\nDATE', MAR + W_FECHA / 2, Y_COL + H_COL / 2 - 2, { align: 'center' });

    // Nombre empleado
    doc.setFillColor(245, 245, 245);
    doc.rect(MAR + W_FECHA, Y_COL, W_NOMBRE - 0.3, H_COL, 'F');
    doc.rect(MAR + W_FECHA, Y_COL, W_NOMBRE - 0.3, H_COL, 'S');
    doc.text('EMPLOYEE NAME', MAR + W_FECHA + W_NOMBRE / 2, Y_COL + H_COL / 2, { align: 'center' });

    // Columnas rotadas
    let xC = MAR + W_FECHA + W_NOMBRE;
    COLS.forEach(col => {
      const gc = GC[col.grupo];
      doc.setFillColor(gc[0], gc[1], gc[2], 0.08);
      doc.setFillColor(250, 250, 250);
      doc.rect(xC, Y_COL, W_STAR - 0.3, H_COL, 'F');
      doc.setDrawColor(...gc); doc.setLineWidth(0.3);
      doc.rect(xC, Y_COL, W_STAR - 0.3, H_COL, 'S');

      doc.saveGraphicsState();
      doc.setTextColor(...gc);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      // Texto rotado 90°
      const lbl = col.label.split('/')[0].trim();
      doc.text(lbl, xC + W_STAR / 2, Y_COL + H_COL - 2, {
        align: 'center',
        angle: 90,
        rotationDirection: 1
      });
      doc.restoreGraphicsState();
      xC += W_STAR;
    });

    // Columna %
    doc.setFillColor(245, 245, 245);
    doc.rect(xC, Y_COL, W_PCT - 0.3, H_COL, 'F');
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.2);
    doc.rect(xC, Y_COL, W_PCT - 0.3, H_COL, 'S');
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text('%', xC + W_PCT / 2, Y_COL + H_COL - 3, { align: 'center' });

    // ── FILAS DE EMPLEADOS ──
    const FILA_H = 8;
    let yF = Y_COL + H_COL;
    const totales = {};
    COLS.forEach(c => { totales[c.id] = 0; });

    filas.forEach(({ emp, star }, idx) => {
      if (yF + FILA_H > H - 10) {
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, W, H, 'F');
        yF = 10;
      }

      const bgRow = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 248];
      doc.setFillColor(...bgRow);
      doc.rect(MAR, yF, W - MAR * 2, FILA_H, 'F');

      // Línea separadora
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.15);
      doc.line(MAR, yF + FILA_H, W - MAR, yF + FILA_H);

      // Fecha
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(_formatFechaCorta(emp.fecha_ingreso), MAR + W_FECHA / 2, yF + FILA_H / 2 + 2, { align: 'center' });

      // Nombre
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const nombreCorto = emp.nombre.substring(0, 32);
      doc.text(nombreCorto, MAR + W_FECHA + 2, yF + FILA_H / 2 + 2.2);

      // Estrellas
      let xS = MAR + W_FECHA + W_NOMBRE;
      let done = 0;
      COLS.forEach(col => {
        const hecho = !!star[col.id];
        if (hecho) { done++; totales[col.id]++; }
        const gc = GC[col.grupo];

        if (hecho) {
          doc.setFillColor(gc[0], gc[1], gc[2], 0.12);
          // Fondo suave cuando está completo
          doc.setFillColor(Math.min(255, gc[0] + 180), Math.min(255, gc[1] + 180), Math.min(255, gc[2] + 180));
          doc.rect(xS, yF, W_STAR - 0.3, FILA_H, 'F');
        }

        doc.setTextColor(...(hecho ? gc : [200, 200, 200]));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(hecho ? 9 : 7);
        doc.text(hecho ? '\u2605' : '\u2606', xS + W_STAR / 2, yF + FILA_H / 2 + 2.8, { align: 'center' });
        xS += W_STAR;
      });

      // %
      const pct = COLS.length ? Math.round((done / COLS.length) * 100) : 0;
      const pColor = pct >= 80 ? [46, 125, 50] : pct >= 50 ? [230, 160, 0] : [198, 40, 40];
      doc.setTextColor(...pColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(pct + '%', xS + W_PCT / 2, yF + FILA_H / 2 + 2.5, { align: 'center' });

      yF += FILA_H;
    });

    // ── FILA TOTALES ──
    if (yF + FILA_H + 2 > H - 10) {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, H, 'F');
      yF = 10;
    }

    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
    doc.line(MAR, yF, W - MAR, yF);

    doc.setFillColor(245, 245, 245);
    doc.rect(MAR, yF, W - MAR * 2, FILA_H + 1, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('PROMEDIO SUCURSAL', MAR + W_FECHA + 2, yF + (FILA_H + 1) / 2 + 2);

    let xT = MAR + W_FECHA + W_NOMBRE;
    let sumPct = 0;
    COLS.forEach(col => {
      const cnt = totales[col.id];
      const p = filas.length ? Math.round((cnt / filas.length) * 100) : 0;
      sumPct += p;
      const gc = GC[col.grupo];
      const pColor = p >= 80 ? [46, 125, 50] : p >= 50 ? [230, 160, 0] : [198, 40, 40];
      doc.setTextColor(...pColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(cnt + '/' + filas.length, xT + W_STAR / 2, yF + (FILA_H + 1) / 2 + 2.5, { align: 'center' });
      xT += W_STAR;
    });

    const avg = COLS.length ? Math.round(sumPct / COLS.length) : 0;
    const avgC = avg >= 80 ? [46, 125, 50] : avg >= 50 ? [230, 160, 0] : [198, 40, 40];
    doc.setTextColor(...avgC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(avg + '%', xT + W_PCT / 2, yF + (FILA_H + 1) / 2 + 2.5, { align: 'center' });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text("MBM DC ITEM #69961  •  Carl's Jr. Capacitación  •  " + (sesion.sucursal || '').toUpperCase(), MAR, H - 4);
    doc.text('Pág. ' + doc.getNumberOfPages(), W - MAR, H - 4, { align: 'right' });

    const fecha = new Date().toISOString().split('T')[0];
    doc.save('StarPerformance_' + (sesion.sucursal || '').replace(/\s/g, '_') + '_' + fecha + '.pdf');

  } catch (err) {
    console.error('Error PDF Star Performance:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '📄 PDF Star'; btn.disabled = false; }
  }
}

// ── MATRIZ DE CAPACITACIÓN PDF ────────────────────────────────
// Estilo: fondo blanco, igual al Excel de referencia,
// columnas Backline/Frontline/Crew Trainer con colores

async function generarPDFMatriz() {
  const sesion = getSesionEntrenador ? getSesionEntrenador() : JSON.parse(localStorage.getItem('sesion_entrenador') || '{}');
  if (!sesion?.sucursal) { alert('Sin sucursal en sesión.'); return; }

  const btn = document.getElementById('btnPDFMatriz');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }

  try {
    const filas = await _cargarEmpleadosConStars(sesion);
    if (!filas.length) { alert('No hay empleados activos en esta sucursal.'); return; }

    // Columnas de Matriz (sin Crew Trainer)
    const COLS_MZ = COLUMNAS_STAR.filter(c => ['ob','bl','fl'].includes(c.grupo));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;
    const MAR = 8;

    const GC = {
      ob: [46, 125, 50],
      bl: [198, 40, 40],
      fl: [21, 101, 192],
    };

    const W_FECHA  = 16;
    const W_NOMBRE = 52;
    const W_PCT    = 12;
    const W_STAR   = (W - MAR * 2 - W_FECHA - W_NOMBRE - W_PCT) / COLS_MZ.length;

    // ── LOGO Y ENCABEZADO ──
    doc.setFillColor(255, 222, 33);
    doc.rect(0, 0, W, 18, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("CARL'S JR.", MAR + 2, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('"Be A Star Performer!"', MAR + 40, 12);

    const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('SUCURSAL: ' + (sesion.sucursal || '').toUpperCase(), W - MAR, 8, { align: 'right' });
    doc.text('Fecha: ' + hoy, W - MAR, 14, { align: 'right' });

    // ── CABECERA GRUPOS ──
    const Y_GRP = 19;
    const H_GRP = 6;

    doc.setFillColor(240, 240, 240);
    doc.rect(MAR, Y_GRP, W_FECHA + W_NOMBRE - 0.3, H_GRP, 'F');
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
    doc.rect(MAR, Y_GRP, W_FECHA + W_NOMBRE - 0.3, H_GRP, 'S');

    let xG = MAR + W_FECHA + W_NOMBRE;
    ['ob', 'bl', 'fl'].forEach(g => {
      const gcols = COLS_MZ.filter(c => c.grupo === g);
      if (!gcols.length) return;
      const gw = gcols.length * W_STAR;
      doc.setFillColor(...GC[g]);
      doc.rect(xG, Y_GRP, gw - 0.3, H_GRP, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      // Etiqueta con sublabel igual al Excel
      const labels = {
        ob: 'ORIENTACIÓN',
        bl: 'BACKLINE\nPRODUCTION',
        fl: 'FRONTLINE\nHOSPITALITY',
      };
      doc.text(labels[g], xG + gw / 2, Y_GRP + 4, { align: 'center' });
      xG += gw;
    });

    doc.setFillColor(240, 240, 240);
    doc.rect(xG, Y_GRP, W_PCT - 0.3, H_GRP, 'F');

    // ── CABECERA COLUMNAS ROTADAS ──
    const Y_COL = Y_GRP + H_GRP;
    const H_COL = 30;

    doc.setFillColor(245, 245, 245);
    doc.rect(MAR, Y_COL, W_FECHA - 0.3, H_COL, 'F');
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
    doc.rect(MAR, Y_COL, W_FECHA - 0.3, H_COL, 'S');
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
    doc.text('HIRE\nDATE', MAR + W_FECHA / 2, Y_COL + H_COL / 2 - 2, { align: 'center' });

    doc.setFillColor(245, 245, 245);
    doc.rect(MAR + W_FECHA, Y_COL, W_NOMBRE - 0.3, H_COL, 'F');
    doc.rect(MAR + W_FECHA, Y_COL, W_NOMBRE - 0.3, H_COL, 'S');
    doc.setTextColor(40, 40, 40);
    doc.text('EMPLOYEE NAME', MAR + W_FECHA + W_NOMBRE / 2, Y_COL + H_COL / 2, { align: 'center' });

    let xC = MAR + W_FECHA + W_NOMBRE;
    COLS_MZ.forEach(col => {
      const gc = GC[col.grupo];
      doc.setFillColor(250, 250, 250);
      doc.rect(xC, Y_COL, W_STAR - 0.3, H_COL, 'F');
      doc.setDrawColor(...gc); doc.setLineWidth(0.3);
      doc.rect(xC, Y_COL, W_STAR - 0.3, H_COL, 'S');

      doc.setTextColor(...gc);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      const lbl = col.label.split('/')[0].trim();
      doc.text(lbl, xC + W_STAR / 2, Y_COL + H_COL - 2, {
        align: 'center',
        angle: 90,
        rotationDirection: 1
      });
      xC += W_STAR;
    });

    doc.setFillColor(245, 245, 245);
    doc.rect(xC, Y_COL, W_PCT - 0.3, H_COL, 'F');
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.2);
    doc.rect(xC, Y_COL, W_PCT - 0.3, H_COL, 'S');
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text('%', xC + W_PCT / 2, Y_COL + H_COL - 3, { align: 'center' });

    // ── FILAS ──
    const FILA_H = 8;
    let yF = Y_COL + H_COL;
    const totales = {};
    COLS_MZ.forEach(c => { totales[c.id] = 0; });

    filas.forEach(({ emp, star }, idx) => {
      if (yF + FILA_H > H - 10) {
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, W, H, 'F');
        yF = 10;
      }

      const bgRow = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 248];
      doc.setFillColor(...bgRow);
      doc.rect(MAR, yF, W - MAR * 2, FILA_H, 'F');
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.15);
      doc.line(MAR, yF + FILA_H, W - MAR, yF + FILA_H);

      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(_formatFechaCorta(emp.fecha_ingreso), MAR + W_FECHA / 2, yF + FILA_H / 2 + 2, { align: 'center' });

      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(emp.nombre.substring(0, 34), MAR + W_FECHA + 2, yF + FILA_H / 2 + 2.2);

      let xS = MAR + W_FECHA + W_NOMBRE;
      let done = 0;
      COLS_MZ.forEach(col => {
        const hecho = !!star[col.id];
        if (hecho) { done++; totales[col.id]++; }
        const gc = GC[col.grupo];

        if (hecho) {
          doc.setFillColor(
            Math.min(255, gc[0] + 170),
            Math.min(255, gc[1] + 170),
            Math.min(255, gc[2] + 170)
          );
          doc.rect(xS, yF, W_STAR - 0.3, FILA_H, 'F');
        }

        doc.setTextColor(...(hecho ? gc : [210, 210, 210]));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(hecho ? 9 : 7);
        doc.text(hecho ? '\u2605' : '\u2606', xS + W_STAR / 2, yF + FILA_H / 2 + 2.8, { align: 'center' });
        xS += W_STAR;
      });

      const pct = COLS_MZ.length ? Math.round((done / COLS_MZ.length) * 100) : 0;
      const pColor = pct >= 80 ? [46, 125, 50] : pct >= 50 ? [230, 160, 0] : [198, 40, 40];
      doc.setTextColor(...pColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(pct + '%', xS + W_PCT / 2, yF + FILA_H / 2 + 2.5, { align: 'center' });

      yF += FILA_H;
    });

    // ── TOTALES ──
    if (yF + FILA_H + 2 > H - 10) {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, H, 'F');
      yF = 10;
    }

    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
    doc.line(MAR, yF, W - MAR, yF);

    doc.setFillColor(245, 245, 245);
    doc.rect(MAR, yF, W - MAR * 2, FILA_H + 1, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('PROMEDIO SUCURSAL', MAR + W_FECHA + 2, yF + (FILA_H + 1) / 2 + 2);

    let xT = MAR + W_FECHA + W_NOMBRE;
    let sumPct = 0;
    COLS_MZ.forEach(col => {
      const cnt = totales[col.id];
      const p = filas.length ? Math.round((cnt / filas.length) * 100) : 0;
      sumPct += p;
      const pColor = p >= 80 ? [46, 125, 50] : p >= 50 ? [230, 160, 0] : [198, 40, 40];
      doc.setTextColor(...pColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(cnt + '/' + filas.length, xT + W_STAR / 2, yF + (FILA_H + 1) / 2 + 2.5, { align: 'center' });
      xT += W_STAR;
    });

    const avg = COLS_MZ.length ? Math.round(sumPct / COLS_MZ.length) : 0;
    const avgC = avg >= 80 ? [46, 125, 50] : avg >= 50 ? [230, 160, 0] : [198, 40, 40];
    doc.setTextColor(...avgC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(avg + '%', xT + W_PCT / 2, yF + (FILA_H + 1) / 2 + 2.5, { align: 'center' });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text("MBM DC ITEM #69961  •  Carl's Jr. Capacitación  •  " + (sesion.sucursal || '').toUpperCase(), MAR, H - 4);
    doc.text('FEB 2011', W - MAR, H - 4, { align: 'right' });

    const fecha = new Date().toISOString().split('T')[0];
    doc.save('Matriz_' + (sesion.sucursal || '').replace(/\s/g, '_') + '_' + fecha + '.pdf');

  } catch (err) {
    console.error('Error PDF Matriz:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '📄 PDF Matriz'; btn.disabled = false; }
  }
}
