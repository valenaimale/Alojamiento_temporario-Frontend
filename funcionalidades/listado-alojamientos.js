// Los alojamientos disponibles para una búsqueda (vistas/alojamientos/listado.html), US3.2.
// Lee la búsqueda de la URL, llama a GET /buscar y muestra una tarjeta por alojamiento con el precio final.
// Es pública: con sesión arma el menú del usuario; sin sesión muestra "Iniciar sesión" y "Registrarme".

const resumen = document.getElementById("resumen-busqueda");

// Una tarjeta de resultado: la foto, el nombre (enlace al detalle, con la misma búsqueda), dónde queda,
// para cuántas personas y el precio final de toda la estadía
function crearTarjeta(unidad, parametros) {
  const item = document.createElement("li");
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta";

  if (unidad.foto_principal !== null) {
    const foto = document.createElement("img");
    foto.src = fotoConAncho(unidad.foto_principal, 600);
    foto.alt = `Foto de ${unidad.nombre}`;
    foto.loading = "lazy"; // las fotos de más abajo se cargan recién cuando se acercan a la pantalla
    tarjeta.appendChild(foto);
  }

  const titulo = document.createElement("h2");
  const enlace = document.createElement("a");
  const busqueda = new URLSearchParams({
    id: unidad.id,
    ingreso: parametros.get("ingreso"),
    egreso: parametros.get("egreso"),
    personas: parametros.get("personas"),
    localidad_id: parametros.get("localidad_id") ?? "", // para volver a esta misma búsqueda
  });
  enlace.href = `detalle.html?${busqueda}`;
  enlace.textContent = unidad.nombre;
  titulo.appendChild(enlace);

  const lugar = document.createElement("p");
  lugar.textContent = `${unidad.localidad}, ${unidad.provincia} · Hasta ${unidad.capacidad} ${unidad.capacidad === 1 ? "persona" : "personas"}`;

  const precio = document.createElement("p");
  precio.className = "precio";
  const total = document.createElement("strong");
  total.textContent = formatearPrecio(unidad.precio_total);
  precio.append(
    total,
    ` por ${unidad.noches} ${unidad.noches === 1 ? "noche" : "noches"}, precio final`,
  );

  tarjeta.append(titulo, lugar, precio);
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
    const cantidad = resultado.unidades.length;
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
    lista.replaceChildren(
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
