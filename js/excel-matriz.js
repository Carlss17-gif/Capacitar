
const XL = {
  NEG:"0D0D0D", NEG2:"181818", NEG3:"222222",
  AMAR:"FFDE21", ROJO:"C8102E", AZUL:"1565C0",
  VERDE:"2E7D32", BLANC:"F5F5F5", GRIS:"888888", GRIS2:"444444",
  GRP:{ ob:"C8102E", bl:"8B0000", fl:"1565C0", ct:"2E7D32" },
};

// ── COLUMNAS STAR PERFORMANCE ────────────────────────────────────────
const SP_GRUPOS = [
  { id:"ob", label:"ORIENTACIÓN",              color:XL.GRP.ob, sub:"", cols:[
    { id:"ob_onboarding",  label:"Onboarding /\nOrientación" },
  ]},
  { id:"bl", label:"BACKLINE / PRODUCCIÓN",    color:XL.GRP.bl, sub:"", cols:[
    { id:"bl_freidoras",  label:"Fry\nStation"    },
    { id:"bl_feeder",     label:"Feeder\nStation" },
    { id:"bl_cocina",     label:"Cook\nStation"   },
    { id:"bl_tenders",    label:"Chicken Tenders\nStation" },
  ]},
  { id:"fl", label:"FRONTLINE / HOSPITALIDAD", color:XL.GRP.fl, sub:"", cols:[
    { id:"fl_comedor",      label:"Dining Room\nStation"           },
    { id:"fl_cajero",       label:"Cashier\nStation"               },
    { id:"fl_autoservicio", label:"Drive-Thru\nStation"            },
    { id:"fl_drive_speed",  label:"Drive-Thru Speed\nCertification"},
  ]},
  { id:"ct", label:"CREW TRAINER",             color:XL.GRP.ct, sub:"", cols:[
    { id:"ct_backline",  label:"Crew Trainer –\nBACKLINE"  },
    { id:"ct_frontline", label:"Crew Trainer –\nFRONTLINE" },
    { id:"ct_pic",       label:"Centerpost\n(PIC)"         },
  ]},
];
const SP_ALL = SP_GRUPOS.flatMap(g => g.cols);

// ── COLUMNAS MATRIZ (más completas, como el xlsx de referencia) ──────
const MZ_GRUPOS = [
  { id:"ob", label:"ORIENTACIÓN",   color:XL.GRP.ob, sub:"", cols:[
    { id:"ob_onboarding", label:"Onboarding / Orientación\nChecklist Completed" },
  ]},
  { id:"bl", label:"BACKLINE",       color:XL.GRP.bl, sub:"PRODUCTION", cols:[
    { id:"bl_freidoras",  label:"Fry Station"             },
    { id:"bl_feeder",     label:"Feeder Station"          },
    { id:"bl_cocina",     label:"Cook Station"            },
    { id:"bl_grill",      label:"Grill Station"           },
    { id:"bl_burrito",    label:"Green Burrito Station"   },
    { id:"bl_tenders",    label:"Chicken Tenders Station" },
    { id:"bl_biscuits",   label:"Biscuits Station"        },
  ]},
  { id:"fl", label:"FRONTLINE",      color:XL.GRP.fl, sub:"HOSPITALITY", cols:[
    { id:"fl_comedor",      label:"Dining Room Station"                 },
    { id:"fl_cajero",       label:"Cashier Station"                     },
    { id:"fl_autoservicio", label:"Drive-Thru Station"                  },
    { id:"fl_drive_speed",  label:"Drive-Thru Speed Team Certification" },
  ]},
  { id:"ct", label:"CREW TRAINER",   color:XL.GRP.ct, sub:"", cols:[
    { id:"ct_backline",  label:"Crew Trainer – BACKLINE"                       },
    { id:"ct_frontline", label:"Crew Trainer – FRONTLINE"                      },
    { id:"ct_pic",       label:"Centerpost Position\n(Certified to cover PIC)" },
  ]},
];
const MZ_ALL = MZ_GRUPOS.flatMap(g => g.cols);

// ════════════════════════════════════════════════════════════════════
// Helper: celda con estilo completo para SheetJS
// ════════════════════════════════════════════════════════════════════
function _xc(v, bg, fg, bold, halign, sz, wrap, rot, outer) {
  const s = { style:"thin", color:{ rgb:"2A2A2A" } };
  const m = { style:"medium", color:{ rgb:"FFDE21" } };
  const b = outer
    ? { top:m, bottom:m, left:m, right:m }
    : { top:s, bottom:s, left:s, right:s };
  return {
    v, t:"s",
    s:{
      fill:      { patternType:"solid", fgColor:{ rgb: bg||XL.NEG2 } },
      font:      { name:"Arial", sz:sz||9, bold:!!bold, color:{ rgb: fg||XL.BLANC } },
      alignment: { horizontal:halign||"center", vertical:"center",
                   wrapText:!!wrap, textRotation:rot||0 },
      border: b,
    },
  };
}
function _xe(bg){ return { v:"", t:"s", s:{
  fill:{ patternType:"solid", fgColor:{ rgb:bg||XL.NEG2 } },
  font:{ name:"Arial", sz:9, color:{ rgb:bg||XL.NEG2 } },
  alignment:{ horizontal:"center", vertical:"center" },
}}; }

async function _fetchData(sesion) {
  const { data: emps, error } = await mysupabase
    .from("empleados")
    .select("id, nombre, fecha_ingreso, entrenador, sucursal")
    .eq("sucursal", sesion.sucursal||"")
    .order("nombre");
  if (error || !emps?.length) return null;

  const ids = emps.map(e => e.id);
  const { data: stars } = await queryStarPerformance(ids);
  const mapa = {};
  (stars||[]).forEach(s => { mapa[s.empleado_id] = s; });

  return emps.map(e => ({
    nombre:     e.nombre     || "—",
    entrenador: e.entrenador || "—",
    ingreso:    formatFecha(e.fecha_ingreso),
    star:       mapa[e.id]   || {},
  }));
}

function _buildHoja(filas, grupos, allCols, sesion, titulo) {
  const suc  = sesion.sucursal || "";
  const ent  = sesion.nombre   || "Entrenador";
  const hoy  = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"2-digit"});
  const FIXED = 3;
  const TOT   = FIXED + allCols.length + 1;
  const aoa   = [];
  const mrg   = [];

  // ── Fila 1: banner ──────────────────────────────────────────
  aoa.push([
    _xc(`${titulo}  —  ${suc.toUpperCase()}`, XL.NEG, XL.AMAR, true, "left", 13),
    ...Array(TOT-2).fill(_xe(XL.NEG)),
    _xc(`Generado: ${hoy}`, XL.NEG, XL.GRIS, false, "right", 8),
  ]);
  mrg.push({ s:{r:0,c:0}, e:{r:0,c:TOT-2} });

  // ── Fila 2: sub-info ─────────────────────────────────────────
  aoa.push([
    _xc(`Entrenador: ${ent}   |   Total empleados: ${filas.length}`, XL.NEG3, XL.GRIS, false, "left", 8),
    ...Array(TOT-1).fill(_xe(XL.NEG3)),
  ]);
  mrg.push({ s:{r:1,c:0}, e:{r:1,c:TOT-1} });

  // ── Fila 3: separador ────────────────────────────────────────
  aoa.push(Array(TOT).fill(_xe(XL.NEG)));

  // ── Fila 4: grupos ───────────────────────────────────────────
  const grpRow = [_xe(XL.NEG2), _xe(XL.NEG2), _xe(XL.NEG2)];
  mrg.push({ s:{r:3,c:0}, e:{r:3,c:FIXED-1} });
  let ci = FIXED;
  grupos.forEach(g => {
    const n   = g.cols.length;
    const lbl = g.sub ? `${g.label}\n${g.sub}` : g.label;
    grpRow.push(_xc(lbl, g.color, "FFFFFF", true, "center", 8, true));
    for (let i=1;i<n;i++) grpRow.push(_xe(g.color));
    if (n>1) mrg.push({ s:{r:3,c:ci}, e:{r:3,c:ci+n-1} });
    ci += n;
  });
  grpRow.push(_xe(XL.NEG2));
  aoa.push(grpRow);

  // ── Fila 5: headers rotados ──────────────────────────────────
  const hRow = [
    _xc("FECHA\nINGRESO",        XL.NEG2, XL.AMAR, true, "center", 8, true),
    _xc("NOMBRE DEL EMPLEADO",   XL.NEG2, XL.AMAR, true, "center", 9, true),
    _xc("ENTRENADOR",            XL.NEG2, XL.AMAR, true, "center", 8, true),
  ];
  ci = FIXED;
  grupos.forEach(g => {
    g.cols.forEach(col => {
      hRow.push(_xc(col.label, g.color, "FFFFFF", true, "center", 7, false, 90));
      ci++;
    });
  });
  hRow.push(_xc("%\nAVANCE", XL.NEG2, XL.AMAR, true, "center", 9, true));
  aoa.push(hRow);

  // ── Filas empleados ─────────────────────────────────────────
  filas.forEach((emp, i) => {
    const bg   = i%2===0 ? XL.NEG2 : XL.NEG3;
    const done = allCols.filter(c => emp.star[c.id]).length;
    const pct  = allCols.length ? Math.round(done/allCols.length*100) : 0;
    const pFg  = pct>=80 ? "4CAF50" : pct>=50 ? XL.AMAR : XL.ROJO;

    const row = [
      _xc(emp.ingreso,    bg, XL.GRIS,  false, "center", 8),
      _xc(emp.nombre,     bg, XL.BLANC, true,  "left",   9),
      _xc(emp.entrenador, bg, XL.GRIS,  false, "left",   8),
    ];
    grupos.forEach(g => {
      g.cols.forEach(col => {
        const ok = !!emp.star[col.id];
        row.push(_xc(ok?"★":"☆", ok?"1C1A00":bg, ok?XL.AMAR:XL.GRIS2, true, "center", 11));
      });
    });
    row.push(_xc(`${pct}%`, bg, pFg, true, "center", 9));
    aoa.push(row);
  });

  // ── Fila totales ─────────────────────────────────────────────
  const tRow = [
    _xc("",                 XL.NEG2, XL.AMAR, true, "left", 9, false, 0, true),
    _xc("PROMEDIO SUCURSAL",XL.NEG2, XL.AMAR, true, "left", 9, false, 0, true),
    _xc("",                 XL.NEG2, XL.AMAR, false,"center",8,false,0, true),
  ];
  mrg.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:2} });
  let spct = 0;
  allCols.forEach(col => {
    const cnt = filas.filter(e => e.star[col.id]).length;
    const p   = filas.length ? Math.round(cnt/filas.length*100) : 0;
    spct += p;
    tRow.push(_xc(`${cnt}/${filas.length}`, XL.NEG2, "FFFFFF", true, "center", 7, false, 0, true));
  });
  const avg = allCols.length ? Math.round(spct/allCols.length) : 0;
  tRow.push(_xc(`${avg}%`, XL.NEG2, avg>=80?"4CAF50":avg>=50?XL.AMAR:XL.ROJO, true, "center", 10, false, 0, true));
  aoa.push(tRow);

  // ── Pie ──────────────────────────────────────────────────────
  aoa.push(Array(TOT).fill(_xe(XL.NEG)));
  const pieR = aoa.length;
  aoa.push([
    _xc(`Cero Tenedor  •  Sistema de Capacitación Carl's Jr.  •  ${suc.toUpperCase()}`, XL.NEG, XL.GRIS2, false, "left", 7),
    ...Array(TOT-1).fill(_xe(XL.NEG)),
  ]);
  mrg.push({ s:{r:pieR,c:0}, e:{r:pieR,c:TOT-1} });

  // ── Crear hoja ───────────────────────────────────────────────
  const ws = window.XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = mrg;
  ws["!cols"] = [
    { wch:11 }, { wch:28 }, { wch:19 },
    ...allCols.map(()=>({ wch:4.5 })),
    { wch:9 },
  ];
  ws["!rows"] = [
    { hpt:24 }, { hpt:14 }, { hpt:4 }, { hpt:18 }, { hpt:85 },
    ...filas.map(()=>({ hpt:16 })),
    { hpt:22 }, { hpt:4 }, { hpt:12 },
  ];
  return ws;
}

async function generarExcelStarPerformance() {
  const sesion = getSesionEntrenador();
  if (!sesion)           { alert("Sin sesión de entrenador"); return; }
  if (!sesion.sucursal)  { alert("Tu perfil no tiene sucursal asignada. Contacta al administrador."); return; }
  if (!window.XLSX)      { alert("SheetJS no disponible"); return; }

  const btn = document.getElementById("btnExcelStar");
  if (btn) { btn.textContent = "⏳ Generando…"; btn.disabled = true; }

  try {
    const filas = await _fetchData(sesion);
    if (!filas) { alert("No hay empleados para: " + sesion.sucursal); return; }

    const ws = _buildHoja(filas, SP_GRUPOS, SP_ALL, sesion, "STAR PERFORMANCE");
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Star Performance");

    const d = new Date().toISOString().split("T")[0];
    window.XLSX.writeFile(wb, `StarPerformance_${(sesion.sucursal||"").replace(/\s/g,"_")}_${d}.xlsx`);
  } catch(e) {
    console.error(e); alert("Error: " + e.message);
  } finally {
    if (btn) { btn.textContent = "📊 Excel SP"; btn.disabled = false; }
  }
}

async function generarExcelMatriz() {
  const sesion = getSesionEntrenador();
  if (!sesion)           { alert("Sin sesión de entrenador"); return; }
  if (!sesion.sucursal)  { alert("Tu perfil no tiene sucursal asignada. Contacta al administrador."); return; }
  if (!window.XLSX)      { alert("SheetJS no disponible"); return; }

  const btn = document.getElementById("btnExcelMatriz");
  if (btn) { btn.textContent = "⏳ Generando…"; btn.disabled = true; }

  try {
    const filas = await _fetchData(sesion);
    if (!filas) { alert("No hay empleados para: " + sesion.sucursal); return; }

    const ws = _buildHoja(filas, MZ_GRUPOS, MZ_ALL, sesion, "MATRIZ DE CAPACITACIÓN");
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Matriz");

    const d = new Date().toISOString().split("T")[0];
    window.XLSX.writeFile(wb, `Matriz_${(sesion.sucursal||"").replace(/\s/g,"_")}_${d}.xlsx`);
  } catch(e) {
    console.error(e); alert("Error: " + e.message);
  } finally {
    if (btn) { btn.textContent = "📊 Excel MZ"; btn.disabled = false; }
  }
}
