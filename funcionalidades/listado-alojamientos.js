// Los alojamientos disponibles para una búsqueda (vistas/alojamientos/listado.html), US3.2.
// Lee la búsqueda de la URL, llama a GET /buscar y muestra una tarjeta por alojamiento con el precio final.
// Es pública: con sesión arma el menú del usuario; sin sesión muestra "Iniciar sesión" y "Registrarme".

const resumen = document.getElementById("resumen-busqueda");

// El enlace al detalle de una unidad con la misma búsqueda (la usan la tarjeta y el mapa)
function rutaDetalle(unidad, parametros) {
  const busqueda = new URLSearchParams({
    id: unidad.id,
    ingreso: parametros.get("ingreso"),
    egreso: parametros.get("egreso"),
    personas: parametros.get("personas"),
    localidad_id: parametros.get("localidad_id") ?? "", // para volver a esta misma búsqueda
  });
  return `detalle.html?${busqueda}`;
}

// Una tarjeta de resultado: la foto, el nombre (enlace al detalle, con la misma búsqueda), dónde queda,
// para cuántas personas y el precio final de toda la estadía
function crearTarjeta(unidad, parametros) {
  const item = document.createElement("li");
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta";
  tarjeta.setAttribute("data-testid", "tarjeta-alojamiento"); // para los E2E (e2e/paginas/PaginaListado.js)

  if (unidad.foto_principal !== null) {
    const foto = document.createElement("img");
    foto.src = fotoConAncho(unidad.foto_principal, 600);
    foto.alt = `Foto de ${unidad.nombre}`;
    foto.loading = "lazy"; // las fotos de más abajo se cargan recién cuando se acercan a la pantalla
    tarjeta.appendChild(foto);
  }

  const titulo = document.createElement("h2");
  const enlace = document.createElement("a");
  enlace.href = rutaDetalle(unidad, parametros);
  enlace.textContent = unidad.nombre;
  titulo.appendChild(enlace);

  const lugar = document.createElement("p");
  lugar.textContent = `${unidad.localidad}, ${unidad.provincia} · Hasta ${unidad.capacidad} ${unidad.capacidad === 1 ? "persona" : "personas"}`;

  const precio = document.createElement("p");
  precio.className = "precio";
  const total = document.createElement("strong");
  total.textContent = formatearPrecio(unidad.precio_total);
  // Descuento por estadía larga (US2.10): el precio de las noches tachado antes del total con el descuento
  if (DescuentosModelo.tieneDescuento(unidad)) {
    const anterior = document.createElement("s");
    anterior.textContent = formatearPrecio(unidad.importe_sin_descuento);
    precio.append(anterior, " ");
  }
  precio.append(
    total,
    ` por ${unidad.noches} ${unidad.noches === 1 ? "noche" : "noches"}, precio final`,
  );

  tarjeta.append(titulo, lugar, precio);
  if (DescuentosModelo.tieneDescuento(unidad)) {
    const etiqueta = document.createElement("p");
    etiqueta.className = "ayuda";
    etiqueta.textContent = `${DescuentosModelo.textoPorcentaje(unidad.porcentaje_descuento)} de descuento por estadía larga`;
    tarjeta.append(etiqueta);
  }
  item.appendChild(tarjeta);
  return item;
}

// Una tarjeta de una reserva grupal (US4.4): varias unidades que se reservan juntas, armada por el back con las que
// están libres en estas fechas. Lleva al detalle de la grupal, donde se eligen las unidades.
function crearTarjetaGrupal(grupal, parametros) {
  const item = document.createElement("li");
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta tarjeta-grupal";
  tarjeta.setAttribute("data-testid", "tarjeta-grupal"); // para los E2E (e2e/paginas/PaginaListado.js)

  const foto = grupal.unidades.find((unidad) => unidad.foto_principal)?.foto_principal;
  if (foto) {
    const imagen = document.createElement("img");
    imagen.src = fotoConAncho(foto, 600);
    imagen.alt = `Foto de ${grupal.titulo}`;
    imagen.loading = "lazy";
    tarjeta.appendChild(imagen);
  }

  const etiqueta = document.createElement("p");
  etiqueta.className = "etiqueta-grupal";
  etiqueta.textContent = `Reserva grupal · ${grupal.unidades.length} unidades`;

  const titulo = document.createElement("h2");
  const enlace = document.createElement("a");
  const busqueda = new URLSearchParams({
    id: grupal.id,
    ingreso: parametros.get("ingreso"),
    egreso: parametros.get("egreso"),
    personas: parametros.get("personas"),
    localidad_id: parametros.get("localidad_id") ?? "",
  });
  enlace.href = `grupal.html?${busqueda}`;
  enlace.textContent = grupal.titulo;
  titulo.appendChild(enlace);

  const lugar = document.createElement("p");
  lugar.textContent = `${grupal.localidad}, ${grupal.provincia} · Hasta ${grupal.capacidad} personas en total`;
  const unidades = document.createElement("p");
  unidades.className = "ayuda";
  unidades.textContent = grupal.unidades.map((unidad) => `${unidad.nombre} (${unidad.capacidad})`).join(" · ");

  const precio = document.createElement("p");
  precio.className = "precio";
  const total = document.createElement("strong");
  total.textContent = formatearPrecio(grupal.precio_total);
  precio.append(total, ` por ${grupal.noches} ${grupal.noches === 1 ? "noche" : "noches"}, todas las unidades`);

  tarjeta.append(etiqueta, titulo, lugar, unidades, precio);
  item.appendChild(tarjeta);
  return item;
}

// Busca con lo que vino en la URL y dibuja los resultados (o por qué no hay)
async function buscar() {
  const parametros = new URLSearchParams(window.location.search);
  const lista = document.getElementById("resultados");
  const vacio = document.getElementById("estado-resultados");
  const retry = document.getElementById("reintentar-busqueda");
  const titulo = document.getElementById("titulo-resultados");
  const mostrarVacio = (encabezado, texto, reintentar = false) => {
    vacio.hidden = false;
    document.getElementById("titulo-vacio").textContent = encabezado;
    document.getElementById("texto-vacio").textContent = texto;
    retry.hidden = !reintentar;
    resumen.textContent = "";
  };
  document.getElementById("vista-mapa").hidden = true;
  vacio.hidden = true;
  lista.replaceChildren();
  if (!parametros.get("ingreso") || !parametros.get("egreso")) {
    mostrarVacio(
      "Elegí cuándo querés viajar",
      "Completá las fechas y la cantidad de huéspedes para ver disponibilidad.",
    );
    return;
  }
  const busqueda = new URLSearchParams({
    localidad_id: parametros.get("localidad_id") ?? "",
    ingreso: parametros.get("ingreso"),
    egreso: parametros.get("egreso"),
    personas: parametros.get("personas") ?? "",
  });
  resumen.textContent = "Buscando alojamientos…";
  lista.setAttribute("aria-busy", "true");
  retry.disabled = true;
  try {
    const { respuesta, resultado } = await pedirAlBack(`/buscar?${busqueda}`);
    if (!respuesta.ok) {
      if (respuesta.status >= 500)
        throw new Error(resultado.error || MENSAJE_SIN_CONEXION);
      titulo.textContent = "Revisá tu búsqueda";
      document.getElementById("busqueda-editar").open = true;
      mostrarVacio("Falta ajustar un dato", resultado.error);
      return;
    }
    const grupales = resultado.grupales ?? []; // las reservas grupales que corresponden a esta búsqueda (US4.4)
    const cantidad = resultado.unidades.length + grupales.length;
    titulo.textContent =
      cantidad === 0
        ? "Busquemos otras fechas"
        : `${cantidad} ${cantidad === 1 ? "alojamiento disponible" : "alojamientos disponibles"}`;
    if (!cantidad) {
      mostrarVacio(
        "No encontramos lugar para esa búsqueda",
        "Probá otras fechas, menos huéspedes o un destino distinto.",
      );
      return;
    }
    prepararMapaResultados(resultado.unidades, parametros);
    lista.replaceChildren(
      ...grupales.map((grupal) => crearTarjetaGrupal(grupal, parametros)),
      ...resultado.unidades.map((unidad) => crearTarjeta(unidad, parametros)),
    );
    resumen.textContent =
      "Precio final de toda la estadía · Ordenados de menor a mayor";
  } catch (error) {
    console.error("No se pudieron cargar los alojamientos:", error);
    titulo.textContent = "Alojamientos";
    mostrarVacio(
      "No pudimos cargar los resultados",
      "Tu búsqueda está guardada. Revisá la conexión y volvé a intentar.",
      true,
    );
  } finally {
    lista.setAttribute("aria-busy", "false");
    retry.disabled = false;
  }
}

armarEncabezadoPublico(); // unidades-comun.js
document.getElementById("ajustar-busqueda").addEventListener("click", () => {
  document.getElementById("busqueda-editar").open = true;
  document.querySelector("#form-busqueda input[name=ingreso]").focus();
});
document
  .getElementById("reintentar-busqueda")
  .addEventListener("click", buscar);
prepararBusqueda().then(buscar);
