/* ============================================================
   login.js — Autenticación de entrenadores · Carl's Jr.
   
   DEPENDE DE: supabase.js, core.js
   ============================================================ */

async function loginEntrenador() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorBox = document.getElementById('error');
  errorBox.innerText = '';

  if (!email || !password) {
    errorBox.innerText = 'Completa todos los campos';
    return;
  }

  // PASO 1: Autenticar con Supabase Auth
  const { error: authError } = await mysupabase.auth.signInWithPassword({ email, password });
  if (authError) {
    errorBox.innerText = 'Correo o contraseña inválidos';
    return;
  }

  // PASO 2: Buscar perfil en tabla empleados
  const { data: empleado, error: perfilError } = await mysupabase
    .from('empleados')
    .select('nombre, entrenador, sucursal, distrito, email')
    .eq('email', email)
    .limit(1)
    .single();

  if (perfilError || !empleado) {
    errorBox.innerText = 'No se encontró el perfil asociado a este correo';
    return;
  }

  if (!empleado.nombre) {
    errorBox.innerText = 'El perfil no tiene nombre. Contacta al administrador.';
    return;
  }

  // nombre      = SU nombre propio (para mostrar en UI)
  // nombre_entrenador = para filtrar empleados que este entrenador tiene asignados
  //   · Si el campo "entrenador" en BD apunta a otra persona → esa persona ES el entrenador
  //   · Si coincide con nombre (o está vacío) → esta persona ES el entrenador de sus propios empleados
  localStorage.setItem('sesion_entrenador', JSON.stringify({
    nombre:            empleado.nombre,
    nombre_entrenador: empleado.nombre,   // SIEMPRE usar el nombre propio para filtrar
    sucursal:          empleado.sucursal  || '',
    distrito:          empleado.distrito  || '',
    email,
  }));

  window.location.href = 'panel-entrenador.html';
}
