// Mejoras compartidas, sin dependencias ni cambios a los contratos de cada formulario.
(() => {
  const main = document.querySelector("main");
  if (main) {
    main.id ||= "contenido-principal";
    const salto = document.createElement("a");
    salto.className = "salto-contenido";
    salto.href = "#" + main.id;
    salto.textContent = "Saltar al contenido";
    document.body.prepend(salto);
  }
  const nombrePagina = () => {
    if (!document.title.includes("HayLugar")) document.title += " · HayLugar";
  };
  nombrePagina();
  new MutationObserver(nombrePagina).observe(document.querySelector("title"), {
    childList: true,
  });
  document.querySelectorAll("input[type=password]").forEach((input, index) => {
    const nombre = input.closest("label")?.textContent.trim() || "Contraseña";
    input.setAttribute("aria-label", nombre);
    input.id ||= "clave-" + index;
    const cont = document.createElement("span");
    cont.className = "password-control";
    input.before(cont);
    cont.append(input);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Mostrar";
    btn.setAttribute("aria-label", "Mostrar " + nombre.toLowerCase());
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-controls", input.id);
    btn.addEventListener("click", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      btn.textContent = visible ? "Ocultar" : "Mostrar";
      btn.setAttribute(
        "aria-label",
        (visible ? "Ocultar " : "Mostrar ") + nombre.toLowerCase(),
      );
      btn.setAttribute("aria-pressed", String(visible));
    });
    cont.append(btn);
  });
  document.querySelectorAll("input,select,textarea").forEach((input, index) => {
    if (input.type === "hidden") return;
    const error = document.createElement("span");
    error.className = "campo-error";
    error.id = "validacion-" + index;
    error.hidden = true;
    input.addEventListener("invalid", () => {
      // Un campo inválido debe quedar visible incluso dentro de una sección opcional cerrada.
      for (
        let padre = input.parentElement;
        padre;
        padre = padre.parentElement
      ) {
        if (padre.tagName === "DETAILS") padre.open = true;
      }
      error.textContent = input.validationMessage;
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      const ids = new Set(
        (input.getAttribute("aria-describedby") || "")
          .split(" ")
          .filter(Boolean),
      );
      ids.add(error.id);
      input.setAttribute("aria-describedby", [...ids].join(" "));
      input.closest("label")?.append(error);
    });
    input.addEventListener("input", () => {
      if (input.validity.valid) {
        error.hidden = true;
        input.removeAttribute("aria-invalid");
      }
    });
  });
})();
