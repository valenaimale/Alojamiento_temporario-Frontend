// Mapas públicos de HayLugar (US2.12 y US3.4), con Leaflet y OpenStreetMap. Las teselas se solicitan al abrir el mapa.

// Crea el mapa en el <div id="mapa"> de la página, centrado en la Argentina
function crearMapa() {
  const mapa = L.map("mapa", { scrollWheelZoom: false }).setView([-38.4, -63.6], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  return mapa;
}

// El propietario elige el punto público con el mapa o con el teclado.
function prepararMapaPropietario(form, datos = {}) {
  const { latitud, longitud } = form.elements;
  const panel = document.getElementById("ubicacion-publica");
  for (const campo of ["latitud", "longitud", "barrio", "metros_playa", "metros_centro"]) {
    form.elements[campo].value = datos[campo] ?? "";
  }
  let mapa, marcador;
  // Vuelve a poner el marcador donde dicen la latitud y la longitud (y las hace obligatorias de a pares)
  function actualizar() {
    latitud.required = longitud.value !== "";
    longitud.required = latitud.value !== "";
    if (!mapa) return;
    if (marcador) marcador.remove();
    if (!latitud.value || !longitud.value || !latitud.validity.valid || !longitud.validity.valid) return;
    const punto = [Number(latitud.value), Number(longitud.value)];
    marcador = L.marker(punto).addTo(mapa);
    mapa.setView(punto, Math.max(14, mapa.getZoom()));
  }
  panel.addEventListener("toggle", () => {
    if (!panel.open) return;
    if (!mapa) {
      mapa = crearMapa();
      mapa.on("click", ({ latlng }) => {
        latitud.value = latlng.lat.toFixed(6);
        longitud.value = latlng.wrap().lng.toFixed(6);
        actualizar();
      });
    }
    mapa.invalidateSize();
    actualizar();
  });
  latitud.addEventListener("change", actualizar);
  longitud.addEventListener("change", actualizar);
  document.getElementById("quitar-ubicacion").addEventListener("click", () => {
    latitud.value = longitud.value = "";
    actualizar();
  });
}

// Filtra solo unidades ubicadas. Una distancia desconocida queda después de las informadas.
function unidadesEnMapa(unidades, barrio, orden) {
  const visibles = unidades.filter(u => u.ubicacion && (!barrio || u.ubicacion.barrio === barrio));
  if (orden) visibles.sort((a, b) =>
    (a.ubicacion[orden] ?? Infinity) - (b.ubicacion[orden] ?? Infinity));
  return visibles;
}

// Arma el mapa del listado: solo si alguna unidad tiene ubicación, con el filtro por barrio y el orden por distancia
function prepararMapaResultados(unidades, parametros) {
  const panel = document.getElementById("vista-mapa");
  const barrios = document.getElementById("mapa-barrio");
  const orden = document.getElementById("mapa-orden");
  const lista = document.getElementById("mapa-unidades");
  panel.hidden = !unidades.some(u => u.ubicacion);
  if (panel.hidden) return;
  const nombres = unidades.map(u => u.ubicacion?.barrio).filter(Boolean);
  barrios.replaceChildren(new Option("Todos los barrios", ""));
  for (const nombre of [...new Set(nombres)].sort()) barrios.add(new Option(nombre, nombre));
  let mapa, puntos;
  // Dibuja los marcadores y la lista de las unidades que pasan el filtro (cuando el panel está abierto)
  function dibujar() {
    if (!panel.open) return;
    if (!mapa) {
      mapa = crearMapa();
      puntos = L.featureGroup().addTo(mapa);
    }
    mapa.invalidateSize();
    puntos.clearLayers();
    lista.replaceChildren();
    for (const unidad of unidadesEnMapa(unidades, barrios.value, orden.value)) {
      const ubicacion = unidad.ubicacion;
      const enlace = document.createElement("a");
      enlace.href = rutaDetalle(unidad, parametros);
      enlace.textContent = unidad.nombre + " · " + formatearPrecio(unidad.precio_total);
      const item = document.createElement("li");
      item.append(enlace);
      if (orden.value) {
        const metros = ubicacion[orden.value];
        item.append(metros == null ? " · Distancia sin informar" : " · " + metros + " m");
      }
      lista.append(item);
      const precio = document.createElement("span");
      precio.textContent = formatearPrecio(unidad.precio_total);
      L.marker([ubicacion.latitud, ubicacion.longitud], { alt: enlace.textContent })
        .addTo(puntos).bindTooltip(precio, { permanent: true, direction: "top" })
        .bindPopup(enlace.cloneNode(true));
    }
    mapa.fitBounds(puntos.getBounds(), { padding: [36, 48], maxZoom: 15 });
  }
  panel.ontoggle = barrios.onchange = orden.onchange = dibujar;
  dibujar();
}

if (typeof module !== "undefined") module.exports = { unidadesEnMapa };
