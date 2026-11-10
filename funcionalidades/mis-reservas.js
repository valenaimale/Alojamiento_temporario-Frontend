// "Mis reservas" del huésped (vistas/reservas/mis-reservas.html), Épica 4.
// Pide GET /reservas/mias y arma una tarjeta por reserva. Las pendientes se cancelan con POST /reservas/cancelar.
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).
// Si viene ?nueva=1 (recién reservó desde el detalle), muestra el aviso de que la reserva quedó guardada.

// El estado de la reserva como se le muestra al huésped, y la clase de su badge
const ESTADOS_DE_RESERVA = {
  pendiente: { texto: "Pendiente de pago", clase: "estado-pendiente" },
  pendiente_pago: { texto: "Pendiente de pago", clase: "estado-pendiente" },
  confirmada: { texto: "Confirmada", clase: "estado-publicada" },
  finalizada: { texto: "Finalizada", clase: "estado-no-publicada" },
  cancelada: { texto: "Cancelada", clase: "estado-no-publicada" },
  expirada: { texto: "Vencida sin pagar", clase: "estado-no-publicada" },
  vencida: { texto: "Vencida", clase: "estado-no-publicada" },
};

// Agrega a la lista <dl> un dato: <dt>nombre</dt><dd>valor</dd>
function agregarDato(lista, nombre, valor) {
  const termino = document.createElement("dt");
  termino.textContent = nombre;
  const definicion = document.createElement("dd");
  definicion.textContent = valor;
  lista.append(termino, definicion);
}

// Muestra los plazos informados por el servidor en horario argentino.
function fechaDePagoVisible(valor) {
  if (typeof valor !== "string" || !valor.trim()) return "";
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const instante = soloFecha ? Date.parse(`${valor}T12:00:00-03:00`) : PagosModelo.vencimiento(valor);
  if (!Number.isFinite(instante)) return "";
  const fecha = new Date(instante);
  if (!Number.isFinite(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric", month: "short", year: "numeric",
    ...(soloFecha ? {} : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  }).format(fecha);
}

// Mantiene el estado del cobro separado del estado de la reserva.
function mostrarPagoDeReserva(reserva, cuerpo, datos) {
  const pago = PagosModelo.estadoPagoReserva(reserva);
  const resumen = document.createElement("div");
  resumen.className = "pago-reserva";
  const estado = document.createElement("p");
  estado.className = "estado-pago-reserva";
  estado.textContent = `Pago: ${pago.texto}`;
  resumen.append(estado);
  if (pago.tipo && /^[1-9]\d*$/.test(String(reserva.id))) {
    const enlace = document.createElement("a");
    enlace.href = `pagar.html?reserva_id=${encodeURIComponent(reserva.id)}&tipo=${pago.tipo}`;
    enlace.className = "boton boton-primario";
    enlace.textContent = pago.accion;
    enlace.setAttribute("aria-label", `${pago.accion} de la reserva en ${reserva.alojamiento.nombre}`);
    resumen.append(enlace);
  }
  for (const [etiqueta, valor] of [
    ["Plazo para la seña", reserva.vence_en],
    ["Vencimiento del saldo", reserva.fecha_cobro],
  ]) {
    const fecha = fechaDePagoVisible(valor);
    if (!fecha) continue;
    const plazo = document.createElement("p");
    plazo.className = "ayuda plazo-pago-reserva";
    plazo.textContent = `${etiqueta}: ${fecha}`;
    resumen.append(plazo);
  }
  if (typeof reserva.saldo === "string" && /^\d+(?:\.\d{1,2})?$/.test(reserva.saldo)) {
    agregarDato(datos, "Saldo pendiente", formatearPrecio(reserva.saldo));
  }
  cuerpo.append(resumen);
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
    const boton = document.createElement("button");
    boton.type = "button";
    boton.setAttribute("data-cancelar-reserva", "");
    boton.className = "boton-texto accion-peligro";
    boton.textContent = "Cancelar reserva";
    boton.setAttribute(
      "aria-label",
      `Cancelar reserva en ${alojamiento.nombre}`,
    );
    boton.addEventListener("click", () => cancelarReserva(reserva));
    detalles.append(boton);
  }
  const huespedes = document.createElement('a');
  huespedes.textContent = 'Datos de huéspedes';
  huespedes.href = `libro-huespedes.html?reserva_id=${reserva.id}`;
  huespedes.className = 'boton boton-secundario';
  cuerpo.append(badge, titulo, lugar, fechas, personas, total);
  mostrarPagoDeReserva(reserva, cuerpo, datos);
  cuerpo.append(huespedes, detalles);
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
    ["pendiente", "pendiente_pago", "confirmada"].includes(r.estado) && r.egreso >= hoy;
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

// Consulta la devolución antes de pedir consentimiento y conserva los mensajes del servidor.
async function cancelarReserva(reserva) {
  if (cancelandoReserva) return;
  cancelandoReserva = true;
  const botones = document.querySelectorAll("[data-cancelar-reserva]");
  botones.forEach(boton => { boton.disabled = true; });
  const mensajeOk = document.getElementById("mensaje-ok");
  const mensajeError = document.getElementById("mensaje-error");
  const aviso = document.getElementById("consultando-cancelacion");
  mensajeOk.textContent = "";
  mensajeError.textContent = "";
  aviso.textContent = "Consultando las condiciones de cancelación…";
  document.getElementById("comprobante-devolucion").hidden = true;
  let confirmado = false;
  try {
    const previa = await pedirAlBack(`/reservas/cancelacion?reserva_id=${encodeURIComponent(reserva.id)}`);
    if (!previa.respuesta.ok) {
      mensajeError.textContent = previa.resultado.error || "No pudimos consultar la cancelación.";
      return;
    }
    const cuenta = PagosModelo.normalizarCancelacion(previa.resultado, reserva.id);
    aviso.textContent = "";
    confirmado = await confirmar({
      titulo: `¿Cancelar tu reserva en ${reserva.alojamiento.nombre}?`,
      detalle: `Del ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)}. ${cuenta.explicacion}`,
      datos: cuenta.estado === "confirmada" ? [
        ["Seña pagada", formatearPrecio(cuenta.pagado.sena)],
        ["Saldo pagado", formatearPrecio(cuenta.pagado.saldo)],
        [`Retención (${formatearPorcentaje(cuenta.porcentaje_retencion)} de la seña)`, formatearPrecio(cuenta.retencion)],
        ["Devolución total", formatearPrecio(cuenta.devolucion)],
      ] : [],
      textoConfirmar: "Cancelar reserva",
      textoCancelar: "Conservar reserva",
    });
    if (!confirmado) return;
    // Con pagos, el back manda la devolución al contrato y espera la confirmación de la red: puede tardar unos segundos
    aviso.textContent = cuenta.estado === "confirmada"
      ? "Cancelando tu reserva y enviando la devolución a tu billetera. Puede tardar unos segundos…"
      : "Cancelando tu reserva…";
    const { respuesta, resultado } = await pedirAlBack("/reservas/cancelar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: reserva.id }),
    });
    if (!respuesta.ok) {
      mensajeError.textContent = resultado.error || "No pudimos cancelar la reserva.";
      return;
    }
    mensajeOk.textContent = resultado.ok;
    const devolucion = resultado.devolucion;
    if (/^0x[0-9a-fA-F]{64}$/.test(devolucion?.tx_hash || "")) {
      document.getElementById("comprobante-devolucion").hidden = false;
      document.getElementById("hash-devolucion").textContent = devolucion.tx_hash;
      const enlace = document.getElementById("enlace-devolucion");
      // El backend actual no informa la red de la devolución: no enlazar hashes simulados a BaseScan.
      enlace.hidden = !(devolucion.red === 84532 && devolucion.simulado === false);
      if (!enlace.hidden) enlace.href = `https://sepolia.basescan.org/tx/${devolucion.tx_hash}`;
    }
    try { await cargarReservas(); }
    catch { mensajeError.textContent = "La cancelación quedó registrada. No pudimos actualizar la lista; volvé a cargar tus reservas."; }
  } catch (error) {
    mensajeError.textContent = error.codigo === "DATOS_INVALIDOS" ? error.message
      : confirmado ? "No pudimos comprobar el resultado de la cancelación. Actualizá tus reservas antes de volver a intentar." : MENSAJE_SIN_CONEXION;
  } finally {
    cancelandoReserva = false;
    aviso.textContent = "";
    botones.forEach(boton => { boton.disabled = false; });
    if (confirmado || mensajeError.textContent) document.getElementById("titulo").focus();
  }
}

// Arma la página: el aviso si recién reservó, y la lista de reservas
async function cargarPagina() {
  if (new URLSearchParams(window.location.search).get("confirmada") === "1") {
    document.getElementById("mensaje-ok").textContent = "Tu reserva está confirmada. Este alojamiento no requiere seña; consultá el saldo en la reserva.";
    history.replaceState(null, "", window.location.pathname);
  }
  if (new URLSearchParams(window.location.search).get("nueva") === "1") {
    document.getElementById("mensaje-ok").textContent =
      "Tu reserva quedó pendiente de pago. Abrí el pago de la seña para continuar.";
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
