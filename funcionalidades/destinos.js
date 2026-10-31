// Destinos editoriales: solo se muestran si existen en /localidades. No representan stock ni popularidad.
(() => {
  // Fuentes y licencias de las fotos: imagenes/destinos/README.md.
  const fotos = {
    "San Carlos de Bariloche": { archivo: "bariloche.jpg" },
    "Las Grutas": { archivo: "las-grutas.jpg" },
    "Villa Gesell": { archivo: "villa-gesell.jpg" },
    "San Martín de los Andes": { archivo: "san-martin.jpg" },
    "Puerto Madryn": { archivo: "puerto-madryn.jpg" },
  };
  const fila = document.getElementById("destinos-fila");
  if (!fila) return;
  const anteriores = document.getElementById("destinos-anterior"),
    siguientes = document.getElementById("destinos-siguiente");
  function actualizarControles() {
    anteriores.disabled = fila.scrollLeft < 2;
    siguientes.disabled =
      fila.scrollLeft + fila.clientWidth >= fila.scrollWidth - 2;
  }
  anteriores.addEventListener("click", () =>
    fila.scrollBy({
      left: -fila.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    }),
  );
  siguientes.addEventListener("click", () =>
    fila.scrollBy({
      left: fila.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    }),
  );
  fila.addEventListener("scroll", actualizarControles, { passive: true });
  new ResizeObserver(actualizarControles).observe(fila);
  function tarjeta(localidad, foto) {
    const li = document.createElement("li"),
      boton = document.createElement("button");
    boton.type = "button";
    boton.className = "destino";
    if (foto) {
      const img = document.createElement("img");
      img.src = "../../imagenes/destinos/" + foto.archivo;
      img.alt = "";
      img.loading = "lazy";
      img.width = 600;
      img.height = 460;
      boton.append(img);
    }
    const nombre = document.createElement("strong");
    nombre.textContent = localidad.nombre;
    const provincia = document.createElement("span");
    provincia.textContent = localidad.provincia;
    boton.append(nombre, provincia);
    boton.addEventListener("click", () => {
      const form = document.getElementById("form-busqueda");
      const destino = form.elements.localidad_id;
      if (![...destino.options].some((o) => o.value === String(localidad.id)))
        destino.add(new Option(localidad.nombre, localidad.id));
      destino.value = localidad.id;
      destino.dispatchEvent(new Event("change", { bubbles: true }));
      form.scrollIntoView({ block: "center", behavior: "auto" });
      if (!form.elements.ingreso.value) form.elements.ingreso.focus();
      else if (!form.elements.egreso.value) form.elements.egreso.focus();
      else form.querySelector("[type=submit]").focus();
      document.getElementById("estado-destinos").textContent =
        "Destino elegido: " +
        localidad.nombre +
        ". Completá las fechas para buscar.";
    });
    li.append(boton);
    return li;
  }
  async function cargar() {
    const estado = document.getElementById("estado-destinos"),
      retry = document.getElementById("reintentar-destinos");
    retry.hidden = true;
    try {
      const { respuesta, resultado } = await pedirAlBack("/localidades");
      if (!respuesta.ok) throw new Error();
      const localidades = resultado.localidades;
      fila.replaceChildren(
        ...Object.keys(fotos)
          .map((nombre) => localidades.find((l) => l.nombre === nombre))
          .filter(Boolean)
          .map((l) => tarjeta(l, fotos[l.nombre])),
      );
      document
        .getElementById("todos-destinos")
        .replaceChildren(...localidades.map((l) => tarjeta(l)));
      estado.textContent = localidades.length
        ? ""
        : "Todavía no hay destinos disponibles.";
      actualizarControles();
    } catch {
      estado.textContent =
        "No pudimos cargar los destinos. Podés usar el buscador e intentar de nuevo.";
      retry.hidden = false;
    }
  }
  document
    .getElementById("reintentar-destinos")
    .addEventListener("click", cargar);
  cargar();
})();
