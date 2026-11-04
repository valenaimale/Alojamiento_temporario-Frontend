// Fechas sin hora: la configuración incluye ambos extremos; el egreso de una reserva no se ocupa.
const CalendarioModelo = (() => {
  const DIA = 86400000;
  function fechaValida(texto) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(texto) &&
      !Number.isNaN(Date.parse(texto)) &&
      new Date(texto + "T12:00:00Z").toISOString().slice(0, 10) === texto
    );
  }
  function sumar(texto, cantidad) {
    return new Date(Date.parse(texto + "T12:00:00Z") + cantidad * DIA)
      .toISOString()
      .slice(0, 10);
  }
  function noches(desde, hasta) {
    return (
      Math.round(
        (Date.parse(hasta + "T12:00:00Z") - Date.parse(desde + "T12:00:00Z")) /
          DIA,
      ) + 1
    );
  }
  function rangoValido(desde, hasta) {
    return (
      fechaValida(desde) &&
      fechaValida(hasta) &&
      desde <= hasta &&
      noches(desde, hasta) <= 366
    );
  }
  function superpone(desde, hasta, inicio, fin) {
    return desde <= fin && hasta >= inicio;
  }
  function estadoNoche(noche, reservas, bloqueos, hoy) {
    if (noche.fecha < hoy) return "pasada";
    if (
      reservas.some((r) => noche.fecha >= r.ingreso && noche.fecha < r.egreso)
    )
      return "reservada";
    if (
      bloqueos.some(
        (b) => noche.fecha >= b.fecha_desde && noche.fecha <= b.fecha_hasta,
      )
    )
      return "bloqueada";
    return noche.precio === null ? "sin-precio" : "libre";
  }
  function hoyArgentina() {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const parte = (tipo) => partes.find((p) => p.type === tipo).value;
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
  }
  return {
    fechaValida,
    sumar,
    noches,
    rangoValido,
    superpone,
    estadoNoche,
    hoyArgentina,
  };
})();
if (typeof module !== "undefined") module.exports = CalendarioModelo;
