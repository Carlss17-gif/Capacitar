/* ============================================================
   examenes-empleado.js — Navegación a exámenes del empleado
   Carl's Jr. Capacitación
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Acepta sesión de empleado O de entrenador (cuando usa "Mis Exámenes")
  const sesion = JSON.parse(
    localStorage.getItem('empleado') ||
    localStorage.getItem('sesion_entrenador') ||
    'null'
  );
  if (!sesion) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('welcomeChip').textContent = sesion.nombre || '—';
});

function irExamen(id) {
  const sesion = JSON.parse(
    localStorage.getItem('empleado') ||
    localStorage.getItem('sesion_entrenador') ||
    '{}'
  );
  const nom  = encodeURIComponent(sesion.nombre || '');
  const back = encodeURIComponent(window.location.href);
  window.location.href = `examen.html?id=${encodeURIComponent(id)}&nom=${nom}&back=${back}`;
}
