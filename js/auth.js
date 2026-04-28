async function registrar() {
  const errorEl = document.getElementById('regError');
  const data = {
    id_empleado:  document.getElementById('id_empleado').value.trim(),
    nombre:       document.getElementById('nombre').value.trim(),
    fecha_ingreso:document.getElementById('fecha').value,
    entrenador:   document.getElementById('entrenador').value.trim(),
    distrito:     document.getElementById('distrito').value.trim(),
    sucursal:     document.getElementById('sucursal').value.trim(),
    email:        document.getElementById('email').value.trim(),
    password:     document.getElementById('password').value
  };
  const vacios = Object.values(data).some(v => !v);
  if (vacios) {
    if (errorEl) errorEl.classList.add('show');
    return;
  }
  const { error } = await mysupabase.from('empleados').insert([data]);
  if (error) {
    console.error('Error al registrar:', error);
    if (errorEl) {
      errorEl.textContent = 'Error al registrar. Intenta de nuevo.';
      errorEl.classList.add('show');
    }
    return;
  }
  alert('¡Registro exitoso! Ya puedes iniciar sesión.');
  window.location.href = 'index.html';
}

async function login() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('btnEntrar');
  if (!email || !password) { mostrarError('Completa todos los campos'); return; }
  ocultarError();
  btn.disabled = true; btn.textContent = 'Verificando…';

  // ── Intento 1: Supabase Auth → entrenador ────────────────────
  const { error: authError } = await mysupabase.auth.signInWithPassword({ email, password });
  if (!authError) {
    const { data: perfil } = await mysupabase
      .from('empleados')
      .select('id, nombre, sucursal, distrito, fecha_ingreso, entrenador, email')
      .eq('email', email)
      .limit(1)
      .single();

    if (perfil?.nombre) {
      localStorage.setItem('sesion_entrenador', JSON.stringify({
        nombre:            perfil.nombre,
        nombre_entrenador: perfil.nombre,
        sucursal:          perfil.sucursal  || '',
        distrito:          perfil.distrito  || '',
        email,
      }));

      localStorage.setItem('empleado', JSON.stringify({
        id:            perfil.id,
        nombre:        perfil.nombre,
        fecha_ingreso: perfil.fecha_ingreso || null,
        sucursal:      perfil.sucursal      || '',
        entrenador:    perfil.entrenador    || '',
        email:         perfil.email,
      }));

      window.location.href = 'panel-entrenador.html';
      return;
    }
  }

  const { data, error: dbError } = await mysupabase
    .from('empleados')
    .select('id, nombre, fecha_ingreso, sucursal, entrenador, email')
    .eq('email', email)
    .eq('password', password)
    .limit(1)
    .single();

  if (dbError || !data) {
    btn.disabled = false; btn.textContent = 'Entrar →';
    mostrarError('Correo o contraseña incorrectos');
    return;
  }

  localStorage.removeItem('sesion_entrenador'); 
  localStorage.setItem('empleado', JSON.stringify({
    id:            data.id,
    nombre:        data.nombre,
    fecha_ingreso: data.fecha_ingreso || null,
    sucursal:      data.sucursal      || '',
    entrenador:    data.entrenador    || '',
    email:         data.email,
  }));
  window.location.href = 'empleado-index.html';
}

function mostrarError(msg) {
  const el = document.getElementById('loginError');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function ocultarError() {
  const el = document.getElementById('loginError');
  if (el) el.classList.remove('show');
}
function irRegistro() { window.location.href = 'register.html'; }

document.addEventListener('DOMContentLoaded', () => {
  ['email', 'password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  });
});

