/* ============================================================
   matriz-pdf.js — Generador de PDF Star Performance
   Carl's Jr. Capacitación
   
   DEPENDE DE: supabase.js, core.js, modulos-config.js, jsPDF
   Usa COLUMNAS_STAR de modulos-config.js
   ============================================================ */

async function generarPDFMatriz() {
  const sesion = getSesionEntrenador();
  if (!sesion) { alert('Sin sesión de entrenador'); return; }

  const sucursal  = sesion.sucursal || '';
  const nombreEnt = sesion.nombre   || 'Entrenador';

  if (!sucursal) {
    alert('Tu perfil no tiene sucursal asignada. Contacta al administrador.');
    return;
  }

  const btn = document.getElementById('btnPDFMatriz');
  if (btn) { btn.textContent = '⏳ Generando PDF…'; btn.disabled = true; }

  try {
    const { data: empleados, error: eEmp } = await mysupabase
      .from('empleados')
      .select('id, nombre, fecha_ingreso, entrenador, sucursal')
      .eq('sucursal', sucursal)
      .order('nombre');

    if (eEmp || !empleados?.length) {
      alert('No hay empleados para la sucursal: ' + sucursal);
      return;
    }

    const ids = empleados.map(e => e.id);
    const { data: stars } = await queryStarPerformance(ids);
    const mapaStars = {};
    (stars || []).forEach(s => { mapaStars[s.empleado_id] = s; });

    const filas = empleados.map(e => ({
      nombre:     e.nombre,
      entrenador: e.entrenador || '—',
      ingreso:    formatFecha(e.fecha_ingreso),
      star:       mapaStars[e.id] || {},
    }));

    // ── PDF ──────────────────────────────────────────────────
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;

    const NEGRO  = [15, 15, 15];
    const NEGRO2 = [26, 26, 26];
    const AMARI  = [255, 222, 33];
    const ROJO   = [211, 47, 47];
    const AZUL   = [21, 101, 192];
    const VERDE  = [46, 125, 50];
    const BLANCO = [255, 255, 255];
    const GRIS   = [136, 136, 136];
    const GRIS2  = [50, 50, 50];

    // Paleta por grupo (igual que GRUPOS_STAR pero en RGB)
    const GRUPO_COL = { ob: ROJO, bl: ROJO, fl: AZUL, ct: VERDE };

    // Fondo
    doc.setFillColor(...NEGRO);
    doc.rect(0, 0, W, H, 'F');

    // Barra amarilla
    doc.setFillColor(...AMARI);
    doc.rect(0, 0, W, 18, 'F');

    doc.setTextColor(...NEGRO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("STAR PERFORMANCE — SISTEMA DE CAPACITACIÓN CARL'S JR.", 8, 12);

    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.text('Generado: ' + fecha, W - 8, 12, { align: 'right' });

    doc.setTextColor(...BLANCO);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUCURSAL: ' + sucursal.toUpperCase(), 8, 30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIS);
    doc.text('Entrenador: ' + nombreEnt, 8, 38);
    doc.text('Total empleados: ' + filas.length, 8, 44);
    doc.setDrawColor(...AMARI);
    doc.setLineWidth(0.5);
    doc.line(8, 50, W - 8, 50);

    // Definir anchos de columnas del PDF (abreviadas para A4 landscape)
    const COLS_PDF = COLUMNAS_STAR.map(c => ({
      id:    c.id,
      label: c.label.split(' ')[0].toUpperCase().substring(0, 8),
      grupo: c.grupo,
      w:     c.grupo === 'ob' ? 14 : 13,
    }));

    const COL_NOMBRE_W = 52, COL_ENT_W = 28, COL_ING_W = 22;
    const MARGIN = 8, FILA_H = 8;
    const Y_HEADER = 55, Y_INICIO = Y_HEADER + 16;

    // Encabezados de grupo
    const gruposOrden = ['ob', 'bl', 'fl', 'ct'];
    let xG = MARGIN + COL_NOMBRE_W + COL_ENT_W + COL_ING_W;
    gruposOrden.forEach(g => {
      const cols = COLS_PDF.filter(c => c.grupo === g);
      if (!cols.length) return;
      const totalW = cols.reduce((s, c) => s + c.w, 0);
      doc.setFillColor(...GRUPO_COL[g]);
      doc.rect(xG, Y_HEADER, totalW - 0.5, 6, 'F');
      doc.setTextColor(...BLANCO);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(GRUPOS_STAR[g].label.toUpperCase(), xG + totalW / 2, Y_HEADER + 4.2, { align: 'center' });
      xG += totalW;
    });

    const Y_COL = Y_HEADER + 6;
    doc.setFillColor(...GRIS2);
    doc.rect(MARGIN, Y_COL, COL_NOMBRE_W + COL_ENT_W + COL_ING_W - 0.5, 8, 'F');
    doc.setTextColor(...AMARI);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLEADO',   MARGIN + 2, Y_COL + 5);
    doc.text('ENTRENADOR', MARGIN + COL_NOMBRE_W + 2, Y_COL + 5);
    doc.text('INGRESO',    MARGIN + COL_NOMBRE_W + COL_ENT_W + 2, Y_COL + 5);

    let xPos = MARGIN + COL_NOMBRE_W + COL_ENT_W + COL_ING_W;
    COLS_PDF.forEach(col => {
      doc.setFillColor(...GRIS2);
      doc.rect(xPos, Y_COL, col.w - 0.5, 8, 'F');
      doc.setTextColor(...AMARI);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(col.label, xPos + col.w / 2, Y_COL + 5, { align: 'center' });
      xPos += col.w;
    });

    // Filas de empleados
    let yFila = Y_INICIO;
    filas.forEach((fila, idx) => {
      if (yFila > H - 15) {
        doc.addPage();
        doc.setFillColor(...NEGRO);
        doc.rect(0, 0, W, H, 'F');
        yFila = 20;
      }

      doc.setFillColor(...(idx % 2 === 0 ? NEGRO2 : [22, 22, 22]));
      doc.rect(MARGIN, yFila, W - MARGIN * 2, FILA_H, 'F');

      doc.setTextColor(...BLANCO);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(fila.nombre, MARGIN + 2, yFila + FILA_H / 2 + 2.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRIS);
      doc.setFontSize(6.5);
      doc.text(fila.entrenador, MARGIN + COL_NOMBRE_W + 2, yFila + FILA_H / 2 + 2.5);
      doc.text(fila.ingreso,    MARGIN + COL_NOMBRE_W + COL_ENT_W + 2, yFila + FILA_H / 2 + 2.5);

      xPos = MARGIN + COL_NOMBRE_W + COL_ENT_W + COL_ING_W;
      COLS_PDF.forEach(col => {
        const hecho = !!fila.star[col.id];
        if (hecho) {
          doc.setFillColor(40, 40, 20);
          doc.rect(xPos, yFila, col.w - 0.5, FILA_H, 'F');
        }
        doc.setTextColor(...(hecho ? AMARI : GRIS2));
        doc.setFontSize(hecho ? 9 : 7);
        doc.setFont('helvetica', 'bold');
        doc.text(hecho ? '★' : '☆', xPos + col.w / 2, yFila + FILA_H / 2 + 2.8, { align: 'center' });
        xPos += col.w;
      });

      yFila += FILA_H;
    });

    doc.setDrawColor(...AMARI);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yFila + 2, W - MARGIN, yFila + 2);
    doc.setTextColor(...GRIS);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cero Tenedor • Sistema de Capacitación Carl's Jr. • ${sucursal.toUpperCase()}`, MARGIN, H - 6);
    doc.text('Página 1', W - MARGIN, H - 6, { align: 'right' });

    const ahora     = new Date();
    const nombreArc = `StarPerformance_${sucursal.replace(/\s/g, '_')}_${ahora.toISOString().split('T')[0]}.pdf`;
    doc.save(nombreArc);

  } catch (err) {
    console.error('Error generando PDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '📄 Exportar PDF'; btn.disabled = false; }
  }
}
