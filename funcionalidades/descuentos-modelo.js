// Reglas de los descuentos por estadía larga (US2.10, decisión #69 del back), compartidas por la pantalla de
// descuentos de la unidad, el detalle, el listado y los tests de Node. Las mismas reglas que valida el back:
// escalones de 2 a 60 noches, porcentaje mayor que 0 y menor que 100, sin repetir noches, hasta 10 por unidad.
const DescuentosModelo = (() => {
  const NOCHES_MINIMAS = 2;
  const NOCHES_MAXIMAS = 60;
  const MAXIMO_ESCALONES = 10;

  // Valida las filas del formulario ([{noches_minimas: "10", porcentaje: "10"}, ...]). Las filas vacías se ignoran.
  // Devuelve {escalones} ordenados por noches, listos para mandar, o {error} con el primer problema.
  function validarEscalones(filas) {
    const escalones = [];
    const vistas = new Set();
    for (const fila of filas) {
      const textoNoches = String(fila.noches_minimas ?? "").trim();
      const textoPorcentaje = String(fila.porcentaje ?? "").trim().replace(",", ".");
      if (textoNoches === "" && textoPorcentaje === "") continue; // una fila sin completar no cuenta
      const noches = Number(textoNoches);
      if (!/^\d+$/.test(textoNoches) || noches < NOCHES_MINIMAS || noches > NOCHES_MAXIMAS) {
        return { error: `Las noches tienen que ser un número de ${NOCHES_MINIMAS} a ${NOCHES_MAXIMAS}` };
      }
      const porcentaje = Number(textoPorcentaje);
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(textoPorcentaje) || porcentaje <= 0) {
        return { error: "El descuento tiene que ser un porcentaje mayor que 0 y menor que 100, con hasta 2 decimales" };
      }
      if (vistas.has(noches)) return { error: "Hay dos descuentos desde la misma cantidad de noches" };
      vistas.add(noches);
      escalones.push({ noches_minimas: noches, porcentaje: textoPorcentaje });
    }
    if (escalones.length > MAXIMO_ESCALONES) {
      return { error: `Podés cargar hasta ${MAXIMO_ESCALONES} descuentos por unidad` };
    }
    return { escalones: escalones.sort((a, b) => a.noches_minimas - b.noches_minimas) };
  }

  // El escalón que le toca a una estadía de `noches` noches: el de más noches que alcanza, o null si no alcanza ninguno
  function escalonPara(escalones, noches) {
    let elegido = null;
    for (const escalon of escalones) {
      if (Number(escalon.noches_minimas) <= noches && (elegido === null || Number(escalon.noches_minimas) > Number(elegido.noches_minimas))) {
        elegido = escalon;
      }
    }
    return elegido;
  }

  // Si un precio del back trae descuento: porcentaje_descuento mayor que 0 e importe_sin_descuento válido.
  // Las respuestas viejas (sin esos campos) se tratan como sin descuento.
  function tieneDescuento(precio) {
    const porcentaje = Number(precio?.porcentaje_descuento);
    const sinDescuento = Number(precio?.importe_sin_descuento);
    return Number.isFinite(porcentaje) && porcentaje > 0 && Number.isFinite(sinDescuento) && sinDescuento > 0;
  }

  // "10.00" → "10 %", "12.50" → "12,5 %"
  function textoPorcentaje(porcentaje) {
    return `${Number(porcentaje).toLocaleString("es-AR")} %`;
  }

  return { NOCHES_MINIMAS, NOCHES_MAXIMAS, MAXIMO_ESCALONES, validarEscalones, escalonPara, tieneDescuento, textoPorcentaje };
})();
if (typeof module !== "undefined") module.exports = DescuentosModelo;
