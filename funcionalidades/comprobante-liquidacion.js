// El comprobante sin valor fiscal de una liquidación (vistas/liquidaciones/comprobante.html), RN-25.
// Pide GET /liquidaciones/comprobante?id= y arma el comprobante que corresponda: el del propietario, con todo
// el reparto (RF-13), o el del administrador, con su comisión y su condición fiscal (RF-19). Lo decide el
// backend y lo dice en "para": el front no elige qué mostrar, solo cómo.
//
// Esta página la pueden ver tres roles (propietario, administrador y backoffice), así que no usa
// proteger-pagina.js, que protege una página para un solo rol: la sesión se controla acá.

const ROLES_QUE_PUEDEN_VER = ["propietario", "administrador", "backoffice"];

// Un par "término: valor" del encabezado del comprobante
function dato(termino, valor) {
  const dt = document.createElement("dt");
  dt.textContent = termino;
  const dd = document.createElement("dd");
  dd.textContent = valor;
  return [dt, dd];
}

// Cómo se nombra la condición fiscal de alguien. Es lo que el contador necesita leer en el comprobante.
function condicionFiscal(parte) {
  return parte.cobra_iva ? "responsable inscripto" : "no discrimina IVA";
}

// El documento con el que se identifica: el CUIT si discrimina IVA, y el DNI si no (lo pidió el contador)
function documentoDe(parte) {
  if (parte.cuit) {
    return `CUIT ${parte.cuit}`;
  }
  return parte.dni ? `DNI ${parte.dni}` : "sin CUIT ni DNI cargado";
}

// Los datos de la estadía que liquida
function mostrarEstadia(comprobante) {
  const reserva = comprobante.reserva;
  document.getElementById("datos-estadia").replaceChildren(
    ...dato("Alojamiento", `${reserva.unidad.nombre} · ${reserva.unidad.localidad}, ${reserva.unidad.provincia}`),
    ...dato("Reserva", `N.º ${reserva.id}`),
    ...dato(
      "Estadía",
      `Del ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)} · ` +
        `${reserva.noches} ${reserva.noches === 1 ? "noche" : "noches"} · ` +
        `${reserva.personas} ${reserva.personas === 1 ? "persona" : "personas"}`,
    ),
    ...dato("Huésped", reserva.huesped),
  );
}

// Las partes: quién cobra y quién factura. El comprobante del administrador solo nombra al propietario.
function mostrarPartes(comprobante) {
  const partes = [];
  if (comprobante.para === "propietario") {
    partes.push(
      ...dato(
        "Propietario",
        `${comprobante.propietario.nombre} · ${documentoDe(comprobante.propietario)} · ` +
          condicionFiscal(comprobante.propietario),
      ),
    );
    if (comprobante.administrador !== null) {
      partes.push(
        ...dato(
          "Administrador",
          `${comprobante.administrador.nombre} · ${documentoDe(comprobante.administrador)} · ` +
            `${condicionFiscal(comprobante.administrador)} · factura su comisión aparte`,
        ),
      );
    } else {
      partes.push(...dato("Administración", "La unidad es de autogestión"));
    }
  } else {
    partes.push(
      ...dato(
        "Administrador",
        `${comprobante.administrador.nombre} · ${documentoDe(comprobante.administrador)} · ` +
          condicionFiscal(comprobante.administrador),
      ),
      ...dato("Propietario", comprobante.propietario.nombre),
    );
  }
  partes.push(...dato("Estado", LiquidacionesModelo.estado(comprobante.estado).texto));
  if (comprobante.liquidada_en !== null) {
    partes.push(...dato("Fecha de liquidación", formatearFecha(comprobante.liquidada_en)));
  }
  document.getElementById("datos-partes").replaceChildren(...partes);
}

// El detalle: una fila por concepto, con el importe a la derecha. El orden y los signos salen del modelo.
function mostrarDetalle(comprobante) {
  const filas =
    comprobante.para === "propietario"
      ? LiquidacionesModelo.filasDelPropietario(comprobante)
      : LiquidacionesModelo.filasDelAdministrador(comprobante);

  document.getElementById("filas-detalle").replaceChildren(
    ...filas.map((fila) => {
      const tr = document.createElement("tr");
      if (fila.destacada) {
        tr.className = "fila-total";
      }

      const concepto = document.createElement("th");
      concepto.scope = "row";
      concepto.textContent =
        fila.porcentaje === null
          ? fila.concepto
          : `${fila.concepto} (${formatearPorcentaje(fila.porcentaje)})`;

      const importe = document.createElement("td");
      importe.className = "importe";
      // El menos va pegado al importe: "−$26.342,98" se entiende sin leer la fila entera
      importe.textContent = (fila.signo === "-" ? "−" : "") + formatearPrecio(fila.importe);

      tr.append(concepto, importe);
      return tr;
    }),
  );
}

// Pide el comprobante y lo muestra
async function cargarComprobante() {
  const cargando = document.getElementById("cargando");
  const error = document.getElementById("mensaje-error");

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    cargando.hidden = true;
    error.textContent = "No encontramos ese comprobante.";
    return;
  }

  let comprobante;
  try {
    const { respuesta, resultado } = await pedirAlBack(
      `/liquidaciones/comprobante?id=${encodeURIComponent(id)}`,
    );
    if (!respuesta.ok) {
      cargando.hidden = true;
      error.textContent = resultado.error ?? "No pudimos mostrar el comprobante.";
      return;
    }
    comprobante = resultado.comprobante;
  } catch (fallo) {
    console.error("No se pudo cargar el comprobante:", fallo);
    cargando.hidden = true;
    error.textContent = MENSAJE_SIN_CONEXION;
    return;
  }

  document.getElementById("numero").textContent =
    `N.º ${comprobante.numero} · emitido el ${formatearFecha(comprobante.creado_en)}`;
  mostrarEstadia(comprobante);
  mostrarPartes(comprobante);
  mostrarDetalle(comprobante);

  // Si está retenida por deuda, se dice en el comprobante: no se liquida lo que todavía no se cobró (RN-16)
  if (comprobante.faltante !== null) {
    const aviso = document.getElementById("aviso-retenida");
    aviso.textContent =
      `Esta liquidación está retenida: falta cobrar ${formatearPrecio(comprobante.faltante)} ` +
      "de la reserva. No se liquida lo que todavía no se cobró.";
    aviso.hidden = false;
  }

  // "Volver" lleva a la pantalla del rol que está mirando
  document.getElementById("volver").href =
    comprobante.para === "administrador" ? "comisiones.html" : "mis-liquidaciones.html";

  cargando.hidden = true;
  document.getElementById("comprobante").hidden = false;
  document.getElementById("imprimir").hidden = false;
}

// Controla la sesión (tres roles pueden ver esta página) y después carga el comprobante
async function abrirPagina() {
  let usuario;
  try {
    usuario = await obtenerSesion();
  } catch (fallo) {
    mostrarPantallaSinConexion(fallo);
    return;
  }
  if (usuario === null) {
    window.location.href = "../sesion/inicio-sesion.html";
    return;
  }
  if (!ROLES_QUE_PUEDEN_VER.includes(usuario.rol)) {
    window.location.href = "../errores/acceso-denegado.html";
    return;
  }

  armarMenu(usuario.rol);
  document.body.hidden = false;
  await cargarComprobante();
}

document
  .getElementById("imprimir")
  .addEventListener("click", () => window.print());
abrirPagina();
