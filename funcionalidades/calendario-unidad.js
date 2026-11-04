// Un calendario para las operaciones existentes. Los permisos y las validaciones finales son del backend.
(() => {
  const M = CalendarioModelo;
  const $ = (id) => document.getElementById(id);
  const hoy = M.hoyArgentina();
  const estado = {
    id: null,
    unidad: null,
    mes: hoy.slice(0, 7),
    desde: null,
    hasta: null,
    ancla: null,
    accion: "precio",
    temporada: null,
    noches: [],
    temporadas: [],
    bloqueos: [],
    reservas: [],
    listo: false,
    guardando: false,
    peticion: 0,
    foco: null,
  };
  const nombresEstado = {
    libre: "Libre",
    reservada: "Reservada",
    bloqueada: "Bloqueada",
    "sin-precio": "Sin precio",
    pasada: "Pasada",
  };
  const motivos = {
    reserva_externa: "Reserva por otro medio",
    mantenimiento: "Mantenimiento",
    danio: "Daños",
    uso_personal: "Uso personal",
    otro: "Otro motivo",
  };
  const estadosReserva = {
    pendiente: "Pendiente de pago",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
  };
  const precioBreve = (valor) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(Number(valor));
  const fechaBreve = (texto) =>
    new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(
      new Date(texto + "T12:00:00"),
    );
  const periodo = (desde, hasta) =>
    `${formatearFecha(desde)} – ${formatearFecha(hasta)}`;
  const el = (tag, texto, clase) => {
    const nodo = document.createElement(tag);
    if (texto !== undefined) nodo.textContent = texto;
    if (clase) nodo.className = clase;
    return nodo;
  };
  function boton(texto, accion, clase = "boton") {
    const nodo = el("button", texto, clase);
    nodo.type = "button";
    nodo.addEventListener("click", accion);
    return nodo;
  }
  async function pedir(ruta, opciones) {
    const { respuesta, resultado } = await pedirAlBack(ruta, opciones);
    if (!respuesta.ok) {
      const error = new Error(
        resultado.error || "No pudimos completar la operación.",
      );
      error.faltantes = resultado.faltantes;
      throw error;
    }
    return resultado;
  }
  function textoError(error) {
    return error instanceof TypeError ? MENSAJE_SIN_CONEXION : error.message;
  }
  function limitesMes() {
    const [anio, mes] = estado.mes.split("-").map(Number);
    const dias = new Date(anio, mes, 0).getDate();
    return { desde: estado.mes + "-01", hasta: estado.mes + "-" + dias };
  }
  function presentarPublicacion() {
    const u = estado.unidad;
    $("estado-unidad").textContent =
      NOMBRES_DE_ESTADO[u.estado_publicacion] || u.estado_publicacion;
    $("estado-unidad").className =
      "estado " +
      (u.estado_publicacion === "publicada"
        ? "estado-publicada"
        : "estado-no-publicada");
    $("aviso-publicacion").textContent = !u.disponible
      ? "Fuera de servicio: " +
        (u.motivo_no_disponible || "el alojamiento no está disponible.")
      : u.estado_publicacion === "publicada"
        ? "Publicado. Los huéspedes pueden reservar las noches disponibles."
        : "Este alojamiento no aparece en la búsqueda. Las reservas existentes se conservan.";
    $("accion-publicacion").textContent =
      u.estado_publicacion === "publicada"
        ? "Pausar publicación"
        : "Publicar alojamiento";
    $("accion-publicacion").hidden = !u.es_propietario;
    mostrarFaltantes(u.estado_publicacion === "publicada" ? [] : u.faltantes);
  }
  function mostrarFaltantes(items = []) {
    $("lista-faltantes").replaceChildren(
      ...items.map((item) => el("li", item)),
    );
    $("lista-faltantes").hidden = items.length === 0;
  }
  function habilitar() {
    const ocupado = estado.guardando;
    document
      .querySelectorAll(
        ".barra-mes button,.barra-mes input,#accion-publicacion",
      )
      .forEach((n) => (n.disabled = ocupado));
    $("form-rango")
      .querySelectorAll("input,button")
      .forEach((n) => (n.disabled = ocupado || !estado.listo));
    document
      .querySelectorAll("[data-accion]")
      .forEach((n) => (n.disabled = ocupado || !estado.listo));
    ["precio", "temporada", "bloqueo"].forEach((tipo) => {
      $("campos-" + tipo).disabled =
        ocupado || !estado.listo || estado.accion !== tipo;
    });
    $("guardar-cambio").disabled = ocupado || !estado.listo;
    $("limpiar-seleccion").disabled = ocupado;
    $("edicion-rango").hidden = !estado.desde || !estado.listo;
    document
      .querySelectorAll(
        ".lista-actividad button,#filas-reservas button,#detalle-seleccion button",
      )
      .forEach((n) => (n.disabled = ocupado || !estado.listo));
  }
  async function cargar() {
    const peticion = ++estado.peticion;
    estado.listo = false;
    habilitar();
    const tabla = document.querySelector(".tabla-calendario");
    tabla.setAttribute("aria-busy", "true");
    $("estado-carga").textContent = "Cargando calendario…";
    $("error-calendario").textContent = "";
    $("reintentar-calendario").hidden = true;
    // Se retiran celdas anteriores: nunca quedan como disponibilidad válida si falla una fuente.
    $("dias-del-mes").replaceChildren();
    $("titulo-mes").textContent = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(new Date(estado.mes + "-01T12:00:00"));
    $("elegir-mes").value = estado.mes;
    const { desde, hasta } = limitesMes();
    try {
      const [precios, temporadas, bloqueos, reservas] = await Promise.all([
        pedir(
          `/unidades/precios?id=${estado.id}&desde=${desde}&hasta=${hasta}`,
        ),
        pedir(`/unidades/temporadas?id=${estado.id}`),
        pedir(`/unidades/bloqueos?id=${estado.id}`),
        pedir(`/unidades/reservas?id=${estado.id}`),
      ]);
      if (peticion !== estado.peticion) return;
      Object.assign(estado, {
        noches: precios.noches,
        temporadas: temporadas.temporadas,
        bloqueos: bloqueos.bloqueos,
        reservas: reservas.reservas,
        listo: true,
      });
      $("ayuda-precio").textContent =
        `Precio final${precios.cobra_iva ? ", con IVA incluido" : ""} para todas las noches seleccionadas. Las reservas existentes conservan su precio.`;
      dibujar();
      presentarListas();
      presentarSeleccion();
    } catch (error) {
      if (peticion !== estado.peticion) return;
      $("error-calendario").textContent =
        textoError(error) +
        " No podemos confirmar la disponibilidad hasta volver a cargar.";
      $("reintentar-calendario").hidden = false;
    } finally {
      if (peticion === estado.peticion) {
        tabla.setAttribute("aria-busy", "false");
        $("estado-carga").textContent = "";
        habilitar();
      }
    }
  }
  function dibujar() {
    const cuerpo = $("dias-del-mes");
    cuerpo.replaceChildren();
    let fila = el("tr");
    const huecos = (new Date(estado.mes + "-01T12:00:00").getDay() + 6) % 7;
    for (let i = 0; i < huecos; i++) fila.append(el("td"));
    const fechaFoco =
      estado.foco && estado.foco.startsWith(estado.mes)
        ? estado.foco
        : estado.noches.find((n) => n.fecha >= hoy)?.fecha ||
          estado.noches[0]?.fecha;
    for (const noche of estado.noches) {
      const tipo = M.estadoNoche(noche, estado.reservas, estado.bloqueos, hoy);
      const enRango =
        estado.desde &&
        noche.fecha >= estado.desde &&
        noche.fecha <= estado.hasta;
      const extremo =
        noche.fecha === estado.desde || noche.fecha === estado.hasta;
      const btn = boton(
        "",
        () => elegir(noche.fecha),
        `dia-gestion ${tipo}${enRango ? " en-rango" : ""}${extremo ? " extremo" : ""}`,
      );
      btn.dataset.fecha = noche.fecha;
      btn.tabIndex = noche.fecha === fechaFoco ? 0 : -1;
      btn.setAttribute("aria-pressed", String(Boolean(enRango)));
      btn.setAttribute(
        "aria-label",
        `${formatearFecha(noche.fecha)}, ${nombresEstado[tipo]}${tipo === "pasada" ? ", historial de ocupación incompleto" : ""}, ${noche.precio === null ? "sin precio" : formatearPrecio(noche.precio)}${noche.temporada ? ", temporada " + noche.temporada + ", mínimo " + noche.minimo_noches + " noches" : ""}`,
      );
      if (noche.fecha === hoy) btn.setAttribute("aria-current", "date");
      btn.append(el("span", Number(noche.fecha.slice(8)), "numero-dia"));
      btn.append(
        el(
          "span",
          noche.precio === null ? "—" : precioBreve(noche.precio),
          "precio-dia",
        ),
      );
      if (tipo !== "libre" && tipo !== "pasada") {
        const etiqueta = el("span", nombresEstado[tipo], "estado-dia");
        etiqueta.dataset.corto = {
          reservada: "Reserva",
          bloqueada: "Bloq.",
          "sin-precio": "Sin precio",
        }[tipo];
        btn.append(etiqueta);
      }
      if (noche.temporada)
        btn.append(
          el(
            "span",
            noche.temporada + " · mín. " + noche.minimo_noches,
            "minimo-dia",
          ),
        );
      btn.addEventListener("keydown", moverTeclado);
      const celda = el("td");
      celda.append(btn);
      fila.append(celda);
      if (fila.children.length === 7) {
        cuerpo.append(fila);
        fila = el("tr");
      }
    }
    if (fila.children.length) {
      while (fila.children.length < 7) fila.append(el("td"));
      cuerpo.append(fila);
    }
  }
  function enfocar(fecha) {
    $("dias-del-mes").querySelector(`[data-fecha="${fecha}"]`)?.focus();
  }
  async function moverTeclado(evento) {
    const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const fecha = evento.currentTarget.dataset.fecha;
    let destino;
    if (evento.key in pasos) destino = M.sumar(fecha, pasos[evento.key]);
    else if (evento.key === "Home") destino = estado.mes + "-01";
    else if (evento.key === "End") destino = limitesMes().hasta;
    else if (evento.key === "Escape") {
      limpiar();
      return;
    } else return;
    evento.preventDefault();
    estado.foco = destino;
    if (!destino.startsWith(estado.mes)) {
      estado.mes = destino.slice(0, 7);
      await cargar();
    } else dibujar();
    enfocar(destino);
  }
  function elegir(fecha) {
    if (!estado.listo || estado.guardando) return;
    if (fecha < hoy) {
      $("error-panel").textContent =
        "Las noches pasadas son de consulta. Seleccioná noches desde hoy para hacer cambios.";
      return;
    }
    estado.temporada = null;
    if (estado.ancla === null) {
      estado.ancla = fecha;
      estado.desde = fecha;
      estado.hasta = fecha;
    } else {
      [estado.desde, estado.hasta] = [estado.ancla, fecha].sort();
      estado.ancla = null;
    }
    estado.foco = fecha;
    $("ok-cambio").textContent = "";
    $("error-panel").textContent = "";
    $("error-cambio").textContent = "";
    dibujar();
    presentarSeleccion(true);
    enfocar(fecha);
  }
  function limpiar() {
    Object.assign(estado, {
      desde: null,
      hasta: null,
      ancla: null,
      temporada: null,
    });
    $("form-rango").reset();
    $("ok-cambio").textContent = "";
    $("error-panel").textContent = "";
    $("error-cambio").textContent = "";
    dibujar();
    presentarSeleccion();
  }
  function presentarSeleccion(prefill = false) {
    const { desde, hasta } = estado;
    $("limpiar-seleccion").hidden = !desde;
    $("titulo-seleccion").textContent = desde
      ? fechaBreve(desde) + (hasta !== desde ? " – " + fechaBreve(hasta) : "")
      : "Elegí las noches";
    $("resumen-seleccion").textContent = desde
      ? `${M.noches(desde, hasta)} ${M.noches(desde, hasta) === 1 ? "noche seleccionada" : "noches seleccionadas"} · ${periodo(desde, hasta)}${estado.ancla ? ". Tocá otra fecha para ampliar el rango." : "."}`
      : "Seleccioná un rango en el calendario para ver sus datos y hacer cambios.";
    $("detalle-seleccion").replaceChildren();
    if (desde) {
      $("form-rango").elements.desde.value = desde;
      $("form-rango").elements.hasta.value = hasta;
      const reservas = estado.reservas.filter((r) =>
        M.superpone(desde, hasta, r.ingreso, M.sumar(r.egreso, -1)),
      );
      const bloqueos = estado.bloqueos.filter((b) =>
        M.superpone(desde, hasta, b.fecha_desde, b.fecha_hasta),
      );
      for (const reserva of reservas) {
        const c = el("div", undefined, "detalle-rango");
        c.append(
          el("h3", "Reserva · " + reserva.huesped),
          el("p", periodo(reserva.ingreso, reserva.egreso)),
          el(
            "p",
            `${estadosReserva[reserva.estado] || reserva.estado} · ${formatearPrecio(reserva.importe_total)}`,
          ),
        );
        $("detalle-seleccion").append(c);
        const libro = el("a", "Ver huéspedes de esta reserva");
        libro.href = `../reservas/libro-huespedes.html?reserva_id=${reserva.id}`;
        c.append(libro);
      }
      for (const bloqueo of bloqueos) {
        const c = el("div", undefined, "detalle-rango");
        c.append(
          el("h3", "Bloqueada · " + motivos[bloqueo.motivo]),
          el("p", periodo(bloqueo.fecha_desde, bloqueo.fecha_hasta)),
          el("p", "Bloqueó " + bloqueo.creado_por),
        );
        if (bloqueo.detalle) c.append(el("p", bloqueo.detalle));
        c.append(
          boton(
            "Liberar este bloqueo completo",
            () => liberar(bloqueo),
            "boton-texto",
          ),
        );
        $("detalle-seleccion").append(c);
      }
      if (prefill) {
        const noches = estado.noches.filter(
          (n) => n.fecha >= desde && n.fecha <= hasta,
        );
        const precio =
          noches.length === M.noches(desde, hasta) &&
          noches.every((n) => n.precio === noches[0]?.precio)
            ? noches[0]?.precio
            : "";
        $("form-cambio").elements.precio.value = precio || "";
      }
    }
    seleccionarAccion(estado.accion);
    habilitar();
  }
  function seleccionarAccion(accion) {
    if (!estado.unidad?.es_propietario && accion !== "bloqueo")
      accion = "bloqueo";
    estado.accion = accion;
    document
      .querySelectorAll("[data-accion]")
      .forEach((n) =>
        n.setAttribute("aria-pressed", String(n.dataset.accion === accion)),
      );
    for (const tipo of ["precio", "temporada", "bloqueo"])
      $("campos-" + tipo).hidden = tipo !== accion;
    $("titulo-temporada").textContent = estado.temporada
      ? "Editar temporada " + estado.temporada.nombre
      : "Mínimo de noches";
    $("cancelar-edicion").hidden = !estado.temporada;
    $("guardar-cambio").textContent =
      accion === "precio"
        ? "Guardar precio"
        : accion === "bloqueo"
          ? "Bloquear noches"
          : estado.temporada
            ? "Guardar temporada"
            : "Crear temporada";
    habilitar();
  }
  async function seleccionarRango(desde, hasta, temporada = null) {
    if (!M.rangoValido(desde, hasta) || hasta < hoy) {
      $("error-panel").textContent =
        "Elegí un rango válido de hasta 366 noches, que no haya terminado.";
      return;
    }
    Object.assign(estado, {
      desde,
      hasta,
      ancla: null,
      temporada,
      foco: desde < hoy ? hoy : desde,
    });
    $("error-panel").textContent = "";
    $("error-cambio").textContent = "";
    $("ok-cambio").textContent = "";
    if (!desde.startsWith(estado.mes)) {
      estado.mes = (desde < hoy ? hoy : desde).slice(0, 7);
      await cargar();
      presentarSeleccion(true);
    } else {
      dibujar();
      presentarSeleccion(true);
    }
  }
  async function editarTemporada(t) {
    await seleccionarRango(t.fecha_inicio, t.fecha_fin, t);
    $("form-cambio").elements.nombre.value = t.nombre;
    $("form-cambio").elements.minimo_noches.value = t.minimo_noches;
    seleccionarAccion("temporada");
    $("titulo-seleccion").focus();
  }
  function presentarListas() {
    $("cantidad-reservas").textContent = estado.reservas.length;
    $("cantidad-temporadas").textContent = estado.temporadas.length;
    $("cantidad-bloqueos").textContent = estado.bloqueos.length;
    $("sin-reservas").hidden = estado.reservas.length > 0;
    $("tabla-reservas").hidden = !estado.reservas.length;
    $("filas-reservas").replaceChildren(
      ...estado.reservas.map((r) => {
        const fila = el("tr"),
          nombre = el("th", r.huesped);
        nombre.scope = "row";
        fila.append(nombre);
        for (const valor of [
          formatearFecha(r.ingreso),
          formatearFecha(r.egreso),
          r.personas,
          estadosReserva[r.estado] || r.estado,
          formatearPrecio(r.importe_total),
        ])
          fila.append(el("td", valor));
        const celda = el("td");
        celda.append(
          boton("Ver fechas", () =>
            seleccionarRango(
              r.ingreso < hoy ? hoy : r.ingreso,
              M.sumar(r.egreso, -1),
            ),
          ),
        );
        fila.append(celda);
        return fila;
      }),
    );
    $("lista-temporadas").replaceChildren(
      ...estado.temporadas.map((t) => {
        const item = el("li"),
          texto = el("div"),
          acciones = el("div", undefined, "acciones");
        texto.append(
          el("h3", "Temporada " + t.nombre),
          el(
            "p",
            `${periodo(t.fecha_inicio, t.fecha_fin)} · Mínimo ${t.minimo_noches} noches`,
          ),
        );
        acciones.append(
          boton("Ver fechas", () =>
            seleccionarRango(t.fecha_inicio, t.fecha_fin),
          ),
        );
        if (estado.unidad.es_propietario)
          acciones.append(
            boton("Editar", () => editarTemporada(t)),
            boton("Eliminar", () => borrarTemporada(t), "boton boton-peligro"),
          );
        item.append(texto, acciones);
        return item;
      }),
    );
    $("sin-bloqueos").hidden = estado.bloqueos.length > 0;
    $("lista-bloqueos").replaceChildren(
      ...estado.bloqueos.map((b) => {
        const item = el("li"),
          texto = el("div"),
          acciones = el("div", undefined, "acciones");
        texto.append(
          el("h3", motivos[b.motivo] || b.motivo),
          el("p", periodo(b.fecha_desde, b.fecha_hasta)),
          el(
            "p",
            "Bloqueó " + b.creado_por + (b.detalle ? " · " + b.detalle : ""),
          ),
        );
        acciones.append(
          boton("Ver fechas", () =>
            seleccionarRango(
              b.fecha_desde < hoy ? hoy : b.fecha_desde,
              b.fecha_hasta,
            ),
          ),
          boton("Liberar", () => liberar(b)),
        );
        item.append(texto, acciones);
        return item;
      }),
    );
  }
  // En una escritura se deshabilitan los controles. Un fallo conserva rango y valores para corregir.
  async function guardar(
    ruta,
    datos,
    errorId = "error-cambio",
    okId = "ok-cambio",
  ) {
    if (estado.guardando || !estado.listo) return false;
    estado.guardando = true;
    habilitar();
    $(errorId).textContent = "";
    $(okId).textContent = "";
    try {
      const resultado = await pedir(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidad_id: estado.id, ...datos }),
      });
      $(okId).textContent = resultado.ok;
      await cargar();
      return true;
    } catch (error) {
      $(errorId).textContent = textoError(error);
      if (error.faltantes) mostrarFaltantes(error.faltantes);
      return false;
    } finally {
      estado.guardando = false;
      habilitar();
    }
  }
  async function guardarCambio(evento) {
    evento.preventDefault();
    const { desde, hasta, accion } = estado;
    if (!M.rangoValido(desde || "", hasta || "") || hasta < hoy) {
      $("error-cambio").textContent =
        "Seleccioná un rango válido de hasta 366 noches.";
      return;
    }
    if (accion !== "temporada" && desde < hoy) {
      $("error-cambio").textContent =
        "Solo podés cambiar precios o bloquear noches desde hoy. Ajustá la primera noche.";
      return;
    }
    const datos = Object.fromEntries(new FormData($("form-cambio")));
    if (accion === "precio")
      await guardar("/unidades/precios/cargar", {
        desde,
        hasta,
        precio: datos.precio,
      });
    else if (accion === "bloqueo") {
      if (
        estado.reservas.some((r) =>
          M.superpone(desde, hasta, r.ingreso, M.sumar(r.egreso, -1)),
        )
      ) {
        $("error-cambio").textContent =
          "El rango incluye una reserva. Elegí noches que no estén reservadas.";
        return;
      }
      const ok = await guardar("/unidades/bloqueos/crear", {
        fecha_desde: desde,
        fecha_hasta: hasta,
        motivo: datos.motivo,
        detalle: datos.detalle,
      });
      if (ok) {
        $("form-cambio").elements.motivo.value = "";
        $("form-cambio").elements.detalle.value = "";
        actualizarMotivo();
      }
    } else {
      const temporal = estado.temporada;
      const ok = await guardar(
        "/unidades/temporadas/" + (temporal ? "editar" : "crear"),
        {
          nombre: datos.nombre,
          minimo_noches: datos.minimo_noches,
          fecha_inicio: desde,
          fecha_fin: hasta,
          ...(temporal ? { temporada_id: temporal.id } : {}),
        },
      );
      if (ok) {
        estado.temporada = null;
        seleccionarAccion("temporada");
      }
    }
  }
  async function liberar(b) {
    if (!estado.listo || estado.guardando) return;
    const desde = b.fecha_desde < hoy ? hoy : b.fecha_desde;
    if (
      !(await confirmar({
        titulo: "¿Liberar este bloqueo?",
        detalle: `Se liberan todas las noches del bloqueo: ${periodo(desde, b.fecha_hasta)}. Las noches pasadas se conservan.`,
        textoConfirmar: "Liberar noches",
      }))
    )
      return;
    await guardar(
      "/unidades/bloqueos/liberar",
      { bloqueo_id: b.id },
      "error-panel",
    );
    $("titulo-seleccion").focus();
  }
  async function borrarTemporada(t) {
    if (!estado.unidad.es_propietario || !estado.listo || estado.guardando)
      return;
    if (
      !(await confirmar({
        titulo: "¿Eliminar la temporada " + t.nombre + "?",
        detalle: `${periodo(t.fecha_inicio, t.fecha_fin)}. El mínimo pasa a una noche. Los precios y las reservas existentes se conservan.`,
        textoConfirmar: "Eliminar temporada",
      }))
    )
      return;
    const ok = await guardar(
      "/unidades/temporadas/borrar",
      { temporada_id: t.id },
      "error-panel",
    );
    if (ok) {
      estado.temporada = null;
      seleccionarAccion(estado.accion);
      $("titulo-seleccion").focus();
    }
  }
  async function cambiarPublicacion() {
    if (!estado.unidad.es_propietario) return;
    const accion =
      estado.unidad.estado_publicacion === "publicada" ? "pausar" : "publicar";
    if (
      accion === "pausar" &&
      !(await confirmar({
        titulo: "¿Pausar la publicación?",
        detalle:
          "El alojamiento dejará de aparecer en la búsqueda. Las reservas existentes siguen en pie.",
        textoConfirmar: "Pausar publicación",
      }))
    )
      return;
    const ok = await guardar(
      "/unidades/" + accion,
      {},
      "error-publicacion",
      "ok-publicacion",
    );
    if (ok) {
      try {
        estado.unidad = (
          await pedir("/unidades/resumen?id=" + estado.id)
        ).unidad;
        presentarPublicacion();
      } catch (error) {
        $("error-publicacion").textContent =
          "El cambio se guardó, pero no pudimos actualizar el estado. Recargá la página.";
      }
    }
  }
  function actualizarMotivo() {
    const otro = $("form-cambio").elements.motivo.value === "otro";
    $("form-cambio").elements.detalle.required = otro;
    $("etiqueta-detalle").textContent = otro
      ? "Contanos el motivo"
      : "Detalle (opcional)";
  }
  async function cambiarMes(cantidad) {
    if (estado.guardando) return;
    const [anio, mes] = estado.mes.split("-").map(Number);
    const nueva = new Date(anio, mes - 1 + cantidad, 1);
    estado.mes = `${nueva.getFullYear()}-${String(nueva.getMonth() + 1).padStart(2, "0")}`;
    await cargar();
  }
  async function iniciar() {
    try {
      const usuario = await obtenerSesion();
      if (!usuario) {
        window.location.href = "../sesion/inicio-sesion.html";
        return;
      }
      armarMenu(usuario.rol);
      estado.id = idUnidadDeLaUrl();
      if (!estado.id) throw new Error("No encontramos ese alojamiento.");
      estado.unidad = (await pedir("/unidades/resumen?id=" + estado.id)).unidad;
      $("enlace-volver").href = "configurar-unidad.html?id=" + estado.id;
      const libroUnidad = el('a', 'Libro de huéspedes');
      libroUnidad.href = `../reservas/libro-huespedes.html?unidad_id=${estado.id}`;
      document.querySelector('.navegacion-unidad').append(libroUnidad);
      $("nombre-unidad").textContent =
        `${estado.unidad.nombre} · ${estado.unidad.localidad}`;
      document.title = `Calendario de ${estado.unidad.nombre} · HayLugar`;
      document
        .querySelectorAll("[data-enlace-unidad]")
        .forEach((a) => (a.href += "?id=" + estado.id));
      if (!estado.unidad.es_propietario) {
        document.querySelector(
          '[data-enlace-unidad][href^="datos-unidad.html"]',
        ).textContent = "Depósito";
        document
          .querySelectorAll("[data-propietario]")
          .forEach((n) => n.remove());
        estado.accion = "bloqueo";
        $("aviso-administrador").hidden = false;
      }
      presentarPublicacion();
      $("mes-anterior").addEventListener("click", () => cambiarMes(-1));
      $("mes-siguiente").addEventListener("click", () => cambiarMes(1));
      $("ir-hoy").addEventListener("click", () => {
        estado.mes = hoy.slice(0, 7);
        cargar();
      });
      $("elegir-mes").addEventListener("change", (e) => {
        if (/^\d{4}-\d{2}$/.test(e.target.value)) {
          estado.mes = e.target.value;
          cargar();
        }
      });
      $("reintentar-calendario").addEventListener("click", cargar);
      $("accion-publicacion").addEventListener("click", cambiarPublicacion);
      $("form-rango").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        await seleccionarRango(
          f.elements.desde.value,
          f.elements.hasta.value,
          estado.temporada,
        );
      });
      $("limpiar-seleccion").addEventListener("click", limpiar);
      document.querySelectorAll("[data-accion]").forEach((b) =>
        b.addEventListener("click", () => {
          $("error-cambio").textContent = "";
          seleccionarAccion(b.dataset.accion);
        }),
      );
      $("form-cambio").addEventListener("submit", guardarCambio);
      $("form-cambio").elements.motivo.addEventListener(
        "change",
        actualizarMotivo,
      );
      $("cancelar-edicion").addEventListener("click", () => {
        estado.temporada = null;
        seleccionarAccion("temporada");
      });
      $("contenido").hidden = false;
      document.body.hidden = false;
      await cargar();
    } catch (error) {
      $("mensaje-error").textContent = textoError(error);
      document.body.hidden = false;
    }
  }
  iniciar();
})();
