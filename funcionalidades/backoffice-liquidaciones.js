// Liquidaciones del backoffice (vistas/backoffice/liquidaciones.html): generar y pagar a mano, sin esperar al cron.
// Pide GET /backoffice/liquidaciones, genera con POST /liquidaciones/generar y paga con POST /liquidaciones/pagar.
// Pagar dos veces no puede pasar: el back traba la liquidación y la reserva, y si ya salió responde 409.
// Igual, acá cada botón se deshabilita mientras espera, para que un doble clic no mande dos pedidos.
// La sesión y el rol los controla proteger-pagina.js. Lo que escribió un usuario se inserta con textContent.

const NOMBRES_DE_QUIEN = { propietario: "del propietario", administrador: "del administrador" };

const mensajeAccion = document.getElementById("mensaje-accion");
const mensajeListado = document.getElementById("mensaje-listado");
const tabla = document.getElementById("tabla-liquidaciones");
const cuerpoTabla = document.getElementById("cuerpo-liquidaciones");
const filtroSituacion = document.getElementById("filtro-situacion");
const botonGenerar = document.getElementById("boton-generar");

let liquidaciones = [];      // lo último que devolvió el back
const pagando = new Set();   // ids que se están pagando: su botón sigue deshabilitado aunque se redibuje la tabla

// Pide al back un POST con JSON. Devuelve { respuesta, resultado } (como pedirAlBack)
function enviarAlBack(ruta, datos = {}) {
  return pedirAlBack(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
}

// Si el back dijo que se cayó la sesión (401) o que no es backoffice (403), lleva a la página que corresponde.
// Devuelve true si redirigió.
function redirigirSiHaceFalta(respuesta) {
  if (respuesta.status === 401) {
    window.location.href = "../sesion/inicio-sesion.html";
    return true;
  }
  if (respuesta.status === 403) {
    window.location.href = "../errores/acceso-denegado.html";
    return true;
  }
  return false;
}

// Muestra el resultado de generar o pagar. $error: si salió mal (cambia el color)
function avisar(texto, error = false) {
  mensajeAccion.textContent = texto;
  mensajeAccion.classList.toggle("mensaje-error", error);
}

// Trae todas las liquidaciones y cuántas reservas faltan liquidar, y dibuja la pantalla
async function cargarLiquidaciones() {
  mensajeListado.hidden = false;
  mensajeListado.textContent = "Cargando las liquidaciones…";

  let respuesta;
  let resultado;
  try {
    ({ respuesta, resultado } = await pedirAlBack("/backoffice/liquidaciones"));
  } catch (fallo) {
    console.error("No se pudieron cargar las liquidaciones:", fallo);
    mensajeListado.textContent = MENSAJE_SIN_CONEXION;
    tabla.hidden = true;
    return;
  }
  if (redirigirSiHaceFalta(respuesta)) return;
  if (!respuesta.ok) {
    mensajeListado.textContent = resultado.error;
    return;
  }

  liquidaciones = resultado.liquidaciones;
  document.getElementById("sin-liquidar").textContent = LiquidacionesModelo.textoSinLiquidar(resultado.sin_liquidar);
  dibujarTabla();
}

// Arma la tabla con las liquidaciones de la situación elegida en el filtro
function dibujarTabla() {
  const visibles = LiquidacionesModelo.filtrarPorSituacion(liquidaciones, filtroSituacion.value);
  cuerpoTabla.replaceChildren(...visibles.map(armarFila));
  if (visibles.length === 0) {
    mensajeListado.hidden = false;
    mensajeListado.textContent = liquidaciones.length === 0
      ? "Todavía no hay liquidaciones."
      : "No hay liquidaciones en esa situación.";
    tabla.hidden = true;
    return;
  }
  mensajeListado.hidden = true;
  tabla.hidden = false;
}

// La fila de una liquidación
function armarFila(liquidacion) {
  const fila = document.createElement("tr");
  fila.setAttribute("data-testid", "fila-liquidacion");

  // Reserva: la unidad, el número, las fechas y el huésped
  const reserva = liquidacion.reserva;
  const celdaReserva = document.createElement("td");
  const unidad = document.createElement("strong");
  unidad.textContent = reserva.unidad.nombre;
  const detalle = document.createElement("span");
  detalle.className = "ayuda bloque";
  detalle.textContent = `Reserva n.º ${reserva.id} · ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)} · ${reserva.huesped}`;
  celdaReserva.append(unidad, detalle);
  fila.appendChild(celdaReserva);

  agregarCelda(fila, LiquidacionesModelo.motivo(liquidacion).texto);
  agregarCelda(fila, liquidacion.propietario);
  agregarCelda(fila, formatearPrecio(liquidacion.importe_cobrado));
  agregarCelda(fila, formatearPrecio(liquidacion.importe_propietario));
  agregarCelda(fila, textoDeComisiones(liquidacion));
  fila.appendChild(celdaDeSituacion(liquidacion));
  fila.appendChild(celdaDeAcciones(liquidacion));
  return fila;
}

// Agrega a la fila una celda con ese texto
function agregarCelda(fila, texto) {
  const celda = document.createElement("td");
  celda.textContent = texto;
  fila.appendChild(celda);
}

// "Plataforma $ 26.342,98 · Administrador $ 35.123,97" (sin administrador si la unidad es de autogestión)
function textoDeComisiones(liquidacion) {
  const partes = [`Plataforma ${formatearPrecio(liquidacion.comision_plataforma)}`];
  if (liquidacion.administrador !== null) {
    partes.push(`Administrador ${formatearPrecio(liquidacion.comision_administrador)}`);
  }
  return partes.join(" · ");
}

// La situación con su badge y, debajo, por qué (quién no cargó la billetera, cuánto falta cobrar)
function celdaDeSituacion(liquidacion) {
  const celda = document.createElement("td");
  const situacion = LiquidacionesModelo.situacion(liquidacion.situacion);
  const badge = document.createElement("span");
  badge.className = `estado ${situacion.clase}`;
  badge.setAttribute("data-testid", "situacion-liquidacion");
  badge.textContent = situacion.texto;

  const ayuda = document.createElement("span");
  ayuda.className = "ayuda bloque";
  if (liquidacion.situacion === "sin_billetera") {
    const quienes = liquidacion.faltan_billeteras.map((quien) => NOMBRES_DE_QUIEN[quien] ?? quien);
    ayuda.textContent = `Falta la billetera ${quienes.join(" y la ")}.`;
  } else if (liquidacion.situacion === "retenida" && liquidacion.faltante !== null) {
    ayuda.textContent = `Falta cobrar ${formatearPrecio(liquidacion.faltante)}.`;
  } else {
    ayuda.textContent = situacion.ayuda;
  }
  celda.append(badge, ayuda);
  return celda;
}

// "Pagar" si está lista, el comprobante, y la transacción en BaseScan si ya se pagó en la red real
function celdaDeAcciones(liquidacion) {
  const celda = document.createElement("td");
  const acciones = document.createElement("div");
  acciones.className = "acciones-tabla";
  celda.appendChild(acciones);
  const nombreOculto = ` de la reserva n.º ${liquidacion.reserva.id}`;

  if (liquidacion.situacion === "para_pagar") {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton-primario";
    boton.disabled = pagando.has(liquidacion.id);
    boton.textContent = pagando.has(liquidacion.id) ? "Pagando…" : "Pagar";
    boton.setAttribute("aria-label", `Pagar la liquidación${nombreOculto}`);
    boton.addEventListener("click", () => pagar(liquidacion, boton));
    acciones.appendChild(boton);
  }

  const comprobante = document.createElement("a");
  comprobante.href = `../liquidaciones/comprobante.html?id=${liquidacion.id}`;
  comprobante.className = "boton boton-outline";
  comprobante.textContent = "Comprobante";
  comprobante.setAttribute("aria-label", `Ver el comprobante${nombreOculto}`);
  acciones.appendChild(comprobante);

  const transaccion = liquidacion.transaccion;
  if (transaccion !== null && !transaccion.simulado) {
    const enlace = document.createElement("a");
    enlace.href = `https://sepolia.basescan.org/tx/${transaccion.tx_hash}`;
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.textContent = "Ver en BaseScan";
    acciones.appendChild(enlace);
  }
  return celda;
}

// Genera las liquidaciones de las reservas que faltan y vuelve a cargar la tabla
async function generar() {
  botonGenerar.disabled = true;
  avisar("Generando las liquidaciones…");
  try {
    const { respuesta, resultado } = await enviarAlBack("/liquidaciones/generar");
    if (redirigirSiHaceFalta(respuesta)) return;
    avisar(respuesta.ok ? resultado.ok : resultado.error, !respuesta.ok);
  } catch (fallo) {
    console.error("No se pudieron generar las liquidaciones:", fallo);
    avisar(MENSAJE_SIN_CONEXION, true);
  } finally {
    botonGenerar.disabled = false;
  }
  await cargarLiquidaciones();
}

// Paga una liquidación. Puede tardar unos segundos: el back manda la transacción al contrato y espera que se confirme.
async function pagar(liquidacion, boton) {
  if (pagando.has(liquidacion.id)) return;
  pagando.add(liquidacion.id);
  boton.disabled = true;
  boton.textContent = "Pagando…";
  avisar(`Pagando la liquidación de ${liquidacion.reserva.unidad.nombre}: puede tardar unos segundos…`);
  try {
    const { respuesta, resultado } = await enviarAlBack("/liquidaciones/pagar", { liquidacion_id: liquidacion.id });
    if (redirigirSiHaceFalta(respuesta)) return;
    // 200 pagada, 202 salió y falta confirmar; 409 ya estaba pagada o no se puede; 503 la red falló (se reintenta sola)
    avisar(
      `${liquidacion.reserva.unidad.nombre}: ${respuesta.ok ? resultado.ok : resultado.error}.`,
      !respuesta.ok,
    );
  } catch (fallo) {
    console.error("No se pudo pagar la liquidación:", fallo);
    avisar(MENSAJE_SIN_CONEXION, true);
  } finally {
    pagando.delete(liquidacion.id);
  }
  await cargarLiquidaciones();
}

botonGenerar.addEventListener("click", generar);
document.getElementById("boton-actualizar").addEventListener("click", cargarLiquidaciones);
filtroSituacion.addEventListener("change", dibujarTabla);
document.getElementById("boton-cerrar-sesion").addEventListener("click", cerrarSesion);
cargarLiquidaciones();
