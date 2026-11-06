// Las comisiones del administrador (vistas/liquidaciones/comisiones.html), RF-09.
// Pide GET /administrador/comisiones y arma una fila por estadía: la unidad, las fechas, el propietario,
// la base, su comisión, el estado y el enlace al comprobante para facturarla aparte (RF-19).
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).

// Una celda con su texto (textContent: los datos nunca se interpretan como HTML)
function celdaConTexto(texto) {
  const celda = document.createElement("td");
  celda.textContent = texto;
  return celda;
}

// La fila de una comisión. La unidad es el encabezado de la fila (th scope="row"):
// el lector de pantalla lo anuncia al recorrer cada celda.
function armarFila(comision) {
  const fila = document.createElement("tr");

  const encabezado = document.createElement("th");
  encabezado.scope = "row";
  encabezado.textContent = comision.reserva.unidad.nombre;
  const localidad = document.createElement("span");
  localidad.className = "localidad";
  localidad.textContent = `${comision.reserva.unidad.localidad}, ${comision.reserva.unidad.provincia}`;
  encabezado.appendChild(localidad);
  fila.appendChild(encabezado);

  fila.appendChild(
    celdaConTexto(
      `${formatearFecha(comision.reserva.ingreso)} al ${formatearFecha(comision.reserva.egreso)}`,
    ),
  );
  fila.appendChild(celdaConTexto(comision.propietario));
  fila.appendChild(celdaConTexto(formatearPrecio(comision.base_comisiones)));

  const celdaComision = document.createElement("td");
  const monto = document.createElement("strong");
  monto.textContent = formatearPrecio(comision.comision);
  const porcentaje = document.createElement("span");
  porcentaje.className = "ayuda";
  porcentaje.textContent = formatearPorcentaje(comision.porcentaje);
  celdaComision.append(monto, porcentaje);
  fila.appendChild(celdaComision);

  const celdaEstado = document.createElement("td");
  const estado = LiquidacionesModelo.estado(comision.estado);
  const badge = document.createElement("span");
  badge.className = `estado ${estado.clase}`;
  badge.textContent = estado.texto;
  celdaEstado.appendChild(badge);
  // Si está retenida, el motivo va en la misma celda: es la respuesta a "por qué no me pagaron" (RN-16)
  if (comision.faltante !== null) {
    const motivo = document.createElement("span");
    motivo.className = "ayuda";
    motivo.textContent = `Falta cobrar ${formatearPrecio(comision.faltante)}`;
    celdaEstado.appendChild(motivo);
  }
  fila.appendChild(celdaEstado);

  const celdaAccion = document.createElement("td");
  const enlace = document.createElement("a");
  enlace.href = `comprobante.html?id=${comision.id}`;
  enlace.className = "boton boton-outline";
  enlace.textContent = "Comprobante";
  const nombreOculto = document.createElement("span");
  nombreOculto.className = "visualmente-oculto";
  nombreOculto.textContent = ` de ${comision.reserva.unidad.nombre}`;
  enlace.appendChild(nombreOculto);
  celdaAccion.appendChild(enlace);
  fila.appendChild(celdaAccion);

  return fila;
}

// El resumen de arriba: cuánto hay en cada estado. Los estados sin ninguna comisión no se muestran.
function armarResumen(comisiones) {
  const totales = LiquidacionesModelo.totales(comisiones, "comision");
  const resumen = document.getElementById("resumen-comisiones");
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

// Pide las comisiones y las muestra: la tabla, o el aviso de que todavía no hay ninguna
async function cargarComisiones() {
  const cargando = document.getElementById("cargando");
  const error = document.getElementById("mensaje-error");
  const reintentar = document.getElementById("reintentar");
  error.textContent = "";
  reintentar.hidden = true;
  cargando.hidden = false;

  let comisiones;
  try {
    const { respuesta, resultado } = await pedirAlBack("/administrador/comisiones");
    if (!respuesta.ok) {
      // 401 o 403: proteger-pagina.js ya está redirigiendo
      return;
    }
    comisiones = resultado.comisiones;
  } catch (fallo) {
    console.error("No se pudieron cargar las comisiones:", fallo);
    cargando.hidden = true;
    error.textContent = MENSAJE_SIN_CONEXION;
    reintentar.hidden = false;
    return;
  }

  cargando.hidden = true;
  document.getElementById("sin-comisiones").hidden = comisiones.length > 0;
  armarResumen(comisiones);
  document
    .getElementById("filas-comisiones")
    .replaceChildren(...comisiones.map(armarFila));
  document.getElementById("tabla-comisiones").hidden = comisiones.length === 0;
}

document.getElementById("reintentar").addEventListener("click", cargarComisiones);
cargarComisiones();
