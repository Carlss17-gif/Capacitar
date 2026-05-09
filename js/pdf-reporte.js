
/**
 * Genera el PDF de reporte para un empleado.
 *
 * @param {object} empleadoObj  — { nombre, entrenador, sucursal, distrito, fecha_ingreso }
 * @param {Array}  resultados   — array de registros de resultados_examen del empleado
 */
async function generarPDF(empleadoObj, resultados) {
  if (!empleadoObj || !empleadoObj.nombre) {
    alert('⚠️ No hay empleado seleccionado. Selecciona un empleado antes de generar el PDF.');
    return;
  }
  if (!resultados || resultados.length === 0) {
    alert('⚠️ Este empleado no tiene resultados de exámenes registrados.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const empleado = empleadoObj;
  const marginX  = 15;
  const maxWidth = 180;
  let y;

  // ── PORTADA ──────────────────────────────────────────────────
  pdf.setFillColor(0, 0, 0);
  pdf.rect(0, 0, 210, 297, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');

  pdf.setFontSize(26);
  pdf.text('REPORTE DE EVALUACIÓN', 105, 80, { align: 'center' });

  pdf.setFontSize(18);
  pdf.text(empleado.nombre || '', 105, 110, { align: 'center' });

  pdf.setFontSize(14);
  pdf.text(`Entrenador: ${empleado.entrenador || '—'}`,       105, 125, { align: 'center' });
  pdf.text(`Sucursal: ${empleado.sucursal || '—'}`,           105, 140, { align: 'center' });
  pdf.text(`Distrito: ${empleado.distrito || '—'}`,           105, 155, { align: 'center' });
  pdf.text(`Fecha de Ingreso: ${empleado.fecha_ingreso || '—'}`, 105, 170, { align: 'center' });

  // ── CARGAR DATOS EXTERNOS ────────────────────────────────────
  let examenesJSON = {};
  try {
    const res = await fetch('examenes.json');
    examenesJSON = await res.json();
  } catch (e) {
    console.warn('No se pudo cargar examenes.json:', e);
  }

  // Habilidades del empleado (la más reciente por área)
  const { data: habilidadesData } = await mysupabase
    .from('resultados_habilidades')
    .select('*')
    .eq('nombre', empleado.nombre)
    .order('created_at', { ascending: false });

  // Normaliza texto para comparar áreas sin importar acentos, mayúsculas o palabras extra
  const normArea = s => (s || '').toLowerCase()
    .normalize('NFC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Indexar habilidades por área normalizada (la más reciente por área)
  const habilidadesPorAreaNorm = {};
  (habilidadesData || []).forEach(h => {
    const key = normArea(h.area);
    if (!habilidadesPorAreaNorm[key]) habilidadesPorAreaNorm[key] = h;
  });

  // Helper para buscar habilidad por área aunque los nombres no sean idénticos
  const buscarHabilidad = (area) => {
    // 1. Coincidencia exacta normalizada
    const key = normArea(area);
    if (habilidadesPorAreaNorm[key]) return habilidadesPorAreaNorm[key];
    // 2. Coincidencia parcial: el área de habilidades está contenida en el área del examen o viceversa
    for (const [k, h] of Object.entries(habilidadesPorAreaNorm)) {
      if (key.includes(k) || k.includes(key)) return h;
      // 3. Coincidencia por palabras clave (al menos 3 palabras en común)
      const palabrasKey  = key.split(' ').filter(p => p.length > 3);
      const palabrasArea = k.split(' ').filter(p => p.length > 3);
      const comunes = palabrasKey.filter(p => palabrasArea.includes(p));
      if (comunes.length >= 2) return h;
    }
    return null;
  };

  // Una entrada por área (la más reciente)
  const areasUnicas = [...new Map(resultados.map(r => [r.area, r])).values()];

  // ── PÁGINAS POR ÁREA ─────────────────────────────────────────
  for (const registro of areasUnicas) {
    const examenBase = examenesJSON[registro.examen];
    if (!examenBase) continue;

    // — Página de conocimientos —
    pdf.addPage();
    y = 25;
    y = await _agregarEncabezado(pdf, `Examen de Conocimientos — ${registro.area}`, marginX, maxWidth, y);

    pdf.setFontSize(9);
    pdf.setLineHeightFactor(1.1);

    examenBase.preguntas.forEach((p, i) => {
      let respUsuario = registro.respuestas[i];
      let correcta    = '';

      if (p.tipo === 'opcion') {
        correcta     = p.opciones[p.correcta];
        respUsuario  = p.opciones[respUsuario] || 'Sin responder';
      } else {
        correcta = 'Respuesta abierta';
      }

      const esCorrecta = respUsuario === correcta;
      const pregSplit  = pdf.splitTextToSize(`${i + 1}. ${p.texto}`, maxWidth);

      if (y + pregSplit.length * 4.5 + 12 > 255) { pdf.addPage(); y = 25; }

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(pregSplit, marginX, y);
      y += pregSplit.length * 4.5 + 1;

      pdf.setFont('helvetica', 'normal');
      const respSplit = pdf.splitTextToSize(`Tu respuesta: ${respUsuario}`, maxWidth);
      pdf.setTextColor(esCorrecta ? 0 : 200, esCorrecta ? 0 : 38, esCorrecta ? 0 : 38);
      pdf.text(respSplit, marginX, y);
      y += respSplit.length * 4 + 1;

      pdf.setFont('helvetica', 'italic');
      const corrSplit = pdf.splitTextToSize(`Correcta: ${correcta}`, maxWidth);
      pdf.setTextColor(0, 0, 0);
      pdf.text(corrSplit, marginX, y);
      y += corrSplit.length * 4 + 4;

      pdf.setFont('helvetica', 'normal');
    });

    _agregarPieDePagina(pdf, empleado, examenBase.preguntas.length);

    // — Página de habilidades —
    pdf.addPage();
    y = 25;
    y = await _agregarEncabezado(pdf, `Evaluación de Habilidades — ${registro.area}`, marginX, maxWidth, y);

    const habRegistro = buscarHabilidad(registro.area);

    if (!habRegistro) {
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Sin evaluación de habilidades registrada para esta área.', marginX, y);
      y += 10;
    } else {
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);

      // Cabecera tabla
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(230, 230, 230);
      pdf.rect(marginX, y, 140, 7, 'F');
      pdf.rect(155,     y,  20, 7, 'F');
      pdf.rect(176,     y,  19, 7, 'F');
      pdf.text('Habilidad', marginX + 2, y + 5);
      pdf.text('Cumple',    156,         y + 5);
      pdf.text('Mejorar',   177,         y + 5);
      y += 8;

      habRegistro.habilidades.forEach((h, i) => {
        if (y + 8 > 255) { pdf.addPage(); y = 25; }

        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(marginX, y, 180, 7, 'F');
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const texto = h.habilidad.length > 70 ? h.habilidad.substring(0, 70) + '…' : h.habilidad;
        pdf.text(`${i + 1}. ${texto}`, marginX + 2, y + 5);

        if (h.resultado === 'cumple') {
          pdf.setTextColor(34, 197, 94);
          pdf.setFont('helvetica', 'bold');
          pdf.text('✓', 162, y + 5);
        }
        if (h.resultado === 'mejora') {
          pdf.setTextColor(239, 68, 68);
          pdf.setFont('helvetica', 'bold');
          pdf.text('✗', 183, y + 5);
        }

        pdf.setTextColor(0, 0, 0);
        y += 7;
      });

      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Calificación Final: ${habRegistro.cumple} / ${habRegistro.total}`, marginX, y);
      pdf.text(`(Puntaje para pasar = ${habRegistro.total - 1})`, marginX + 80, y);
      y += 7;

      const estadoColor = habRegistro.aprobado ? [34, 197, 94] : [239, 68, 68];
      pdf.setTextColor(...estadoColor);
      pdf.text(habRegistro.aprobado ? 'CERTIFICADO' : 'NECESITA MÁS PRÁCTICA', marginX, y);
      pdf.setTextColor(0, 0, 0);
      y += 10;

      if (habRegistro.plan_accion) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
        pdf.text('Plan de acción:', marginX, y); y += 5;
        pdf.setFont('helvetica', 'normal');
        const planSplit = pdf.splitTextToSize(habRegistro.plan_accion, maxWidth);
        pdf.text(planSplit, marginX, y);
        y += planSplit.length * 4.5 + 4;
      }

      if (habRegistro.comentarios) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
        pdf.text('Comentarios del entrenador:', marginX, y); y += 5;
        pdf.setFont('helvetica', 'normal');
        const comSplit = pdf.splitTextToSize(habRegistro.comentarios, maxWidth);
        pdf.text(comSplit, marginX, y);
        y += comSplit.length * 4.5 + 4;
      }

      y += 5;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
      pdf.line(marginX, y + 8, 90,  y + 8);
      pdf.line(115,     y + 8, 195, y + 8);
      pdf.text('Firma del Aprendiz',   marginX, y + 13);
      pdf.text('Firma del Entrenador', 115,     y + 13);
    }

    _agregarPieDePagina(pdf, empleado, 0);
  }

  pdf.save(`Reporte_${empleado.nombre.replace(/\s+/g, '_') || 'empleado'}.pdf`);
}

// ── HELPERS INTERNOS ──────────────────────────────────────────

async function _agregarEncabezado(pdf, titulo, marginX, maxWidth, y) {
  const logoUrl   = 'logo.png';
  const imgWidth  = 30;
  const imgHeight = 15;
  const lineH     = 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(0, 0, 0);

  const split      = pdf.splitTextToSize(titulo, maxWidth - 40);
  const textHeight = split.length * lineH;
  const blockH     = Math.max(textHeight, imgHeight);
  const textY      = y + (blockH - textHeight) / 2 + 4;
  const imgY       = y + (blockH - imgHeight) / 2;

  split.forEach((linea, idx) => pdf.text(linea, marginX, textY + idx * lineH));

  try {
    const img = await _loadImageAsDataUrl(logoUrl);
    pdf.addImage(img, 'PNG', 210 - marginX - imgWidth, imgY, imgWidth, imgHeight);
  } catch (_) {}

  y += blockH + 6;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, 210 - marginX, y);
  return y + 6;
}

function _agregarPieDePagina(pdf, empleado, totalPreguntas) {
  const yPie    = 265;
  const marginX = 15;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.7);
  pdf.rect(marginX, yPie, 180, 30, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  let y = yPie + 6;
  if (totalPreguntas > 0) {
    pdf.text(`Calificación Final: _______ (Puntaje aprobatorio = ${totalPreguntas - 1})`, marginX + 3, y);
    y += 6;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Nombre: ${empleado.nombre || ''}`,         marginX + 3, y);
  pdf.text(`Entrenador: ${empleado.entrenador || ''}`, marginX + 3, y + 6);

  const rx = 105;
  pdf.text(`Sucursal: ${empleado.sucursal || ''}`,             rx, y);
  pdf.text(`Distrito: ${empleado.distrito || ''}`,             rx, y + 6);
  pdf.text(`Fecha de Ingreso: ${empleado.fecha_ingreso || ''}`, rx, y + 12);
}

function _loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload  = () => {
      const c = document.createElement('canvas');
      c.width  = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src     = url;
  });
}
