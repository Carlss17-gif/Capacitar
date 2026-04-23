async function login() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('btnEntrar');

  if (!email || !password) { mostrarError('Completa todos los campos'); return; }
  ocultarError();
  btn.disabled = true; btn.textContent = 'Verificando…';

  // Intento 1: Supabase Auth → entrenador (tiene cuenta de auth)
  const { error: authError } = await mysupabase.auth.signInWithPassword({ email, password });
  if (!authError) {
    const { data: perfil } = await mysupabase
      .from('empleados')
      .select('nombre, sucursal, distrito')
      .eq('email', email).limit(1).single();
    if (perfil?.nombre) {
      localStorage.setItem('sesion_entrenador', JSON.stringify({
        nombre:            perfil.nombre,
        nombre_entrenador: perfil.nombre,
        sucursal:          perfil.sucursal || '',
        distrito:          perfil.distrito || '',
        email,
      }));
      window.location.href = 'panel-entrenador.html';
      return;
    }
  }

  // Intento 2: query directa → empleado (password en tabla)
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
