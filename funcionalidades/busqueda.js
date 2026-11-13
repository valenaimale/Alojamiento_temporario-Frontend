// El formulario de búsqueda de alojamientos (US3.2), que comparten los dos inicios (con y sin sesión) y el listado.
// El formulario manda la búsqueda a vistas/alojamientos/listado.html por GET, sin JavaScript: así queda en la URL
// (se puede volver atrás o compartir el enlace). Este archivo solo lo prepara: las localidades, las fechas mínimas,
// lo que ya se había buscado y el control de que el egreso sea posterior al ingreso.
// Se incluye después de sesion.js y unidades-comun.js.

// Una fecha de JavaScript como "AAAA-MM-DD", con la fecha local (la del usuario, en Argentina)
function fechaATextoBusqueda(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// "AAAA-MM-DD" más esa cantidad de días, otra vez como "AAAA-MM-DD"
function sumarDias(texto, dias) {
  const [anio, mes, dia] = texto.split("-").map(Number);
  return fechaATextoBusqueda(new Date(anio, mes - 1, dia + dias));
}

// El egreso tiene que ser al menos el día siguiente al ingreso: ajusta el mínimo del egreso y, si ya no sirve, lo borra
function ajustarEgreso(formulario) {
  const { ingreso, egreso } = formulario.elements;
  const manana = sumarDias(fechaATextoBusqueda(new Date()), 1);
  egreso.min = sumarDias(ingreso.value || manana, 1);
  if (egreso.value !== "" && egreso.value < egreso.min) {
    // AAAA-MM-DD se compara como texto
    egreso.value = "";
  }
}

// "AAAA-MM-DD" como "14/11/2026", para los mensajes de error
function fechaLegibleBusqueda(texto) {
  const [anio, mes, dia] = texto.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Qué tiene de malo la búsqueda, o null si está bien: { campo, mensaje }, con campo = el nombre del input a marcar.
// Son las mismas reglas que controla el back al reservar: ingreso de mañana en adelante, egreso posterior al
// ingreso y de 1 a 50 huéspedes. "manana" es la fecha mínima del ingreso, como "AAAA-MM-DD".
function problemaDeBusqueda({ ingreso, egreso, personas }, manana) {
  if (ingreso === "") return { campo: "ingreso", mensaje: "Elegí la fecha de ingreso." };
  if (ingreso < manana) {
    // AAAA-MM-DD se compara como texto
    return {
      campo: "ingreso",
      mensaje: `El ingreso tiene que ser desde el ${fechaLegibleBusqueda(manana)}: para hoy ya no se puede reservar.`,
    };
  }
  if (egreso === "") return { campo: "egreso", mensaje: "Elegí la fecha de egreso." };
  if (egreso <= ingreso) return { campo: "egreso", mensaje: "El egreso tiene que ser posterior al ingreso." };
  if (!/^\d+$/.test(String(personas).trim()) || Number(personas) < 1 || Number(personas) > 50) {
    return { campo: "personas", mensaje: "La cantidad de huéspedes tiene que ser de 1 a 50." };
  }
  return null;
}

// Prepara el formulario de búsqueda de la página (#form-busqueda): carga los destinos, fija las fechas mínimas
// (el ingreso es de mañana en adelante: hoy ya no se reserva) y lo completa con la búsqueda que vino en la URL.
async function prepararBusqueda() {
  const formulario = document.getElementById("form-busqueda");
  const parametros = new URLSearchParams(window.location.search);
  const {
    localidad_id: destino,
    ingreso,
    egreso,
    personas,
  } = formulario.elements;

  ingreso.min = sumarDias(fechaATextoBusqueda(new Date()), 1);
  ingreso.value = parametros.get("ingreso") ?? "";
  egreso.value = parametros.get("egreso") ?? "";
  personas.value = parametros.get("personas") ?? personas.value;
  ajustarEgreso(formulario);
  const actualizarContador = () =>
    formulario.querySelectorAll("[data-personas]").forEach((boton) => {
      const valor = Number(personas.value);
      boton.disabled =
        Number(boton.dataset.personas) < 0 ? valor <= 1 : valor >= 50;
    });
  formulario.querySelectorAll("[data-personas]").forEach((boton) =>
    boton.addEventListener("click", () => {
      personas.value = Math.max(
        1,
        Math.min(
          50,
          (Number(personas.value) || 1) + Number(boton.dataset.personas),
        ),
      );
      personas.dispatchEvent(new Event("input", { bubbles: true }));
    }),
  );
  personas.addEventListener("input", actualizarContador);
  actualizarContador();
  ingreso.addEventListener("change", () => ajustarEgreso(formulario));

  // noValidate: las fechas y los huéspedes se validan acá (problemaDeBusqueda) y el error sale con el estilo de
  // HayLugar, en #error-busqueda, en lugar del globo del navegador. Los "min" quedan para el selector de fechas.
  formulario.noValidate = true;
  formulario.addEventListener("submit", (evento) => {
    const error = document.getElementById("error-busqueda");
    [ingreso, egreso, personas].forEach((campo) => campo.removeAttribute("aria-invalid"));
    const problema = problemaDeBusqueda(
      { ingreso: ingreso.value, egreso: egreso.value, personas: personas.value },
      sumarDias(fechaATextoBusqueda(new Date()), 1),
    );
    error.textContent = problema ? problema.mensaje : "";
    if (problema) {
      evento.preventDefault();
      const campo = formulario.elements[problema.campo];
      campo.setAttribute("aria-invalid", "true");
      campo.focus();
    }
  });
  // al corregir un campo marcado, se le quita la marca de error
  [ingreso, egreso, personas].forEach((campo) =>
    campo.addEventListener("input", () => campo.removeAttribute("aria-invalid")),
  );

  try {
    const seleccionada = Number(parametros.get("localidad_id")) || null;
    await cargarLocalidades(destino, seleccionada);
  } catch (error) {
    // sin las localidades se puede buscar igual, en todos los destinos
    console.error("No se pudieron cargar las localidades:", error);
    document.getElementById("error-busqueda").textContent =
      "No pudimos cargar los destinos. Podés buscar en todos o volver a cargar la página.";
  }
  destino.options[0].textContent = "Todos los destinos"; // la primera opción (vacía) = buscar en todos
  const editor = document.getElementById("busqueda-editar");
  if (editor) {
    const fecha = (texto) =>
      new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(texto + "T12:00:00"));
    const fechasValidas =
      ingreso.value &&
      egreso.value &&
      ingreso.validity.valid &&
      egreso.validity.valid;
    if (
      fechasValidas &&
      personas.validity.valid &&
      !document.getElementById("error-busqueda").textContent
    ) {
      document.getElementById("criterios-busqueda").textContent =
        `${destino.selectedOptions[0]?.textContent || "Todos los destinos"} · ${fecha(ingreso.value)} – ${fecha(egreso.value)} · ${personas.value} ${personas.value === "1" ? "huésped" : "huéspedes"}`;
      editor.open = false;
    }
  }
}

// Para los tests de Node (en el navegador no hay "module")
if (typeof module !== "undefined") module.exports = { problemaDeBusqueda, sumarDias, fechaATextoBusqueda };
