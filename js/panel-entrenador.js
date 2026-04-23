/* ============================================================
   entrenador-index.js — Dashboard principal del entrenador
   
   DEPENDE DE: supabase.js, core.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const sesion = requireEntrenador();   // redirige si no hay sesión

  document.getElementById('trainerName').textContent  = sesion.nombre   || 'Entrenador';
  document.getElementById('sucursalChip').textContent = sesion.sucursal || '—';
});

// Expuesto globalmente para el botón del HTML
function cerrarSesion() {
  localStorage.removeItem('sesion_entrenador');
  window.location.href = 'index.html';
}
