/* ============================================================
   pdf-matriz.js — Star Performance + Matriz PDF
   Carl's Jr. — fondo blanco, estrellas con texto
   ============================================================ */

function _normSuc(s) {
  return (s||'').toLowerCase().normalize('NFC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').trim();
}

async function _traerFilas(sesion) {
  const sucNorm = _normSuc(sesion.sucursal||'');
  const {data:todos} = await mysupabase.from('empleados')
    .select('id,nombre,fecha_ingreso,entrenador,sucursal,activo').order('fecha_ingreso');
  const emps = (todos||[]).filter(e=>e.activo!==false && _normSuc(e.sucursal||'')===sucNorm);
  if(!emps.length) return [];
  const ids = emps.map(e=>e.id);
  const {data:stars} = await queryStarPerformance(ids);
  const mapa = {}; (stars||[]).forEach(s=>{ mapa[s.empleado_id]=s; });
  return emps.map(e=>({emp:e, star:mapa[e.id]||{}}));
}

function _fecha(f){
  if(!f) return '--';
  const d=new Date(f+'T00:00:00');
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+String(d.getFullYear()).slice(-2);
}

// Dibuja celda con borde
function _celda(doc, x, y, w, h, bgRGB, borde){
  if(bgRGB){ doc.setFillColor(...bgRGB); doc.rect(x,y,w,h,'F'); }
  if(borde){ doc.setDrawColor(...borde); doc.setLineWidth(0.25); doc.rect(x,y,w,h,'S'); }
}

// ── STAR PERFORMANCE ─────────────────────────────────────────
async function generarPDFStarPerformance(){
  const sesion = (typeof getSesionEntrenador==='function'?getSesionEntrenador():null)
    || JSON.parse(localStorage.getItem('sesion_entrenador')||'{}');
  if(!sesion?.sucursal){alert('Sin sucursal en sesión.');return;}
  const btn=document.getElementById('btnPDFStar');
  if(btn){btn.textContent='⏳ Generando…';btn.disabled=true;}
  try{
    const filas=await _traerFilas(sesion);
    if(!filas.length){alert('Sin empleados activos.');return;}

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const W=297,H=210,MAR=6;

    const GC={ob:[46,125,50],bl:[198,40,40],fl:[21,101,192],ct:[46,125,50]};
    const GL={ob:'ORIENTACIÓN',bl:'BACKLINE / PRODUCCIÓN',fl:'FRONTLINE / HOSPITALIDAD',ct:'CREW TRAINER'};
    const COLS=COLUMNAS_STAR;
    const WF=15,WN=48,WP=11;
    const WS=(W-MAR*2-WF-WN-WP)/COLS.length;

    const _pag=()=>{
      doc.setFillColor(255,255,255); doc.rect(0,0,W,H,'F');
    };
    _pag();

    // Header amarillo
    doc.setFillColor(255,222,33); doc.rect(0,0,W,16,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(0,0,0);
    doc.text("CARL'S JR.",MAR+1,11);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('"Be A Star Performer!"',MAR+35,11);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(40,40,40);
    doc.text('SUCURSAL: '+(sesion.sucursal||'').toUpperCase(),W-MAR,7,{align:'right'});
    doc.text('Fecha: '+new Date().toLocaleDateString('es-MX'),W-MAR,13,{align:'right'});

    // Fila grupos
    const YG=17,HG=6;
    _celda(doc,MAR,YG,WF+WN-0.2,HG,[235,235,235],[180,180,180]);
    let xg=MAR+WF+WN;
    ['ob','bl','fl','ct'].forEach(g=>{
      const gcols=COLS.filter(c=>c.grupo===g); if(!gcols.length)return;
      const gw=gcols.length*WS;
      _celda(doc,xg,YG,gw-0.2,HG,GC[g],GC[g]);
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(5.5);
      doc.text(GL[g],xg+gw/2,YG+4,{align:'center'});
      xg+=gw;
    });
    _celda(doc,xg,YG,WP-0.2,HG,[235,235,235],[180,180,180]);

    // Fila cabeceras rotadas
    const YC=YG+HG,HC=26;
    _celda(doc,MAR,YC,WF-0.2,HC,[245,245,245],[180,180,180]);
    doc.setTextColor(60,60,60); doc.setFont('helvetica','bold'); doc.setFontSize(5.5);
    doc.text('HIRE\nDATE',MAR+WF/2,YC+HC/2-1,{align:'center'});
    _celda(doc,MAR+WF,YC,WN-0.2,HC,[245,245,245],[180,180,180]);
    doc.text('EMPLOYEE NAME',MAR+WF+WN/2,YC+HC/2+1,{align:'center'});

    let xc=MAR+WF+WN;
    COLS.forEach(col=>{
      const gc=GC[col.grupo];
      _celda(doc,xc,YC,WS-0.2,HC,[252,252,252],gc);
      // borde superior grueso con color de grupo
      doc.setDrawColor(...gc); doc.setLineWidth(0.8);
      doc.line(xc,YC,xc+WS-0.2,YC);
      doc.setLineWidth(0.25);
      // texto rotado
      doc.setTextColor(...gc); doc.setFont('helvetica','bold'); doc.setFontSize(4.8);
      const lbl=col.label.replace('/',' ').replace('  ',' ').trim().substring(0,14);
      doc.text(lbl,xc+WS/2,YC+HC-1.5,{align:'center',angle:90,rotationDirection:1});
      xc+=WS;
    });
    _celda(doc,xc,YC,WP-0.2,HC,[245,245,245],[150,150,150]);
    doc.setTextColor(0,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text('%',xc+WP/2,YC+HC-2,{align:'center'});

    // Filas empleados
    const FH=7.2;
    let yf=YC+HC;
    const tots={}; COLS.forEach(c=>{tots[c.id]=0;});

    filas.forEach(({emp,star},idx)=>{
      if(yf+FH>H-8){doc.addPage();_pag();yf=8;}
      const bg=idx%2===0?[255,255,255]:[246,246,246];
      doc.setFillColor(...bg); doc.rect(MAR,yf,W-MAR*2,FH,'F');
      doc.setDrawColor(215,215,215); doc.setLineWidth(0.15);
      doc.line(MAR,yf+FH,W-MAR,yf+FH);

      // Fecha
      doc.setTextColor(100,100,100); doc.setFont('helvetica','normal'); doc.setFontSize(6);
      doc.text(_fecha(emp.fecha_ingreso),MAR+WF/2,yf+FH/2+2,{align:'center'});
      // Nombre
      doc.setTextColor(15,15,15); doc.setFont('helvetica','bold'); doc.setFontSize(6.8);
      doc.text((emp.nombre||'').substring(0,30),MAR+WF+1.5,yf+FH/2+2.2);

      // Estrellas — usamos "filled circle" y "empty circle" que sí soporta helvetica
      let xs=MAR+WF+WN; let done=0;
      COLS.forEach(col=>{
        const ok=!!star[col.id];
        if(ok){done++;tots[col.id]++;}
        const gc=GC[col.grupo];
        if(ok){
          // fondo suave
          doc.setFillColor(gc[0]+170>255?255:gc[0]+170, gc[1]+170>255?255:gc[1]+170, gc[2]+170>255?255:gc[2]+170);
          doc.rect(xs,yf,WS-0.2,FH,'F');
        }
        // Usamos "l" para check y "-" para vacío, en colores del grupo
        doc.setFont('helvetica','bold'); doc.setFontSize(ok?8:7);
        doc.setTextColor(...(ok?gc:[210,210,210]));
        doc.text(ok?'*':'o',xs+WS/2,yf+FH/2+2.5,{align:'center'});
        xs+=WS;
      });

      // %
      const pct=COLS.length?Math.round(done/COLS.length*100):0;
      const pc=pct>=80?[46,125,50]:pct>=50?[200,130,0]:[198,40,40];
      doc.setTextColor(...pc); doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
      doc.text(pct+'%',xs+WP/2,yf+FH/2+2.5,{align:'center'});
      yf+=FH;
    });

    // Totales
    if(yf+FH+2>H-8){doc.addPage();_pag();yf=8;}
    doc.setDrawColor(0,0,0); doc.setLineWidth(0.5); doc.line(MAR,yf,W-MAR,yf);
    doc.setFillColor(240,240,240); doc.rect(MAR,yf,W-MAR*2,FH+1,'F');
    doc.setTextColor(0,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(6.2);
    doc.text('PROMEDIO SUCURSAL',MAR+WF+1.5,yf+(FH+1)/2+2);
    let xt=MAR+WF+WN; let sp=0;
    COLS.forEach(col=>{
      const cnt=tots[col.id];
      const p=filas.length?Math.round(cnt/filas.length*100):0; sp+=p;
      const pc=p>=80?[46,125,50]:p>=50?[200,130,0]:[198,40,40];
      doc.setTextColor(...pc); doc.setFont('helvetica','bold'); doc.setFontSize(5);
      doc.text(cnt+'/'+filas.length,xt+WS/2,yf+(FH+1)/2+2.5,{align:'center'});
      xt+=WS;
    });
    const avg=COLS.length?Math.round(sp/COLS.length):0;
    const ac=avg>=80?[46,125,50]:avg>=50?[200,130,0]:[198,40,40];
    doc.setTextColor(...ac); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text(avg+'%',xt+WP/2,yf+(FH+1)/2+2.5,{align:'center'});

    // Footer
    doc.setTextColor(160,160,160); doc.setFont('helvetica','normal'); doc.setFontSize(5.5);
    doc.text("MBM DC ITEM #69961  •  Carl's Jr. Capacitación  •  "+(sesion.sucursal||'').toUpperCase(),MAR,H-3);
    doc.text('Pág. '+doc.getNumberOfPages(),W-MAR,H-3,{align:'right'});

    doc.save('StarPerformance_'+(sesion.sucursal||'').replace(/\s/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf');
  }catch(e){console.error(e);alert('Error: '+e.message);}
  finally{if(btn){btn.textContent='📄 PDF Star';btn.disabled=false;}}
}

// ── MATRIZ DE CAPACITACIÓN ────────────────────────────────────
async function generarPDFMatriz(){
  const sesion = (typeof getSesionEntrenador==='function'?getSesionEntrenador():null)
    || JSON.parse(localStorage.getItem('sesion_entrenador')||'{}');
  if(!sesion?.sucursal){alert('Sin sucursal en sesión.');return;}
  const btn=document.getElementById('btnPDFMatriz');
  if(btn){btn.textContent='⏳ Generando…';btn.disabled=true;}
  try{
    const filas=await _traerFilas(sesion);
    if(!filas.length){alert('Sin empleados activos.');return;}

    // Matriz: ob + bl + fl (sin crew trainer)
    const COLS=COLUMNAS_STAR.filter(c=>['ob','bl','fl'].includes(c.grupo));

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const W=297,H=210,MAR=6;

    // Paleta igual al Excel de referencia
    const GC={ob:[46,125,50],bl:[198,40,40],fl:[21,101,192]};
    // Colores de fondo de celda completada (pastel)
    const GB={ob:[200,230,200],bl:[255,200,200],fl:[190,215,255]};
    // Fondo cabecera grupos
    const GH={ob:[46,125,50],bl:[198,40,40],fl:[21,101,192]};

    const WF=15,WN=52,WP=12;
    const WS=(W-MAR*2-WF-WN-WP)/COLS.length;

    const _pag=()=>{doc.setFillColor(255,255,255);doc.rect(0,0,W,H,'F');};
    _pag();

    // Header amarillo — igual al Excel
    doc.setFillColor(255,222,33); doc.rect(0,0,W,16,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(0,0,0);
    doc.text("CARL'S JR.",MAR+1,11);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('"Be A Star Performer!"',MAR+35,11);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(40,40,40);
    doc.text('SUCURSAL: '+(sesion.sucursal||'').toUpperCase(),W-MAR,7,{align:'right'});
    doc.text('Fecha: '+new Date().toLocaleDateString('es-MX'),W-MAR,13,{align:'right'});

    // Grupos — fila 1
    const YG=17,HG=7;
    _celda(doc,MAR,YG,WF+WN-0.2,HG,[230,230,230],[180,180,180]);
    let xg=MAR+WF+WN;
    const glabels={ob:'ORIENTACIÓN',bl:'BACKLINE\nPRODUCTION',fl:'FRONTLINE\nHOSPITALITY'};
    ['ob','bl','fl'].forEach(g=>{
      const gcols=COLS.filter(c=>c.grupo===g); if(!gcols.length)return;
      const gw=gcols.length*WS;
      _celda(doc,xg,YG,gw-0.2,HG,GH[g],GH[g]);
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(6);
      doc.text(glabels[g],xg+gw/2,YG+4.5,{align:'center'});
      xg+=gw;
    });
    _celda(doc,xg,YG,WP-0.2,HG,[230,230,230],[180,180,180]);

    // Cabeceras rotadas — fila 2
    const YC=YG+HG,HC=30;
    // Celda HIRE DATE
    _celda(doc,MAR,YC,WF-0.2,HC,[240,240,240],[160,160,160]);
    doc.setTextColor(40,40,40); doc.setFont('helvetica','bold'); doc.setFontSize(6);
    doc.text('HIRE\nDATE',MAR+WF/2,YC+HC/2-1,{align:'center'});
    // Celda EMPLOYEE NAME
    _celda(doc,MAR+WF,YC,WN-0.2,HC,[240,240,240],[160,160,160]);
    doc.text('EMPLOYEE NAME',MAR+WF+WN/2,YC+HC/2+1,{align:'center'});

    let xc=MAR+WF+WN;
    COLS.forEach(col=>{
      const gc=GC[col.grupo];
      _celda(doc,xc,YC,WS-0.2,HC,[252,252,252],gc);
      doc.setDrawColor(...gc); doc.setLineWidth(1);
      doc.line(xc,YC,xc+WS-0.2,YC); // borde top grueso
      doc.setLineWidth(0.25);
      doc.setTextColor(...gc); doc.setFont('helvetica','bold'); doc.setFontSize(5);
      const lbl=col.label.replace('Estación','Est.').replace('/',' ').trim().substring(0,16);
      doc.text(lbl,xc+WS/2,YC+HC-1.5,{align:'center',angle:90,rotationDirection:1});
      xc+=WS;
    });
    // Celda %
    _celda(doc,xc,YC,WP-0.2,HC,[240,240,240],[160,160,160]);
    doc.setTextColor(0,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text('%',xc+WP/2,YC+HC-2,{align:'center'});

    // Filas empleados
    const FH=7.5;
    let yf=YC+HC;
    const tots={}; COLS.forEach(c=>{tots[c.id]=0;});

    filas.forEach(({emp,star},idx)=>{
      if(yf+FH>H-10){doc.addPage();_pag();yf=8;}
      const bg=idx%2===0?[255,255,255]:[248,248,248];
      doc.setFillColor(...bg); doc.rect(MAR,yf,W-MAR*2,FH,'F');
      doc.setDrawColor(210,210,210); doc.setLineWidth(0.15);
      doc.line(MAR,yf+FH,W-MAR,yf+FH);

      // Fecha
      doc.setTextColor(90,90,90); doc.setFont('helvetica','normal'); doc.setFontSize(6.2);
      doc.text(_fecha(emp.fecha_ingreso),MAR+WF/2,yf+FH/2+2,{align:'center'});
      // Nombre
      doc.setTextColor(10,10,10); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text((emp.nombre||'').substring(0,32),MAR+WF+2,yf+FH/2+2.3);

      // Celdas estrella
      let xs=MAR+WF+WN; let done=0;
      COLS.forEach(col=>{
        const ok=!!star[col.id];
        if(ok){done++;tots[col.id]++;}
        const gc=GC[col.grupo];
        if(ok){
          doc.setFillColor(...GB[col.grupo]);
          doc.rect(xs,yf,WS-0.2,FH,'F');
          // estrella simulada: texto "*" en negrita grande color grupo
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          doc.setTextColor(...gc);
          doc.text('*',xs+WS/2,yf+FH/2+3,{align:'center'});
        } else {
          doc.setFont('helvetica','normal'); doc.setFontSize(7);
          doc.setTextColor(200,200,200);
          doc.text('o',xs+WS/2,yf+FH/2+2.5,{align:'center'});
        }
        xs+=WS;
      });

      // %
      const pct=COLS.length?Math.round(done/COLS.length*100):0;
      const pc=pct>=80?[46,125,50]:pct>=50?[200,130,0]:[198,40,40];
      doc.setTextColor(...pc); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text(pct+'%',xs+WP/2,yf+FH/2+2.5,{align:'center'});
      yf+=FH;
    });

    // Totales — fondo rojo como el Excel
    if(yf+FH+2>H-8){doc.addPage();_pag();yf=8;}
    doc.setFillColor(198,40,40); doc.rect(MAR,yf,W-MAR*2,FH+2,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text('Promedio General de Certificaciones',MAR+WF+WN/2+20,yf+(FH+2)/2+2.5,{align:'center'});
    let xt=MAR+WF+WN; let sp=0;
    COLS.forEach(col=>{
      const cnt=tots[col.id];
      const p=filas.length?Math.round(cnt/filas.length*100):0; sp+=p;
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(5);
      doc.text(cnt+'/'+filas.length,xt+WS/2,yf+(FH+2)/2+2.5,{align:'center'});
      xt+=WS;
    });
    const avg=COLS.length?Math.round(sp/COLS.length):0;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255,222,33);
    doc.text(avg+'%',xt+WP/2,yf+(FH+2)/2+2.5,{align:'center'});

    // Footer
    doc.setTextColor(160,160,160); doc.setFont('helvetica','normal'); doc.setFontSize(5.5);
    doc.text("MBM DC ITEM #69961  •  Carl's Jr. Capacitación  •  "+(sesion.sucursal||'').toUpperCase(),MAR,H-3);
    doc.text('FEB 2011',W-MAR,H-3,{align:'right'});

    doc.save('Matriz_'+(sesion.sucursal||'').replace(/\s/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf');
  }catch(e){console.error(e);alert('Error: '+e.message);}
  finally{if(btn){btn.textContent='📄 PDF Matriz';btn.disabled=false;}}
}
