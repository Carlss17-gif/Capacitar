let examenData;
const params = new URLSearchParams(window.location.search);
const examId = params.get('id');
const backUrl = params.get('back') || 'empleado-index.html';

const empData = JSON.parse(localStorage.getItem('empleado') || localStorage.getItem('sesion_entrenador') || '{}');
const empNombre = params.get('nom') || empData.nombre || 'Empleado';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('empChip').textContent = empNombre;
  if (!examId) { document.getElementById('titulo').textContent = 'Examen no encontrado'; return; }
  cargarExamen();
});

function volver() {
  window.location.href = backUrl;
}

async function cargarExamen() {
  try {
    const res  = await fetch('examenes.json');
    const data = await res.json();
    examenData = data[examId];
    if (!examenData) {
      document.getElementById('titulo').textContent = 'Examen no encontrado: ' + examId;
      return;
    }
    document.getElementById('titulo').textContent = examenData.area;
    renderPreguntas();
  } catch (e) {
    document.getElementById('titulo').textContent = 'Error cargando examen';
  }
}

function renderPreguntas() {
  const cont = document.getElementById('preguntas');
  cont.innerHTML = '';
  examenData.preguntas.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<p>${i + 1}. ${p.texto || ''}</p>`;

    if (p.tipo === 'opcion') {
      const wrap = document.createElement('div');
      wrap.className = 'opciones';
      p.opciones.forEach((op, j) => {
        const esImg = typeof op === 'string' && /\.(png|jpg|jpeg|webp)$/i.test(op);
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type  = 'radio';
        input.name  = 'p' + i;
        input.value = j;
        label.appendChild(input);
        if (esImg) {
          const img = document.createElement('img');
          img.src = op; img.className = 'img-opcion';
          label.appendChild(img);
        } else {
          const span = document.createElement('span');
          span.textContent = op;
          label.appendChild(span);
        }
        wrap.appendChild(label);
      });
      div.appendChild(wrap);

    } else if (p.subitems && Array.isArray(p.subitems)) {
      const subDiv = document.createElement('div');
      subDiv.className = 'subpreguntas';
      p.subitems.forEach((item, j) => {
        const grupo = document.createElement('div');
        grupo.className = 'subpregunta';
        const lbl = document.createElement('label');
        lbl.textContent = item;
        const inp = document.createElement('input');
        inp.type = 'text'; inp.id = `p${i}_${j}`; inp.placeholder = 'Tu respuesta…';
        grupo.appendChild(lbl); grupo.appendChild(inp);
        subDiv.appendChild(grupo);
      });
      div.appendChild(subDiv);

    } else {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.id = `p${i}`;
      inp.className = 'input-normal'; inp.placeholder = 'Tu respuesta…';
      div.appendChild(inp);
    }
    cont.appendChild(div);
  });
}

async function enviar() {
  const btn = document.querySelector('.exam-submit-btn');
  btn.disabled = true; btn.textContent = 'Enviando…';

  let respuestas = [];
  let correctas  = 0;

  examenData.preguntas.forEach((p, i) => {
    if (p.tipo === 'opcion') {
      const r   = document.querySelector(`input[name=p${i}]:checked`);
      const val = r ? parseInt(r.value) : null;
      respuestas.push(val);
      if (val === p.correcta) correctas++;
    } else if (p.subitems && Array.isArray(p.subitems)) {
      const subs = p.subitems.map((_, j) => {
        const el = document.getElementById(`p${i}_${j}`);
        return el ? el.value : '';
      });
      respuestas.push(subs);
    } else {
      const el = document.getElementById(`p${i}`);
      respuestas.push(el ? el.value : '');
    }
  });

  const total = examenData.preguntas.filter(p => p.tipo === 'opcion').length;

  // ── Delegar lógica de límite y mejor puntuación a Supabase ──
  const { data: resultado, error } = await mysupabase
    .rpc('insertar_resultado_examen', {
      p_nombre:     empNombre,
      p_examen:     examId,
      p_area:       examenData.area,
      p_respuestas: respuestas,
      p_correctas:  correctas,
      p_total:      examenData.preguntas.length,
    });

  if (error) {
    btn.disabled = false; btn.textContent = 'Enviar respuestas';
    alert('Error al guardar. Intenta de nuevo.');
    return;
  }

  if (!resultado.ok) {
    btn.disabled = false; btn.textContent = 'Enviar respuestas';
    if (resultado.motivo === 'espera') {
      const d = resultado.dias_restantes;
      alert(`Ya realizaste este examen recientemente.\nPodrás volver a intentarlo en ${d} día${d !== 1 ? 's' : ''}.`);
    } else if (resultado.motivo === 'peor_puntuacion') {
      alert(`Tu resultado anterior fue ${resultado.pct_actual}%.\nEsta respuesta obtuvo ${resultado.pct_nuevo}%, por lo que no se guardó.\nSolo se conserva la mejor puntuación.`);
    }
    return;
  }

  const pct       = total > 0 ? Math.round((correctas / total) * 100) : null;
  const color     = pct === null ? '#888' : pct >= 80 ? '#4caf50' : pct >= 60 ? '#ff9800' : '#e53935';
  const emoji     = pct === null ? '📝' : pct >= 80 ? '🏆' : pct >= 60 ? '⚠️' : '📚';
  const msg       = pct === null ? 'Examen abierto' : pct >= 80 ? '¡Excelente resultado!' : pct >= 60 ? 'Aprobado' : 'Necesitas repasar';

  const banner = document.createElement('div');
  banner.className = 'result-banner';
  banner.innerHTML = `
    <div class="rb-emoji">${emoji}</div>
    <div class="rb-titulo">${msg}</div>
    <div class="rb-score" style="color:${color}">${correctas}${total > 0 ? `/${total}` : ''} correctas${pct !== null ? ` · ${pct}%` : ''}</div>
    ${pct !== null ? `
    <div class="rb-barra-wrap">
      <div class="rb-barra-fill" style="width:0%;background:${color}" data-pct="${pct}"></div>
    </div>` : ''}
    <div class="rb-cuenta" id="rbCuenta">Regresando en <strong>6</strong>s…</div>`;

  // Colocar el banner al tope, encima de todo
  const wrap = document.getElementById('contenedor');
  wrap.insertBefore(banner, wrap.firstChild);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Animar barra de porcentaje
  if (pct !== null) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = banner.querySelector('.rb-barra-fill');
        if (fill) fill.style.width = pct + '%';
      });
    });
  }

  btn.textContent = '← Volver ahora';
  btn.disabled    = false;
  btn.onclick     = () => { clearInterval(_timer); volver(); };

  // Cuenta regresiva → redirect automático
  let seg = 6;
  const _timer = setInterval(() => {
    seg--;
    const el = document.getElementById('rbCuenta');
    if (!el) { clearInterval(_timer); return; }
    if (seg <= 0) {
      clearInterval(_timer);
      volver();
    } else {
      el.innerHTML = `Regresando en <strong>${seg}</strong>s…`;
    }
  }, 1000);
}
