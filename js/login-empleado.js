
async function entrar() {
  const nombre = document.getElementById('nombreInput').value.trim();
  const err    = document.getElementById('errorMsg');
  const btn    = document.querySelector('.btn-entrar');

  if (!nombre) {
    err.classList.add('show');
    return;
  }
  err.classList.remove('show');

  btn.disabled    = true;
  btn.textContent = 'Buscando…';

  const { data } = await mysupabase
    .from('empleados')
    .select('id, nombre, fecha_ingreso, sucursal, entrenador')
    .ilike('nombre', nombre)
    .limit(1)
    .single();

  if (data) {
    localStorage.setItem('empleado', JSON.stringify({
      id:            data.id,
      nombre:        data.nombre,
      fecha_ingreso: data.fecha_ingreso || null,
      sucursal:      data.sucursal      || '',
      entrenador:    data.entrenador    || '',
    }));
  } else {
    localStorage.setItem('empleado', JSON.stringify({ nombre }));
  }

  btn.disabled    = false;
  btn.textContent = 'Entrar →';
  window.location.href = 'empleado-index.html';
}
