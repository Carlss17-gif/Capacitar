/* ============================================================
   pdf-matriz.js — Generador de PDF Star Performance
   Carl's Jr. Capacitación
   ============================================================ */

async function generarPDFMatriz() {
  const sesion = getSesionEntrenador();
  if (!sesion) { alert('Sin sesión de entrenador'); return; }

  const sucursalSesion = (sesion.sucursal || '').trim();
  const nombreEnt      = sesion.nombre || 'Entrenador';

  if (!sucursalSesion) {
    alert('Tu perfil no tiene sucursal asignada. Contacta al administrador.');
    return;
  }

  const btn = document.getElementById('btnPDFMatriz');
  if (btn) { btn.textContent = '⏳ Generando PDF…'; btn.disabled = true; }

  try {
    const norm = s => (s || '').toLowerCase()
      .normalize('NFC').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '').trim();

    const sucNorm = norm(sucursalSesion);

    const { data: todos, error: eEmp } = await mysupabase
      .from('empleados')
      .select('id, nombre, fecha_ingreso, entrenador, sucursal, activo')
      .order('nombre');

    if (eEmp) throw new Error('Error al cargar empleados: ' + eEmp.message);

    const empleadosRaw = (todos || []).filter(e =>
      e.activo !== false && norm(e.sucursal || '') === sucNorm
    );

    if (!empleadosRaw.length) {
      alert('No hay empleados activos para la sucursal: ' + sucursalSesion);
      return;
    }

    const ids = empleadosRaw.map(e => e.id);
    const { data: stars } = await queryStarPerformance(ids);
    const mapaStars = {};
    (stars || []).forEach(s => { mapaStars[s.empleado_id] = s; });

    const filas = empleadosRaw.map(e => ({
      nombre:     e.nombre     || '—',
      entrenador: e.entrenador || '—',
      ingreso:    formatFecha(e.fecha_ingreso),
      star:       mapaStars[e.id] || {},
    }));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;

    const C = {
      negro:  [13,  13,  13],
      negro2: [24,  24,  24],
      negro3: [34,  34,  34],
      amar:   [255, 222, 33],
      rojo:   [198, 40,  40],
      azul:   [21,  101, 192],
      verde:  [46,  125, 50],
      blanco: [245, 245, 245],
      gris:   [136, 136, 136],
      gris2:  [60,  60,  60],
      ok:     [76,  175, 80],
    };

    const GRUPO_COL = { ob: C.verde, bl: C.rojo, fl: C.azul, ct: C.verde };
    const COLS = COLUMNAS_STAR;
    const GRUPOS_ORDEN = ['ob','bl','fl','ct'];

    const MAR     = 6;
    const COL_NOM = 46;
    const COL_ENT = 26;
    const COL_ING = 18;
    const COL_PCT = 12;
    const FILA_H  = 7;
    const STAR_W  = (W - MAR*2 - COL_NOM - COL_ENT - COL_ING - COL_PCT) / COLS.length;

    // Fondo negro
    doc.setFillColor(...C.negro);
    doc.rect(0, 0, W, H, 'F');

    // Header amarillo
    doc.setFillColor(...C.amar);
    doc.rect(0, 0, W, 16, 'F');
    doc.setTextColor(...C.negro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text("STAR PERFORMANCE — CARL'S JR. CAPACITACION", MAR + 2, 11);
    const fechaHoy = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Generado: ' + fechaHoy, W - MAR, 11, { align: 'right' });

    // Info sucursal
    doc.setTextColor(...C.blanco);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SUCURSAL: ' + sucursalSesion.toUpperCase(), MAR + 2, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gris);
    doc.text('Entrenador responsable: ' + nombreEnt, MAR + 2, 31);
    doc.text('Total empleados activos: ' + filas.length, MAR + 2, 36);

    doc.setDrawColor(...C.amar);
    doc.setLineWidth(0.4);
    doc.line(MAR, 40, W - MAR, 40);

    // Cabecera grupos
    const Y_GRP = 43;
    let xG = MAR + COL_NOM + COL_ENT + COL_ING;
    GRUPOS_ORDEN.forEach(g => {
      const gcols = COLS.filter(c => c.grupo === g);
      if (!gcols.length) return;
      const gw = gcols.length * STAR_W;
      doc.setFillColor(...GRUPO_COL[g]);
      doc.rect(xG, Y_GRP, gw - 0.3, 5.5, 'F');
      doc.setTextColor(...C.blanco);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(GRUPOS_STAR[g].label.toUpperCase(), xG + gw / 2, Y_GRP + 3.8, { align: 'center' });
      xG += gw;
    });

    // Cabecera columnas
    const Y_COL = Y_GRP + 5.5;
    doc.setFillColor(...C.negro2);
    doc.rect(MAR, Y_COL, COL_NOM + COL_ENT + COL_ING - 0.3, 8, 'F');
    doc.setTextColor(...C.amar);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('EMPLEADO',   MAR + 2,                        Y_COL + 5.5);
    doc.text('ENTRENADOR', MAR + COL_NOM + 2,              Y_COL + 5.5);
    doc.text('INGRESO',    MAR + COL_NOM + COL_ENT + 2,    Y_COL + 5.5);

    let xC = MAR + COL_NOM + COL_ENT + COL_ING;
    COLS.forEach(col => {
      doc.setFillColor(...C.negro2);
      doc.rect(xC, Y_COL, STAR_W - 0.3, 8, 'F');
      doc.setTextColor(...C.amar);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      const lbl = col.label.split('/')[0].trim().substring(0, 9).toUpperCase();
      doc.text(lbl, xC + STAR_W / 2, Y_COL + 5.5, { align: 'center' });
      xC += STAR_W;
    });
    doc.setFillColor(...C.negro2);
    doc.rect(xC, Y_COL, COL_PCT - 0.3, 8, 'F');
    doc.setTextColor(...C.amar);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('%', xC + COL_PCT / 2, Y_COL + 5.5, { align: 'center' });

    // Filas empleados
    let yF = Y_COL + 8;
    const totales = {};
    COLS.forEach(c => { totales[c.id] = 0; });

    filas.forEach((fila, idx) => {
      if (yF + FILA_H > H - 14) {
        doc.addPage();
        doc.setFillColor(...C.negro);
        doc.rect(0, 0, W, H, 'F');
        yF = 10;
      }

      const bg = idx % 2 === 0 ? C.negro2 : C.negro3;
      doc.setFillColor(...bg);
      doc.rect(MAR, yF, W - MAR * 2, FILA_H, 'F');

      doc.setTextColor(...C.blanco);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(fila.nombre.substring(0, 28), MAR + 2, yF + FILA_H / 2 + 2.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.gris);
      doc.setFontSize(6);
      doc.text(fila.entrenador.substring(0, 20), MAR + COL_NOM + 2,          yF + FILA_H / 2 + 2.2);
      doc.text(fila.ingreso,                     MAR + COL_NOM + COL_ENT + 2, yF + FILA_H / 2 + 2.2);

      let xS = MAR + COL_NOM + COL_ENT + COL_ING;
      let done = 0;
      COLS.forEach(col => {
        const hecho = !!fila.star[col.id];
        if (hecho) { done++; totales[col.id]++; }
        if (hecho) {
          doc.setFillColor(30, 28, 5);
          doc.rect(xS, yF, STAR_W - 0.3, FILA_H, 'F');
        }
        doc.setTextColor(...(hecho ? C.amar : C.gris2));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(hecho ? 8 : 6.5);
        doc.text(hecho ? '\u2605' : '\u2606', xS + STAR_W / 2, yF + FILA_H / 2 + 2.5, { align: 'center' });
        xS += STAR_W;
      });

      const pct = COLS.length ? Math.round((done / COLS.length) * 100) : 0;
      const pColor = pct >= 80 ? C.ok : pct >= 50 ? C.amar : C.rojo;
      doc.setTextColor(...pColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(pct + '%', xS + COL_PCT / 2, yF + FILA_H / 2 + 2.5, { align: 'center' });

      yF += FILA_H;
    });

    // Fila totales
    if (yF + FILA_H + 4 > H - 14) {
      doc.addPage();
      doc.setFillColor(...C.negro);
      doc.rect(0, 0, W, H, 'F');
      yF = 10;
    }

    doc.setDrawColor(...C.amar);
    doc.setLineWidth(0.3);
    doc.line(MAR, yF, W - MAR, yF);
    yF += 1;

    doc.setFillColor(20, 20, 10);
    doc.rect(MAR, yF, W - MAR * 2, FILA_H + 1, 'F');
    doc.setTextColor(...C.amar);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('PROMEDIO SUCURSAL', MAR + 2, yF + (FILA_H + 1) / 2 + 2.2);

    let xT = MAR + COL_NOM + COL_ENT + COL_ING;
    let sumPct = 0;
    COLS.forEach(col => {
      const cnt = totales[col.id];
      const p   = filas.length ? Math.round((cnt / filas.length) * 100) : 0;
      sumPct += p;
      const tColor = p >= 80 ? C.ok : p >= 50 ? C.amar : C.rojo;
      doc.setTextColor(...tColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(cnt + '/' + filas.length, xT + STAR_W / 2, yF + (FILA_H + 1) / 2 + 2.2, { align: 'center' });
      xT += STAR_W;
    });

    const avgPct = COLS.length ? Math.round(sumPct / COLS.length) : 0;
    const avgColor = avgPct >= 80 ? C.ok : avgPct >= 50 ? C.amar : C.rojo;
    doc.setTextColor(...avgColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(avgPct + '%', xT + COL_PCT / 2, yF + (FILA_H + 1) / 2 + 2.5, { align: 'center' });

    // Footer
    doc.setTextColor(...C.gris2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text("Cero Tenedor  -  Sistema de Capacitacion Carl's Jr.  -  " + sucursalSesion.toUpperCase(), MAR, H - 5);
    doc.text('Pagina ' + doc.getNumberOfPages(), W - MAR, H - 5, { align: 'right' });

    const hoy    = new Date().toISOString().split('T')[0];
    const nombre = 'StarPerformance_' + sucursalSesion.replace(/\s/g, '_') + '_' + hoy + '.pdf';
    doc.save(nombre);

  } catch (err) {
    console.error('Error generando PDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '📄 PDF'; btn.disabled = false; }
  }
}
