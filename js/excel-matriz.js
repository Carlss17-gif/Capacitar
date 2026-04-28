async function _generarExcel(tipo) {
  const sesion = getSesionEntrenador();
  if (!sesion) { alert("Sin sesión de entrenador"); return; }

  const sucursal = sesion.sucursal || "";
  if (!sucursal) {
    alert("Tu perfil no tiene sucursal asignada. Contacta al administrador.");
    return;
  }

  const btnId = tipo === "star" ? "btnExcelStar" : "btnExcelMatriz";
  const btn   = document.getElementById(btnId);
  if (btn) { btn.textContent = "⏳ Generando…"; btn.disabled = true; }

  try {
    const { data: empleadosRaw, error: eEmp } = await mysupabase
      .from("empleados")
      .select("id, nombre, fecha_ingreso, entrenador, sucursal")
      .eq("sucursal", sucursal)
      .order("nombre");

    if (eEmp || !empleadosRaw?.length) {
      alert("No hay empleados para la sucursal: " + sucursal);
      return;
    }

    const ids = empleadosRaw.map(e => e.id);
    const { data: stars } = await queryStarPerformance(ids);
    const mapaStars = {};
    (stars || []).forEach(s => { mapaStars[s.empleado_id] = s; });

    const empleados = empleadosRaw.map(e => ({
      nombre:     e.nombre     || "—",
      entrenador: e.entrenador || "—",
      ingreso:    formatFecha(e.fecha_ingreso),
      star:       mapaStars[e.id] || {},
    }));

    const payload = {
      tipo,
      sucursal,
      entrenador: sesion.nombre || "Entrenador",
      empleados,
    };
    const resp = await fetch("/api/excel", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Error del servidor: ${resp.status} — ${err}`);
    }

    const blob     = await resp.blob();
    const fecha    = new Date().toISOString().split("T")[0];
    const nombre   = tipo === "star"
      ? `StarPerformance_${sucursal.replace(/\s/g,"_")}_${fecha}.xlsx`
      : `Matriz_${sucursal.replace(/\s/g,"_")}_${fecha}.xlsx`;

    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (e) {
    console.error("Error generando Excel:", e);
    alert("Error al generar Excel: " + e.message);
  } finally {
    if (btn) {
      btn.textContent = tipo === "star" ? "📊 Excel SP" : "📊 Excel MZ";
      btn.disabled = false;
    }
  }
}

function generarExcelStarPerformance() { return _generarExcel("star");   }
function generarExcelMatriz()          { return _generarExcel("matriz"); }

