// La política de cancelación y la seña de una unidad (vistas/unidades/politica-unidad.html?id=5), US2.8.
// Carga los porcentajes con GET /unidades/politica, muestra un ejemplo calculado en vivo y los guarda con POST.
// Solo es del propietario: si entra otro usuario, el backend responde 403 o 404 y se muestra ese mensaje.

const MONTO_EJEMPLO = 100000; // la reserva del ejemplo (en pesos)
const CAMPOS_POLITICA = [
  "porcentaje_sena",
  "retencion_mas_de_30",
  "retencion_de_15_a_30",
  "retencion_menos_de_15",
];
// dónde se muestra el ejemplo de cada porcentaje
const EJEMPLO_DE = {
  porcentaje_sena: "ejemplo-sena",
  retencion_mas_de_30: "ejemplo-mas-de-30",
  retencion_de_15_a_30: "ejemplo-de-15-a-30",
  retencion_menos_de_15: "ejemplo-menos-de-15",
};

const formPolitica = document.getElementById("form-politica");
const mensajeError = document.getElementById("mensaje-error");
const mensajeOk = document.getElementById("mensaje-ok");
let idUnidad = null;

// Muestra un error. Si todavía no se mostró la página (unidad inexistente, ajena o sin conexión), la muestra solo con el error.
function mostrarError(texto) {
  mensajeError.textContent = texto;
  document.body.hidden = false;
}

// El porcentaje escrito en un campo, o null si está vacío o no es un número de 0 a 100
function porcentajeDe(campo) {
  const porcentaje = formPolitica.elements[campo].valueAsNumber; // NaN si está vacío o no es un número
  return Number.isFinite(porcentaje) && porcentaje >= 0 && porcentaje <= 100
    ? porcentaje
    : null;
}

// Recalcula el ejemplo con los porcentajes que hay escritos en el formulario (un campo vacío o inválido muestra "—").
// La seña es un % del total; cada retención es un % de la seña (corrección del profesor): el resto se le devuelve.
function actualizarEjemplo() {
  const porcentajeSena = porcentajeDe("porcentaje_sena");
  const sena =
    porcentajeSena === null ? null : (MONTO_EJEMPLO * porcentajeSena) / 100;
  document.getElementById(EJEMPLO_DE.porcentaje_sena).textContent =
    sena === null
      ? "—"
      : `${formatearPrecio(sena)} (${porcentajeSena.toLocaleString("es-AR")} % del total)`; // 20.5 → "20,5 %"

  for (const campo of CAMPOS_POLITICA.slice(1)) {
    const porcentaje = porcentajeDe(campo);
    if (sena === null || porcentaje === null) {
      document.getElementById(EJEMPLO_DE[campo]).textContent = "—";
      continue;
    }
    const retenido = (sena * porcentaje) / 100;
    document.getElementById(EJEMPLO_DE[campo]).textContent =
      `${formatearPrecio(retenido)} (${porcentaje.toLocaleString("es-AR")} % de la seña) y se le devuelven ${formatearPrecio(sena - retenido)}`;
  }
}

// Escribe en el formulario los porcentajes que vinieron del backend
function llenarFormulario(politica) {
  for (const campo of CAMPOS_POLITICA) {
    formPolitica.elements[campo].value = Number(politica[campo]); // "20.00" → 20
  }
  actualizarEjemplo();
}

// Guarda la política: manda los 4 porcentajes y muestra el resultado (el backend dice qué regla no se cumple)
async function guardar(evento) {
  evento.preventDefault(); // frena el envío clásico del form: lo manejamos nosotros
  mensajeError.textContent = "";
  mensajeOk.textContent = "";

  const datos = { unidad_id: idUnidad };
  for (const campo of CAMPOS_POLITICA) {
    datos[campo] = formPolitica.elements[campo].value; // como texto: el backend acepta "20.5"
  }

  let respuesta;
  let resultado;
  try {
    ({ respuesta, resultado } = await pedirAlBack("/unidades/politica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    }));
  } catch (error) {
    console.error("No se pudo conectar con el back:", error);
    mensajeError.textContent = MENSAJE_SIN_CONEXION;
    return;
  }

  if (respuesta.ok) {
    llenarFormulario(resultado.politica); // como quedaron guardados (por ejemplo, 20.5 → 20,50)
    mensajeOk.textContent = resultado.ok;
  } else {
    mensajeError.textContent = resultado.error;
  }
}

// Arma la página: controla la sesión, arma el menú y pide el nombre de la unidad y su política
async function cargarPagina() {
  let usuario;
  try {
    usuario = await obtenerSesion();
  } catch (error) {
    mostrarPantallaSinConexion(error);
    return;
  }
  if (usuario === null) {
    // sin sesión: al login
    window.location.href = "../sesion/inicio-sesion.html";
    return;
  }
  armarMenu(usuario.rol);

  idUnidad = idUnidadDeLaUrl();
  if (idUnidad === null) {
    mostrarError("No encontramos esa unidad.");
    return;
  }
  document.getElementById("enlace-volver").href =
    `configurar-unidad.html?id=${idUnidad}`;

  let resumen;
  let politica;
  try {
    // las dos a la vez: el nombre de la unidad (del resumen) y su política
    [resumen, politica] = await Promise.all([
      obtenerResumenUnidad(idUnidad),
      pedirAlBack(`/unidades/politica?id=${encodeURIComponent(idUnidad)}`),
    ]);
  } catch (error) {
    console.error("No se pudo conectar con el back:", error);
    mostrarError(MENSAJE_SIN_CONEXION);
    return;
  }
  for (const { respuesta, resultado } of [politica, resumen]) {
    if (!respuesta.ok) {
      // otra persona: 404 (o 403 si es el administrador)
      mostrarError(resultado.error);
      return;
    }
  }

  const unidad = resumen.resultado.unidad;
  document.title = `Política de cancelación y seña de ${unidad.nombre}`;
  document.getElementById("nombre-unidad").textContent =
    `${unidad.nombre} · ${unidad.localidad}, ${unidad.provincia}`;
  document.getElementById("dias-cobro-saldo").textContent =
    politica.resultado.politica.dias_cobro_saldo;
  document.getElementById("monto-ejemplo").textContent =
    formatearPrecio(MONTO_EJEMPLO);
  llenarFormulario(politica.resultado.politica);
  mostrarNavegacionUnidad(unidad, "condiciones");

  formPolitica.addEventListener("input", actualizarEjemplo); // el ejemplo cambia mientras escribe
  formPolitica.addEventListener("submit", guardar);
  document.getElementById("politica").hidden = false;
  document.body.hidden = false;
}

cargarPagina();
