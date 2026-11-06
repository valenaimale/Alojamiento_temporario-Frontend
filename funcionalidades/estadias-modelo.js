// Fechas de operación siempre en Argentina, independientemente del dispositivo.
const EstadiasModelo = (() => {
  function dia(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha);
    return ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo).value).join('-');
  }
  function movimientos(reservas, hoy = dia()) {
    const lista = [];
    for (const r of reservas) {
      const e = r.estadia;
      if (e?.egreso_en) {
        if (dia(new Date(e.egreso_en)) === hoy) lista.push({fecha: hoy, tipo: 'egreso', reserva: r});
        continue;
      }
      if (!e?.ingreso_en) lista.push({fecha: r.ingreso < hoy ? hoy : r.ingreso, tipo: 'ingreso', reserva: r});
      else if (dia(new Date(e.ingreso_en)) === hoy) lista.push({fecha: hoy, tipo: 'ingreso', reserva: r});
      lista.push({fecha: r.egreso < hoy ? hoy : r.egreso, tipo: 'egreso', reserva: r});
    }
    return lista.sort((a,b) => a.fecha.localeCompare(b.fecha) || (a.tipo === 'egreso' ? -1 : 1) - (b.tipo === 'egreso' ? -1 : 1));
  }
  // Cada cambio parte de la última copia guardada para no pisar otras pestañas.
  function almacen(storage, usuarioId) {
    const clave = `haylugar.estadias.v1.${usuarioId}`;
    function leer() {
      const texto = storage.getItem(clave);
      const datos = texto ? JSON.parse(texto) : {pendientes: [], borradores: {}};
      if (!Array.isArray(datos.pendientes) || !datos.borradores || typeof datos.borradores !== 'object') throw new Error('No se pudieron leer los movimientos guardados');
      return datos;
    }
    function cambiar(fn) { const datos = leer(); fn(datos); storage.setItem(clave, JSON.stringify(datos)); }
    return {
      leer,
      borrador: (id, valor) => cambiar(d => { d.borradores[id] = valor; }),
      agregar: evento => cambiar(d => {
        if (d.pendientes.some(e => e.reserva_id === evento.reserva_id && e.tipo === evento.tipo)) throw new Error('Este movimiento ya está pendiente de envío');
        d.pendientes.push(evento); delete d.borradores[`${evento.reserva_id}.${evento.tipo}`];
      }),
      quitar: id => cambiar(d => { d.pendientes = d.pendientes.filter(e => e.evento_id !== id); }),
      error: (id, mensaje, codigo = null) => cambiar(d => { const e = d.pendientes.find(e => e.evento_id === id); if (e) { e.error = mensaje; if (codigo) e.codigo = codigo; else delete e.codigo; } }),
    };
  }
  return {dia, movimientos, almacen};
})();
if (typeof module !== 'undefined') module.exports = EstadiasModelo;
