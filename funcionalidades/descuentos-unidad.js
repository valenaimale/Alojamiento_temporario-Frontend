// Los descuentos por estadía larga de una unidad (vistas/unidades/descuentos-unidad.html?id=5), US2.10.
// Carga los escalones con GET /unidades/descuentos, deja agregar y quitar filas, muestra un ejemplo calculado en vivo
// y los guarda todos juntos con POST (reemplaza los anteriores). Las reglas están en DescuentosModelo.
// Solo es del propietario: si entra otro usuario, el backend responde 403 o 404 y se muestra ese mensaje.

const PRECIO_NOCHE_EJEMPLO = 50000; // el precio por noche del ejemplo (en pesos)

const formDescuentos = document.getElementById("form-descuentos");
const listaDescuentos = document.getElementById("lista-descuentos");
const mensajeError = document.getElementById("mensaje-error");
const errorDescuentos = document.getElementById("error-descuentos");
const mensajeOk = document.getElementById("mensaje-ok");
let idUnidad = null;
let guardando = false;

// Muestra un error de carga. Si todavía no se mostró la página (unidad ajena o sin conexión), la muestra solo con el error.
function mostrarError(texto) {
  mensajeError.textContent = texto;
  document.body.hidden = false;
}

// Agrega una fila al formulario: "Desde [noches] noches" y "[porcentaje] % de descuento", con su botón para quitarla
function agregarFila(noches = "", porcentaje = "") {
  const fila = document.createElement("li");
  const etiquetaNoches = document.createElement("label");
  etiquetaNoches.textContent = "Desde (noches)";
  const inputNoches = document.createElement("input");
  inputNoches.type = "number";
  inputNoches.name = "noches_minimas";
  inputNoches.min = String(DescuentosModelo.NOCHES_MINIMAS);
  inputNoches.max = String(DescuentosModelo.NOCHES_MAXIMAS);
  inputNoches.step = "1";
  inputNoches.inputMode = "numeric";
  inputNoches.value = noches;
  etiquetaNoches.append(inputNoches);

  const etiquetaPorcentaje = document.createElement("label");
  etiquetaPorcentaje.textContent = "Descuento (%)";
  const inputPorcentaje = document.createElement("input");
  inputPorcentaje.type = "number";
  inputPorcentaje.name = "porcentaje";
  inputPorcentaje.min = "0.01";
  inputPorcentaje.max = "99.99";
  inputPorcentaje.step = "0.01";
  inputPorcentaje.inputMode = "decimal";
  inputPorcentaje.value = porcentaje === "" ? "" : Number(porcentaje); // "10.00" → 10
  etiquetaPorcentaje.append(inputPorcentaje);

  const quitar = document.createElement("button");
  quitar.type = "button";
  quitar.className = "boton boton-secundario";
  quitar.textContent = "Quitar";
  quitar.addEventListener("click", () => {
    fila.remove();
    actualizarPantalla();
  });

  fila.append(etiquetaNoches, etiquetaPorcentaje, quitar);
  listaDescuentos.append(fila);
  actualizarPantalla();
  return inputNoches;
}

// Las filas como las escribió el propietario: [{noches_minimas: "10", porcentaje: "10"}, ...]
function filasDelFormulario() {
  return [...listaDescuentos.children].map((fila) => ({
    noches_minimas: fila.querySelector('[name="noches_minimas"]').value,
    porcentaje: fila.querySelector('[name="porcentaje"]').value,
  }));
}

// Muestra u oculta el aviso de "sin descuentos" y rearma el ejemplo con los escalones válidos que hay escritos
function actualizarPantalla() {
  document.getElementById("sin-descuentos").hidden = listaDescuentos.children.length > 0;
  document.getElementById("agregar-descuento").disabled =
    listaDescuentos.children.length >= DescuentosModelo.MAXIMO_ESCALONES;

  const ejemplo = document.getElementById("ejemplo");
  const lista = document.getElementById("ejemplo-descuentos");
  const { escalones } = DescuentosModelo.validarEscalones(filasDelFormulario());
  lista.replaceChildren();
  if (!escalones || escalones.length === 0) {
    ejemplo.hidden = true; // con un error o sin escalones, no hay ejemplo
    return;
  }
  for (const escalon of escalones) {
    const total = escalon.noches_minimas * PRECIO_NOCHE_EJEMPLO;
    const conDescuento = Math.round(total * (100 - Number(escalon.porcentaje))) / 100;
    const nombre = document.createElement("dt");
    nombre.textContent = `${escalon.noches_minimas} noches (${DescuentosModelo.textoPorcentaje(escalon.porcentaje)} menos)`;
    const valor = document.createElement("dd");
    valor.textContent = `${formatearPrecio(conDescuento)} en lugar de ${formatearPrecio(total)}`;
    lista.append(nombre, valor);
  }
  ejemplo.hidden = false;
}

// Escribe en el formulario los escalones que vinieron del backend
function llenarFormulario(descuentos) {
  listaDescuentos.replaceChildren();
  for (const descuento of descuentos) agregarFila(descuento.noches_minimas, descuento.porcentaje);
  actualizarPantalla();
}

// Guarda los escalones: los valida acá (para avisar enseguida) y los manda todos; el backend vuelve a validar
async function guardar(evento) {
  evento.preventDefault(); // frena el envío clásico del form: lo manejamos nosotros
  if (guardando) return; // un doble clic no manda dos veces
  errorDescuentos.textContent = "";
  mensajeOk.textContent = "";

  const { escalones, error } = DescuentosModelo.validarEscalones(filasDelFormulario());
  if (error) {
    errorDescuentos.textContent = error;
    return;
  }

  guardando = true;
  let respuesta;
  let resultado;
  try {
    ({ respuesta, resultado } = await pedirAlBack("/unidades/descuentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unidad_id: idUnidad, descuentos: escalones }),
    }));
  } catch (problema) {
    console.error("No se pudo conectar con el back:", problema);
    errorDescuentos.textContent = MENSAJE_SIN_CONEXION;
    return;
  } finally {
    guardando = false;
  }

  if (respuesta.ok) {
    llenarFormulario(resultado.descuentos); // como quedaron guardados, ordenados por noches
    mensajeOk.textContent = resultado.ok;
  } else {
    errorDescuentos.textContent = resultado.error;
  }
}

// Arma la página: controla la sesión, arma el menú y pide el nombre de la unidad y sus descuentos
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
  document.getElementById("enlace-volver").href = `configurar-unidad.html?id=${idUnidad}`;

  let resumen;
  let descuentos;
  try {
    // las dos a la vez: el nombre de la unidad (del resumen) y sus descuentos
    [resumen, descuentos] = await Promise.all([
      obtenerResumenUnidad(idUnidad),
      pedirAlBack(`/unidades/descuentos?id=${encodeURIComponent(idUnidad)}`),
    ]);
  } catch (error) {
    console.error("No se pudo conectar con el back:", error);
    mostrarError(MENSAJE_SIN_CONEXION);
    return;
  }
  for (const { respuesta, resultado } of [descuentos, resumen]) {
    if (!respuesta.ok) {
      // otra persona: 404 (o 403 si es el administrador)
      mostrarError(resultado.error);
      return;
    }
  }

  const unidad = resumen.resultado.unidad;
  document.title = `Descuentos por estadía larga de ${unidad.nombre}`;
  document.getElementById("nombre-unidad").textContent = `${unidad.nombre} · ${unidad.localidad}, ${unidad.provincia}`;
  document.getElementById("precio-ejemplo").textContent = formatearPrecio(PRECIO_NOCHE_EJEMPLO);
  llenarFormulario(descuentos.resultado.descuentos);
  mostrarNavegacionUnidad(unidad, "descuentos");

  document.getElementById("agregar-descuento").addEventListener("click", () => agregarFila().focus());
  formDescuentos.addEventListener("input", () => {
    mensajeOk.textContent = "";
    actualizarPantalla(); // el ejemplo cambia mientras escribe
  });
  formDescuentos.addEventListener("submit", guardar);
  document.getElementById("descuentos").hidden = false;
  document.body.hidden = false;
}

cargarPagina();
