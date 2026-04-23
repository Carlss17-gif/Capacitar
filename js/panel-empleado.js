/* ============================================================
   panel-empleado.js — Lógica del panel principal del empleado
   Carl's Jr. Capacitación

   Antes: inline en empleado-index.html
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const emp = JSON.parse(localStorage.getItem('empleado') || 'null');
  if (!emp) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('welcomeName').textContent = emp.nombre;

  if (emp.fecha_ingreso) {
    const ingreso = new Date(emp.fecha_ingreso);
    const hoy     = new Date();
    const dias    = Math.floor((hoy - ingreso) / 86400000) + 1;
    document.getElementById('diasNum').textContent = dias;
    document.getElementById('diasSub').textContent =
      'Ingreso: ' + ingreso.toLocaleDateString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
  } else {
    document.getElementById('diasBanner').style.display = 'none';
  }
});

function cerrarSesion() {
  localStorage.removeItem('empleado');
  window.location.href = 'index.html';
}
