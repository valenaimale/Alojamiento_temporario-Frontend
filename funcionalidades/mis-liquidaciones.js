// Las liquidaciones del propietario (vistas/liquidaciones/mis-liquidaciones.html), RF-13.
// Pide GET /liquidaciones/mias y arma una tarjeta por estadía: la unidad y las fechas, el estado, el importe
// cobrado, las comisiones y lo que le queda, con el enlace al comprobante.
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).
// Las reglas de qué se muestra están en liquidaciones-modelo.js, que se prueba con Node.

// Un <span class="estado ..."> con el nombre del estado
function badgeDeEstado(nombre) {
  const estado = LiquidacionesModelo.estado(nombre);
  const badge = document.createElement("span");
  badge.className = `estado ${estado.clase}`;
  badge.textContent = estado.texto;
  return badge;
}

// Una línea del detalle: el concepto a la izquierda y el importe a la derecha.
// $signo: '-' para las comisiones, '=' para el total (se usa para el estilo y para que se lea bien).
function lineaDeDetalle(concepto, importe, signo = "") {
  const linea = document.createElement("div");
  linea.className = signo === "=" ? "linea-detalle linea-total" : "linea-detalle";

  const texto = document.createElement("span");
  texto.textContent = concepto;
  const monto = document.createElement("strong");
  // El menos va pegado al importe y no como texto suelto: "−$26.342,98" se entiende sin leer la fila entera
  monto.textContent = (signo === "-" ? "−" : "") + formatearPrecio(importe);
  linea.append(texto, monto);
  return linea;
}

// La tarjeta de una liquidación
function armarTarjeta(liquidacion) {
  const item = document.createElement("li");
  item.className = "tarjeta tarjeta-liquidacion";

  const encabezado = document.createElement("header");
  const titulo = document.createElement("h2");
  titulo.textContent = liquidacion.reserva.unidad.nombre;
  const fechas = document.createElement("p");
  fechas.className = "ayuda";
  fechas.textContent =
    `Estadía del ${formatearFecha(liquidacion.reserva.ingreso)} al ` +
    `${formatearFecha(liquidacion.reserva.egreso)} · ${liquidacion.reserva.noches} ` +
    `${liquidacion.reserva.noches === 1 ? "noche" : "noches"} · ${liquidacion.reserva.huesped}`;
  const columna = document.createElement("div");
  columna.append(titulo, fechas);
  encabezado.append(columna, badgeDeEstado(liquidacion.estado));
  item.appendChild(encabezado);

  // El motivo por el que está retenida, con cuánto falta cobrar (RN-16)
  if (liquidacion.faltante !== null) {
    const aviso = document.createElement("p");
    aviso.className = "aviso-retenida";
    aviso.textContent =
      `${LiquidacionesModelo.estado(liquidacion.estado).ayuda} ` +
      `Falta cobrar ${formatearPrecio(liquidacion.faltante)} de esta reserva.`;
    item.appendChild(aviso);
  }

  const detalle = document.createElement("div");
  detalle.className = "detalle-liquidacion";
  detalle.append(
    lineaDeDetalle("Importe cobrado al huésped", liquidacion.importe_cobrado),
  );
  if (liquidacion.cobra_iva) {
    detalle.append(
      lineaDeDetalle(
        `IVA incluido (${formatearPorcentaje(liquidacion.porcentaje_iva)})`,
        liquidacion.importe_iva,
      ),
    );
  }
  detalle.append(
    lineaDeDetalle(
      `Comisión de la plataforma (${formatearPorcentaje(liquidacion.porcentaje_comision_plataforma)})`,
      liquidacion.comision_plataforma,
      "-",
    ),
  );
  if (liquidacion.administrador !== null) {
    detalle.append(
      lineaDeDetalle(
        `Comisión de ${liquidacion.administrador.nombre} ` +
          `(${formatearPorcentaje(liquidacion.administrador.porcentaje)})`,
        liquidacion.comision_administrador,
        "-",
      ),
    );
  }
  detalle.append(
    lineaDeDetalle("Te queda", liquidacion.importe_propietario, "="),
  );
  item.appendChild(detalle);

  const acciones = document.createElement("div");
  acciones.className = "acciones-liquidacion";
  const comprobante = document.createElement("a");
  comprobante.href = `comprobante.html?id=${liquidacion.id}`;
  comprobante.className = "boton boton-outline";
  comprobante.textContent = "Ver comprobante";
  // El nombre oculto hace que el enlace se entienda solo ("Ver comprobante de Casa del Bosque")
  const nombreOculto = document.createElement("span");
  nombreOculto.className = "visualmente-oculto";
  nombreOculto.textContent = ` de ${liquidacion.reserva.unidad.nombre}`;
  comprobante.appendChild(nombreOculto);
  acciones.appendChild(comprobante);
  if (liquidacion.liquidada_en !== null) {
    const pagada = document.createElement("p");
    pagada.className = "ayuda";
    pagada.textContent = `Transferida el ${formatearFecha(liquidacion.liquidada_en)}`;
    acciones.appendChild(pagada);
  }
  item.appendChild(acciones);

  return item;
}

// El resumen de arriba: cuánto hay en cada estado. Los estados sin ninguna liquidación no se muestran.
function armarResumen(liquidaciones) {
  const totales = LiquidacionesModelo.totales(liquidaciones, "importe_propietario");
  const resumen = document.getElementById("resumen-liquidaciones");
  resumen.replaceChildren();

  for (const [nombre, { cantidad, total }] of Object.entries(totales)) {
    if (cantidad === 0) continue;
    const termino = document.createElement("dt");
    termino.textContent = LiquidacionesModelo.estado(nombre).texto;
    const valor = document.createElement("dd");
    valor.textContent = formatearPrecio(total);
    const detalle = document.createElement("span");
    detalle.className = "ayuda";
    detalle.textContent = cantidad === 1 ? "1 estadía" : `${cantidad} estadías`;
    valor.appendChild(detalle);
    // dt y dd van juntos en un <div> para que formen una tarjeta (el HTML lo permite dentro de un <dl>)
    const grupo = document.createElement("div");
    grupo.append(termino, valor);
    resumen.appendChild(grupo);
  }
  resumen.hidden = resumen.children.length === 0;
}

// Pide las liquidaciones y las muestra: las tarjetas, o el aviso de que todavía no hay ninguna
async function cargarLiquidaciones() {
  const cargando = document.getElementById("cargando");
  const error = document.getElementById("mensaje-error");
  const reintentar = document.getElementById("reintentar");
  error.textContent = "";
  reintentar.hidden = true;
  cargando.hidden = false;

  let liquidaciones;
  try {
    const { respuesta, resultado } = await pedirAlBack("/liquidaciones/mias");
    if (!respuesta.ok) {
      // 401 o 403: proteger-pagina.js ya está redirigiendo
      return;
    }
    liquidaciones = resultado.liquidaciones;
  } catch (fallo) {
    console.error("No se pudieron cargar las liquidaciones:", fallo);
    cargando.hidden = true;
    error.textContent = MENSAJE_SIN_CONEXION;
    reintentar.hidden = false;
    return;
  }

  cargando.hidden = true;
  document.getElementById("sin-liquidaciones").hidden = liquidaciones.length > 0;
  armarResumen(liquidaciones);
  document
    .getElementById("lista-liquidaciones")
    .replaceChildren(...liquidaciones.map(armarTarjeta));
}

document
  .getElementById("reintentar")
  .addEventListener("click", cargarLiquidaciones);
cargarLiquidaciones();
