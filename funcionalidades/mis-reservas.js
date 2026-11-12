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
  no_show: { texto: "No te presentaste", clase: "estado-no-publicada" },
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
  if (reserva.estado === 'no_show') return;
  const pago = PagosModelo.estadoPagoReserva(reserva);
  const esExtension = Boolean(reserva.extiende_reserva_id);
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
    enlace.textContent = esExtension && pago.accion === 'Pagar la seña' ? 'Pagar la extensión' : pago.accion;
    enlace.setAttribute("aria-label", `${enlace.textContent} de la reserva en ${reserva.alojamiento.nombre}`);
    resumen.append(enlace);
  }
  for (const [etiqueta, valor] of [
    [esExtension ? 'Plazo para pagar la extensión' : "Plazo para la seña", reserva.vence_en],
    ["Vencimiento del saldo", esExtension ? null : reserva.fecha_cobro],
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
// En una cancelada: si la canceló el propietario (con su motivo) y la excepción que le dio al huésped (decisiones #63 y #65)
function mostrarCancelacion(reserva, cuerpo) {
  const cancelacion = reserva.cancelacion;
  if (!cancelacion) return;
  if (cancelacion.por === "propietario") {
    const aviso = document.createElement("p");
    aviso.className = "aviso";
    aviso.textContent = `La canceló el propietario${cancelacion.motivo ? `: ${cancelacion.motivo}` : ""}. Te devolvemos todo lo que pagaste.`;
    cuerpo.append(aviso);
  }
  if (cancelacion.excepcion !== null) {
    const excepcion = document.createElement("p");
    excepcion.className = "mensaje-ok";
    excepcion.textContent = `El propietario te devuelve ${formatearPrecio(cancelacion.excepcion)} más de lo retenido.`;
    cuerpo.append(excepcion);
  }
}

// /reservas/mias informa puede_extender y vincula las extensiones por extiende_reserva_id.
// La elegibilidad de la estadía la calcula el servidor; no se infiere por la fecha.
function extensionesDeReserva(reserva) {
  return Array.isArray(reserva.extensiones) ? reserva.extensiones : [];
}

function salidaDeReserva(reserva) {
  return extensionesDeReserva(reserva)
    .filter(extension => ['confirmada', 'finalizada'].includes(extension.estado))
    .reduce((salida, extension) => /^\d{4}-\d{2}-\d{2}$/.test(extension.egreso) && extension.egreso > salida ? extension.egreso : salida, reserva.egreso);
}

function extensionPendiente(reserva) {
  return extensionesDeReserva(reserva).some(extension => {
    if (!['pendiente', 'pendiente_pago'].includes(extension.estado)) return false;
    const vence = PagosModelo.vencimiento(extension.vence_en);
    return !Number.isFinite(vence) || vence > Date.now();
  });
}

function puedeExtenderReserva(reserva) {
  return PagosModelo.identificador(reserva.id) !== null &&
    !reserva.extiende_reserva_id && reserva.estado === 'confirmada' &&
    reserva.puede_extender === true && !extensionPendiente(reserva);
}

function agruparReservas(reservas) {
  const originales = reservas.filter(reserva => !reserva.extiende_reserva_id);
  return originales.map(reserva => {
    const extensiones = new Map(extensionesDeReserva(reserva).map(extension => [String(extension.id), extension]));
    for (const extension of reservas) {
      if (String(extension.extiende_reserva_id) === String(reserva.id)) extensiones.set(String(extension.id), extension);
    }
    return { ...reserva, extensiones: [...extensiones.values()] };
  });
}

function mostrarExtensiones(reserva, cuerpo) {
  for (const extension of extensionesDeReserva(reserva)) {
    const bloque = document.createElement('section');
    bloque.className = 'pago-reserva';
    bloque.setAttribute('aria-label', 'Extensión de la estadía');
    const titulo = document.createElement('h3');
    titulo.textContent = 'Extensión de la estadía';
    const descripcion = document.createElement('p');
    descripcion.textContent = `${fechaDePagoVisible(extension.ingreso)} al ${fechaDePagoVisible(extension.egreso)} · ${formatearPrecio(extension.importe_total)} · ${ESTADOS_DE_RESERVA[extension.estado]?.texto || extension.estado}`;
    bloque.append(titulo, descripcion);
    const datos = document.createElement('dl');
    if (['pendiente', 'pendiente_pago'].includes(extension.estado)) {
      mostrarPagoDeReserva({ ...extension, extiende_reserva_id: reserva.id, alojamiento: reserva.alojamiento }, bloque, datos);
    } else if (['confirmada', 'finalizada'].includes(extension.estado)) {
      const aviso = document.createElement('p');
      aviso.className = 'ayuda';
      aviso.textContent = 'Extensión pagada. No se puede cancelar.';
      bloque.append(aviso);
    }
    bloque.append(datos);
    cuerpo.append(bloque);
  }
}

function normalizarCotizacionExtension(datos, reserva, noches) {
  const importe = datos?.importe_total ?? datos?.precio_total;
  const fechaValida = valor => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    Number.isFinite(Date.parse(valor + 'T12:00:00Z')) &&
    new Date(valor + 'T12:00:00Z').toISOString().slice(0, 10) === valor;
  if (String(datos?.reserva_id) !== String(reserva.id) ||
      Number(datos.noches) !== noches || !fechaValida(datos.ingreso) || !fechaValida(datos.egreso) ||
      datos.ingreso !== salidaDeReserva(reserva) ||
      (Date.parse(datos.egreso + 'T12:00:00Z') - Date.parse(datos.ingreso + 'T12:00:00Z')) / 86400000 !== noches ||
      typeof importe !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(importe) || !Number.isFinite(Number(importe)) || Number(importe) <= 0) {
    throw new Error('No pudimos validar la cotización. Volvé a consultar.');
  }
  const porcentaje = datos.porcentaje_descuento == null ? 0 : Number(datos.porcentaje_descuento);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) throw new Error('El descuento recibido no es válido.');
  return { ...datos, importe_total: importe, porcentaje_descuento: porcentaje };
}

async function pedirExtension(ruta, envio) {
  const { respuesta, resultado } = await pedirAlBack(ruta, envio);
  if (!respuesta.ok) {
    throw new Error(resultado?.error || (respuesta.status === 404
      ? 'La extensión todavía no está disponible. Volvé a intentar más tarde.'
      : 'No pudimos procesar la extensión.'));
  }
  return resultado;
}

function mostrarFormularioExtension(reserva, cuerpo) {
  if (!puedeExtenderReserva(reserva)) return;
  const abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.className = 'boton boton-secundario';
  abrir.textContent = 'Extender estadía';
  abrir.setAttribute('aria-expanded', 'false');
  abrir.setAttribute('aria-controls', `extension-${reserva.id}`);
  const formulario = document.createElement('form');
  formulario.id = `extension-${reserva.id}`;
  formulario.hidden = true;
  const etiqueta = document.createElement('label');
  etiqueta.textContent = 'Noches extra';
  const noches = document.createElement('input');
  noches.type = 'number';
  noches.min = '1';
  noches.max = '30';
  noches.step = '1';
  noches.required = true;
  noches.value = '1';
  etiqueta.append(noches);
  const cotizar = document.createElement('button');
  cotizar.type = 'submit';
  cotizar.className = 'boton boton-secundario';
  cotizar.textContent = 'Ver cotización';
  const resumen = document.createElement('p');
  resumen.setAttribute('role', 'status');
  const error = document.createElement('p');
  error.className = 'mensaje-error';
  error.setAttribute('role', 'alert');
  const confirmarExtension = document.createElement('button');
  confirmarExtension.type = 'button';
  confirmarExtension.className = 'boton boton-primario';
  confirmarExtension.textContent = 'Confirmar extensión y pagar';
  confirmarExtension.hidden = true;
  const ayuda = document.createElement('p');
  ayuda.className = 'ayuda';
  ayuda.textContent = 'Pagás todas las noches extra en un solo pago. Una vez pagada, la extensión no se puede cancelar.';
  formulario.append(etiqueta, cotizar, resumen, ayuda, error, confirmarExtension);
  cuerpo.append(abrir, formulario);
  let cotizacion = null;
  let ocupado = false;
  let creada = false;
  const ocupar = valor => {
    ocupado = valor;
    noches.disabled = valor;
    cotizar.disabled = valor;
    confirmarExtension.disabled = valor;
  };
  abrir.addEventListener('click', () => {
    formulario.hidden = !formulario.hidden;
    abrir.setAttribute('aria-expanded', String(!formulario.hidden));
    if (!formulario.hidden) noches.focus();
  });
  noches.addEventListener('input', () => {
    cotizacion = null;
    confirmarExtension.hidden = true;
    resumen.textContent = '';
    error.textContent = '';
  });
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (ocupado || creada) return;
    const cantidad = Number(noches.value);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 30) {
      error.textContent = 'Ingresá una cantidad entera de noches, entre 1 y 30.';
      return;
    }
    ocupar(true);
    cotizacion = null;
    confirmarExtension.hidden = true;
    resumen.textContent = '';
    error.textContent = '';
    try {
      const datos = await pedirExtension(`/reservas/extension?reserva_id=${encodeURIComponent(reserva.id)}&noches=${cantidad}`);
      if (Number(noches.value) !== cantidad) return;
      cotizacion = normalizarCotizacionExtension(datos, reserva, cantidad);
      resumen.textContent = `${cantidad} ${cantidad === 1 ? 'noche extra' : 'noches extra'} · Salida: ${fechaDePagoVisible(cotizacion.egreso)} · Total a pagar: ${formatearPrecio(cotizacion.importe_total)}${cotizacion.porcentaje_descuento ? ` · ${cotizacion.porcentaje_descuento} % de descuento por estadía larga` : ''}`;
      confirmarExtension.hidden = false;
    } catch (problema) {
      error.textContent = problema.message || MENSAJE_SIN_CONEXION;
    } finally {
      ocupar(false);
    }
  });
  confirmarExtension.addEventListener('click', async () => {
    if (ocupado || creada || !cotizacion || Number(noches.value) !== Number(cotizacion.noches)) return;
    ocupar(true);
    error.textContent = '';
    try {
      const acepta = await confirmar({
        titulo: '¿Confirmar la extensión?',
        detalle: 'Se reserva al precio vigente y se confirma al pagarla entera. Una vez pagada no se puede cancelar. Revisá el importe final antes de pagar.',
        datos: [['Noches extra', String(cotizacion.noches)], ['Salida', fechaDePagoVisible(cotizacion.egreso)], ['Total cotizado', formatearPrecio(cotizacion.importe_total)]],
        textoConfirmar: 'Confirmar y pagar',
        textoCancelar: 'Seguir revisando',
      });
      if (!acepta) return;
      // Un envío incierto se resuelve recargando Mis reservas, sin repetir el POST.
      creada = true;
      const resultado = await pedirExtension('/reservas/extender', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserva_id: reserva.id, noches: Number(cotizacion.noches) }),
      });
      const id = PagosModelo.identificador(resultado.reserva?.id ?? resultado.reserva_id);
      if (!id || id === String(reserva.id)) throw new Error('No recibimos el identificador de la extensión.');
      resumen.textContent = 'Extensión creada. Continuá con el pago.';
      window.location.href = `pagar.html?reserva_id=${encodeURIComponent(id)}&tipo=sena`;
    } catch (problema) {
      error.textContent = `${problema.message || MENSAJE_SIN_CONEXION}${creada ? ' Actualizá Mis reservas para comprobar si se creó antes de volver a intentar.' : ''}`;
    } finally {
      ocupar(creada);
    }
  });
}

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
    ["Egreso", salidaDeReserva(reserva)],
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
  const tieneExtensiones = extensionesDeReserva(reserva).length > 0;
  personas.textContent = `${reserva.noches} ${reserva.noches === 1 ? "noche" : "noches"}${tieneExtensiones ? ' en la reserva original' : ''} · ${reserva.personas} ${reserva.personas === 1 ? "huésped" : "huéspedes"}`;
  const total = document.createElement("p");
  total.className = "total-reserva";
  const monto = document.createElement("strong");
  monto.textContent = formatearPrecio(reserva.importe_total);
  total.append(monto, tieneExtensiones ? ' reserva original' : " total");
  const detalles = document.createElement("details");
  detalles.className = "opciones-reserva";
  const summary = document.createElement("summary");
  summary.textContent = "Importes y opciones";
  detalles.append(summary);
  const datos = document.createElement("dl");
  datos.className = "datos";
  agregarDato(
    datos,
    tieneExtensiones ? 'Total de la reserva original' : "Total de la estadía",
    formatearPrecio(reserva.importe_total),
  );
  agregarDato(datos, "Seña", formatearPrecio(reserva.importe_sena));
  detalles.append(datos);
  if (reserva.puede_cancelar && reserva.estado !== 'no_show' && !(reserva.extiende_reserva_id && reserva.estado === 'confirmada')) {
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
  if (reserva.estado === 'no_show') {
    const aviso = document.createElement('p');
    aviso.className = 'aviso';
    aviso.textContent = 'No te presentaste: se retuvo lo pagado';
    cuerpo.append(aviso);
  }
  mostrarCancelacion(reserva, cuerpo);
  mostrarPagoDeReserva(reserva, cuerpo, datos);
  mostrarExtensiones(reserva, cuerpo);
  mostrarFormularioExtension(reserva, cuerpo);
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
    ["pendiente", "pendiente_pago", "confirmada"].includes(r.estado) &&
    (salidaDeReserva(r) >= hoy || (r.estado === 'confirmada' && r.puede_extender === true));
  const agrupadas = agruparReservas(reservasActuales);
  const proximas = agrupadas
    .filter(proxima)
    .sort((a, b) => a.ingreso.localeCompare(b.ingreso));
  const historial = agrupadas
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
        [Number(cuenta.pagado.saldo) > 0 ? "Retención (todo lo pagado)" : `Retención (${formatearPorcentaje(cuenta.porcentaje_retencion)} de la seña)`, formatearPrecio(cuenta.retencion)],
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
