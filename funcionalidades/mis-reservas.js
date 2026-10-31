// "Mis reservas" del huésped (vistas/reservas/mis-reservas.html), Épica 4.
// Pide GET /reservas/mias y arma una tarjeta por reserva. Las pendientes se cancelan con POST /reservas/cancelar.
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).
// Si viene ?nueva=1 (recién reservó desde el detalle), muestra el aviso de que la reserva quedó guardada.

// El estado de la reserva como se le muestra al huésped, y la clase de su badge
const ESTADOS_DE_RESERVA = {
  pendiente: { texto: "Pendiente de pago", clase: "estado-pendiente" },
  confirmada: { texto: "Confirmada", clase: "estado-publicada" },
  finalizada: { texto: "Finalizada", clase: "estado-no-publicada" },
  cancelada: { texto: "Cancelada", clase: "estado-no-publicada" },
  expirada: { texto: "Vencida sin pagar", clase: "estado-no-publicada" },
};

// Agrega a la lista <dl> un dato: <dt>nombre</dt><dd>valor</dd>
function agregarDato(lista, nombre, valor) {
  const termino = document.createElement("dt");
  termino.textContent = nombre;
  const definicion = document.createElement("dd");
  definicion.textContent = valor;
  lista.append(termino, definicion);
}

// La tarjeta de una reserva: foto, alojamiento (con enlace al detalle), estado, fechas e importes.
// Si está pendiente, la aclaración del pago y "Cancelar reserva".
function tarjetaDeReserva(reserva) {
  const { alojamiento } = reserva;
  const item = document.createElement("li");
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta reserva";
  tarjeta.setAttribute("aria-labelledby", `reserva-${reserva.id}`);
  if (alojamiento.foto_principal) {
    const foto = document.createElement("img");
    foto.src = fotoConAncho(alojamiento.foto_principal, 600);
    foto.alt = "";
    foto.loading = "lazy";
    tarjeta.append(foto);
  }
  const cuerpo = document.createElement("div");
  cuerpo.className = "cuerpo-reserva";
  const estado = ESTADOS_DE_RESERVA[reserva.estado] ?? {
    texto: reserva.estado,
    clase: "estado-no-publicada",
  };
  const badge = document.createElement("span");
  badge.className = `estado ${estado.clase}`;
  badge.textContent = estado.texto;
  const titulo = document.createElement("h2");
  titulo.id = `reserva-${reserva.id}`;
  const enlace = document.createElement("a");
  enlace.href = `../alojamientos/detalle.html?id=${alojamiento.id}`;
  enlace.textContent = alojamiento.nombre;
  titulo.append(enlace);
  const lugar = document.createElement("p");
  lugar.className = "ubicacion";
  lugar.textContent = `${alojamiento.localidad}, ${alojamiento.provincia}`;
  const fechas = document.createElement("div");
  fechas.className = "fechas-reserva";
  const fechaVisible = (fecha) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(fecha + "T12:00:00"));
  for (const [label, valor] of [
    ["Ingreso", reserva.ingreso],
    ["Egreso", reserva.egreso],
  ]) {
    const grupo = document.createElement("div"),
      nombre = document.createElement("span"),
      fecha = document.createElement("strong");
    nombre.textContent = label;
    fecha.textContent = fechaVisible(valor);
    grupo.append(nombre, fecha);
    fechas.append(grupo);
  }
  const personas = document.createElement("p");
  personas.className = "ayuda";
  personas.textContent = `${reserva.noches} ${reserva.noches === 1 ? "noche" : "noches"} · ${reserva.personas} ${reserva.personas === 1 ? "huésped" : "huéspedes"}`;
  const total = document.createElement("p");
  total.className = "total-reserva";
  const monto = document.createElement("strong");
  monto.textContent = formatearPrecio(reserva.importe_total);
  total.append(monto, " total");
  const detalles = document.createElement("details");
  detalles.className = "opciones-reserva";
  const summary = document.createElement("summary");
  summary.textContent = "Importes y opciones";
  detalles.append(summary);
  const datos = document.createElement("dl");
  datos.className = "datos";
  agregarDato(
    datos,
    "Total de la estadía",
    formatearPrecio(reserva.importe_total),
  );
  agregarDato(datos, "Seña", formatearPrecio(reserva.importe_sena));
  detalles.append(datos);
  if (reserva.puede_cancelar) {
    const aclaracion = document.createElement("p");
    aclaracion.className = "ayuda";
    aclaracion.textContent =
      "Tus fechas están guardadas. El pago de la seña todavía no está habilitado.";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-texto accion-peligro";
    boton.textContent = "Cancelar reserva";
    boton.setAttribute(
      "aria-label",
      `Cancelar reserva en ${alojamiento.nombre}`,
    );
    boton.addEventListener("click", () => cancelarReserva(reserva));
    detalles.append(aclaracion, boton);
  }
  const huespedes = document.createElement('a');
  huespedes.textContent = 'Datos de huéspedes';
  huespedes.href = `libro-huespedes.html?reserva_id=${reserva.id}`;
  huespedes.className = 'boton boton-secundario';
  cuerpo.append(badge, titulo, lugar, fechas, personas, total, huespedes, detalles);
  tarjeta.append(cuerpo);
  item.append(tarjeta);
  return item;
}

let reservasActuales = [];
let filtroReservas = "proximas";
let cancelandoReserva = false;
function mostrarReservas() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const hoy = ["year", "month", "day"]
    .map((tipo) => partes.find((p) => p.type === tipo).value)
    .join("-");
  const proxima = (r) =>
    ["pendiente", "confirmada"].includes(r.estado) && r.egreso >= hoy;
  const proximas = reservasActuales
    .filter(proxima)
    .sort((a, b) => a.ingreso.localeCompare(b.ingreso));
  const historial = reservasActuales
    .filter((r) => !proxima(r))
    .sort((a, b) => b.ingreso.localeCompare(a.ingreso));
  const visibles = filtroReservas === "proximas" ? proximas : historial;
  document.getElementById("filtros-reservas").hidden = !reservasActuales.length;
  document.getElementById("cantidad-proximas").textContent = proximas.length;
  document.getElementById("cantidad-historial").textContent = historial.length;
  document
    .querySelectorAll("[data-filtro-reservas]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.filtroReservas === filtroReservas),
      ),
    );
  document
    .getElementById("lista-reservas")
    .replaceChildren(...visibles.map(tarjetaDeReserva));
  document.getElementById("sin-reservas").hidden = visibles.length > 0;
  document.getElementById("titulo-sin-reservas").textContent =
    filtroReservas === "historial"
      ? "Todavía no hay reservas en tu historial"
      : "Tu próxima escapada empieza acá";
  document.getElementById("texto-sin-reservas").textContent =
    filtroReservas === "historial"
      ? "Acá vas a encontrar estadías anteriores y reservas canceladas o vencidas."
      : "No tenés estadías en curso ni próximas. Explorá destinos para elegir dónde quedarte.";
  document.getElementById("resumen-reservas").textContent = visibles.length
    ? `${visibles.length} ${visibles.length === 1 ? "reserva" : "reservas"}`
    : "";
}

// Pide las reservas y las muestra (o el aviso de que no tiene ninguna). Lanza el error si el backend no responde.
async function cargarReservas() {
  const retry = document.getElementById("reintentar-reservas");
  retry.hidden = true;
  document.getElementById("cargando").hidden = false;
  try {
    const { respuesta, resultado } = await pedirAlBack("/reservas/mias");
    if (!respuesta.ok) {
      if (respuesta.status === 401 || respuesta.status === 403) return;
      throw new Error(resultado.error || MENSAJE_SIN_CONEXION);
    }
    reservasActuales = resultado.reservas;
    mostrarReservas();
    document.getElementById("mensaje-error").textContent = "";
  } catch (error) {
    retry.hidden = false;
    throw error;
  } finally {
    document.getElementById("cargando").hidden = true;
  }
}

// Cancela una reserva pendiente, después de confirmarlo. Muestra el resultado, actualiza la lista
// y lleva el foco al título (el botón tocado desaparece)
async function cancelarReserva(reserva) {
  if (cancelandoReserva) return;
  const confirmo = await confirmar({
    titulo: `¿Cancelar tu reserva en ${reserva.alojamiento.nombre}?`,
    detalle: `Del ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)}. Las fechas quedan libres para otros huéspedes. Como todavía no pagaste nada, no hay nada que devolver.`,
    textoConfirmar: "Cancelar reserva",
    textoCancelar: "Volver",
  });
  if (!confirmo) {
    return;
  }
  const mensajeOk = document.getElementById("mensaje-ok");
  const mensajeError = document.getElementById("mensaje-error");
  mensajeOk.textContent = "";
  mensajeError.textContent = "";

  cancelandoReserva = true;
  try {
    const { respuesta, resultado } = await pedirAlBack("/reservas/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: reserva.id }),
    });
    if (respuesta.ok) {
      mensajeOk.textContent = resultado.ok;
      await cargarReservas();
    } else {
      mensajeError.textContent = resultado.error;
    }
  } catch (error) {
    console.error("No se pudo conectar con el back:", error);
    mensajeError.textContent = MENSAJE_SIN_CONEXION;
  }
  cancelandoReserva = false;
  document.getElementById("titulo").focus();
}

// Arma la página: el aviso si recién reservó, y la lista de reservas
async function cargarPagina() {
  if (new URLSearchParams(window.location.search).get("nueva") === "1") {
    document.getElementById("mensaje-ok").textContent =
      "¡Listo, reservaste! Tu reserva quedó pendiente de pago y ya te guarda las fechas.";
    history.replaceState(null, "", window.location.pathname); // al recargar, el aviso no vuelve a aparecer
  }
  try {
    await cargarReservas();
  } catch (error) {
    console.error("No se pudieron cargar las reservas:", error);
    document.getElementById("cargando").hidden = true;
    document.getElementById("mensaje-error").textContent = MENSAJE_SIN_CONEXION;
  }
}

document.querySelectorAll("[data-filtro-reservas]").forEach((boton) =>
  boton.addEventListener("click", () => {
    filtroReservas = boton.dataset.filtroReservas;
    mostrarReservas();
  }),
);
document
  .getElementById("reintentar-reservas")
  .addEventListener("click", cargarPagina);
cargarPagina();
