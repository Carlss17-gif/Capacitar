/* ============================================================
   auth.js — Registro y login de empleados
   Carl's Jr. Capacitación

   DEPENDE DE: supabase.js · core.js
   
   NUEVO: Al registrarse, cronograma = NULL (usa el base por defecto).
   No hace falta crear 31 rows — el motor lo construye on-the-fly.
   ============================================================ */

async function registrar() {
  const data = {
    id_empleado:  document.getElementById('id_empleado').value.trim(),
    nombre:       document.getElementById('nombre').value.trim(),
    fecha_ingreso:document.getElementById('fecha').value,
    entrenador:   document.getElementById('entrenador').value.trim(),
    distrito:     document.getElementById('distrito').value.trim(),
    sucursal:     document.getElementById('sucursal').value.trim(),
    email:        document.getElementById('email').value.trim(),
    password:     document.getElementById('password').value,
    activo:       true,
    cronograma:   null,   // NULL = usa cronograma_base.json por defecto
  };

  // Validación básica
  if (!data.nombre || !data.email || !data.password) {
    alert('Nombre, correo y contraseña son obligatorios');
    return;
  }

  const { error } = await mysupabase.from('empleados').insert([data]);

  if (error) {
    console.error(error);
    alert('Error al registrar: ' + error.message);
    return;
  }

  alert(`✅ ${data.nombre} registrado correctamente.\nSe le asignó el cronograma base de 31 días automáticamente.`);
  window.location.href = 'login.html';
}

async function login() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { data } = await mysupabase
    .from('empleados')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();

  if (data) {
    localStorage.setItem('empleado', JSON.stringify(data));
    window.location.href = 'Indice.html';
  } else {
    alert('Credenciales incorrectas');
  }
}

function irRegistro() {
  window.location.href = 'register.html';
}
