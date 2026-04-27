// ╔══════════════════════════════════════════════════════════════╗
// ║  excel-matriz.js — Star Performance → Excel (.xlsx)         ║
// ║  Mismos colores oscuros, estrellas y formato que el PDF      ║
// ╚══════════════════════════════════════════════════════════════╝

async function generarExcelMatriz() {
  const sesion = getSesionEntrenador();
  if (!sesion) { alert('Sin sesión de entrenador'); return; }

  const sucursal  = sesion.sucursal || '';
  const nombreEnt = sesion.nombre   || 'Entrenador';

  if (!sucursal) {
    alert('Tu perfil no tiene sucursal asignada. Contacta al administrador.');
    return;
  }

  const btn = document.getElementById('btnExcelMatriz');
  if (btn) { btn.textContent = '⏳ Generando Excel…'; btn.disabled = true; }

  try {
    // ── 1. OBTENER DATOS (igual que el PDF) ──────────────────────
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
      nombre:     e.nombre     || '—',
      entrenador: e.entrenador || '—',
      ingreso:    formatFecha(e.fecha_ingreso),
      star:       mapaStars[e.id] || {},
    }));

    // ── 2. COLUMNAS Y GRUPOS ─────────────────────────────────────
    const cols = COLUMNAS_STAR; // del modulos.js

    // ── 3. CONSTRUIR WORKBOOK CON SheetJS ────────────────────────
    const XLSX = window.XLSX;
    if (!XLSX) { alert('Librería SheetJS no disponible'); return; }

    const wb  = XLSX.utils.book_new();
    const aoa = []; // Array of Arrays

    // ── PALETA (ARGB hex, formato SheetJS: AARRGGBB) ─────────────
    const C = {
      negro:        '0D0D0D',
      negro2:       '1A1A1A',
      negro3:       '242424',
      amarillo:     'FFDE21',
      rojo:         'D32F2F',
      azul:         '1565C0',
      verde:        '2E7D32',
      morado:       '6A1B9A',
      blanco:       'F5F5F5',
      gris:         '888888',
      grisOsc:      '323232',
      starOn:       'FFDE21',
      starOff:      '3A3A3A',
    };

    // Color de fondo por grupo
    const GRUPO_BG = { ob: C.rojo, bl: C.rojo, fl: C.azul, ct: C.verde };

    // ── HELPER: celda con estilo completo ────────────────────────
    function cel(v, bg, fg, bold, align, border) {
      return {
        v,
        t: 's',
        s: {
          fill:      { patternType: 'solid', fgColor: { rgb: bg || C.negro2 } },
          font:      { name: 'Arial', sz: 9, bold: !!bold, color: { rgb: fg || C.blanco } },
          alignment: { horizontal: align || 'left', vertical: 'center', wrapText: false },
          border: border ? {
            top:    { style: 'thin', color: { rgb: '3A3A3A' } },
            bottom: { style: 'thin', color: { rgb: '3A3A3A' } },
            left:   { style: 'thin', color: { rgb: '3A3A3A' } },
            right:  { style: 'thin', color: { rgb: '3A3A3A' } },
          } : undefined,
        },
      };
    }

    // ── FILA 0: Título principal ─────────────────────────────────
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    aoa.push([
      cel(`STAR PERFORMANCE — CARL'S JR. | ${sucursal.toUpperCase()}`, C.amarillo, C.negro, true, 'left'),
      ...Array(3 + cols.length).fill(cel('', C.amarillo, C.negro)),
      cel('Generado: ' + fecha, C.amarillo, C.negro, false, 'right'),
    ]);

    // ── FILA 1: Entrenador / total ───────────────────────────────
    aoa.push([
      cel(`Entrenador: ${nombreEnt}   |   Total empleados: ${filas.length}`, C.negro3, C.gris, false, 'left'),
      ...Array(3 + cols.length).fill(cel('', C.negro3, C.gris)),
      cel('', C.negro3),
    ]);

    // ── FILA 2: vacía (separador) ────────────────────────────────
    aoa.push([]);

    // ── FILA 3: Encabezados de GRUPO ─────────────────────────────
    const gruposOrden = ['ob', 'bl', 'fl', 'ct'];
    const grupoRow = [
      cel('', C.grisOsc),
      cel('', C.grisOsc),
      cel('', C.grisOsc),
      cel('', C.grisOsc),
    ];
    gruposOrden.forEach(g => {
      const colsG = cols.filter(c => c.grupo === g);
      if (!colsG.length) return;
      grupoRow.push(cel(GRUPOS_STAR[g].label.toUpperCase(), GRUPO_BG[g], C.blanco, true, 'center', true));
      for (let i = 1; i < colsG.length; i++) {
        grupoRow.push(cel('', GRUPO_BG[g], C.blanco));
      }
    });
    grupoRow.push(cel('%', C.grisOsc, C.amarillo, true, 'center'));
    aoa.push(grupoRow);

    // ── FILA 4: Encabezados de COLUMNA ───────────────────────────
    const headerRow = [
      cel('FECHA INGRESO', C.grisOsc, C.amarillo, true, 'center', true),
      cel('NOMBRE DEL EMPLEADO', C.grisOsc, C.amarillo, true, 'center', true),
      cel('ENTRENADOR', C.grisOsc, C.amarillo, true, 'center', true),
      cel('SUCURSAL', C.grisOsc, C.amarillo, true, 'center', true),
    ];
    cols.forEach(col => {
      const bg = GRUPO_BG[col.grupo] || C.grisOsc;
      headerRow.push(cel(col.label, bg + '99' in C ? bg : C.grisOsc, C.blanco, true, 'center', true));
    });
    headerRow.push(cel('% AVANCE', C.grisOsc, C.amarillo, true, 'center', true));
    aoa.push(headerRow);

    // ── FILAS DE EMPLEADOS ────────────────────────────────────────
    filas.forEach(({ nombre, entrenador, ingreso, star }, idx) => {
      const bg = idx % 2 === 0 ? C.negro2 : C.negro3;
      const row = [
        cel(ingreso,    bg, C.gris,   false, 'center', true),
        cel(nombre,     bg, C.blanco, true,  'left',   true),
        cel(entrenador, bg, C.gris,   false, 'left',   true),
        cel(sucursal,   bg, C.gris,   false, 'left',   true),
      ];

      let doneCt = 0;
      cols.forEach(col => {
        const hecho = !!star[col.id];
        if (hecho) doneCt++;
        const starBg  = hecho ? '1A1A0A' : bg;
        const starFg  = hecho ? C.amarillo : C.starOff;
        row.push(cel(hecho ? '★' : '☆', starBg, starFg, true, 'center', true));
      });

      const pct = cols.length ? Math.round((doneCt / cols.length) * 100) : 0;
      const pctFg = pct >= 80 ? '4CAF50' : pct >= 50 ? C.amarillo : C.rojo;
      row.push(cel(`${pct}%`, bg, pctFg, true, 'center', true));
      aoa.push(row);
    });

    // ── FILA PROMEDIO SUCURSAL ────────────────────────────────────
    const totRow = [
      cel('', C.grisOsc),
      cel('PROMEDIO SUCURSAL', C.grisOsc, C.amarillo, true, 'left', true),
      cel('', C.grisOsc),
      cel('', C.grisOsc),
    ];
    let sumPct = 0;
    cols.forEach(col => {
      const cnt  = filas.filter(f => !!f.star[col.id]).length;
      const pct  = filas.length ? Math.round((cnt / filas.length) * 100) : 0;
      sumPct += pct;
      const bg   = GRUPO_BG[col.grupo] || C.grisOsc;
      totRow.push(cel(`${cnt}/${filas.length}`, C.grisOsc, C.blanco, true, 'center', true));
    });
    const avgPct   = cols.length ? Math.round(sumPct / cols.length) : 0;
    const avgColor = avgPct >= 80 ? '4CAF50' : avgPct >= 50 ? C.amarillo : C.rojo;
    totRow.push(cel(`${avgPct}%`, C.grisOsc, avgColor, true, 'center', true));
    aoa.push(totRow);

    // ── FILA FINAL: pie ──────────────────────────────────────────
    aoa.push([]);
    aoa.push([
      cel(`Cero Tenedor • Sistema de Capacitación Carl's Jr. • ${sucursal.toUpperCase()}`, C.negro, C.gris, false, 'left'),
      ...Array(3 + cols.length).fill(cel('', C.negro)),
      cel('', C.negro),
    ]);

    // ── 4. CREAR HOJA ─────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // ── 5. ANCHOS DE COLUMNA ──────────────────────────────────────
    ws['!cols'] = [
      { wch: 14 },  // fecha ingreso
      { wch: 28 },  // nombre
      { wch: 20 },  // entrenador
      { wch: 18 },  // sucursal
      ...cols.map(() => ({ wch: 12 })),
      { wch: 10 },  // %
    ];

    // ── 6. ALTO DE FILAS ──────────────────────────────────────────
    ws['!rows'] = [
      { hpt: 22 },  // título
      { hpt: 14 },  // subtítulo
      { hpt: 6  },  // separador
      { hpt: 18 },  // grupos
      { hpt: 16 },  // headers
      ...filas.map(() => ({ hpt: 16 })),
      { hpt: 16 },  // totales
    ];

    // ── 7. MERGE CELLS ────────────────────────────────────────────
    const merges = [];

    // Fila 0 (título): A1 hasta penúltima, última col separada
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 + cols.length - 1 } });

    // Fila 1 (entrenador): merge todo
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 + cols.length } });

    // Fila 3 (grupos): merge por cada grupo
    let colOffset = 4; // 4 cols fijas
    // Merge cols fijas (fecha+nombre+entrenador+sucursal)
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 3 } });
    gruposOrden.forEach(g => {
      const colsG = cols.filter(c => c.grupo === g);
      if (colsG.length > 1) {
        merges.push({ s: { r: 3, c: colOffset }, e: { r: 3, c: colOffset + colsG.length - 1 } });
      }
      colOffset += colsG.length;
    });

    // Fila final pie: merge todo
    const lastRow = aoa.length - 1;
    merges.push({ s: { r: lastRow, c: 0 }, e: { r: lastRow, c: 3 + cols.length } });

    ws['!merges'] = merges;

    // ── 8. GUARDAR ────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, ws, 'Star Performance');

    const ahora     = new Date();
    const nombreArc = `StarPerformance_${sucursal.replace(/\s/g, '_')}_${ahora.toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nombreArc);

  } catch (err) {
    console.error('Error generando Excel:', err);
    alert('Error al generar Excel: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '📊 Excel'; btn.disabled = false; }
  }
}
