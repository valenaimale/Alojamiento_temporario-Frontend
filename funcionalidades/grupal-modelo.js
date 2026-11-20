// Las reglas de la reserva grupal (US4.4 y US8.5) en el front, sin tocar el DOM ni el backend:
//  - qué unidades eligió el huésped y si la elección se puede reservar (las mismas reglas que el back);
//  - cómo se juntan en Mis reservas las reservas de un mismo grupo;
//  - el "resumen" del grupo: una reserva armada con las de sus unidades, para mostrar el estado del pago y pagar
//    todo junto (la seña y el saldo del grupo se pagan en una transacción: pagarSenaGrupal y pagarSaldoGrupal).
// Está separado de las páginas para poder probarlo con Node (tests/grupal-modelo.test.cjs).
const GrupalModelo = (() => {
  const MINIMO_UNIDADES = 2;

  // Si las unidades elegidas se pueden reservar para esas personas. Devuelve {ok, mensaje, capacidad, total, sena}.
  // $unidades: las que ofrece la grupal (GET /grupal), cada una con capacidad y estadia {precio_total, sena}.
  function eleccion(unidades, elegidas, personas) {
    const seleccion = unidades.filter(unidad => elegidas.includes(unidad.id));
    const capacidad = seleccion.reduce((suma, unidad) => suma + unidad.capacidad, 0);
    const total = sumar(seleccion.map(unidad => unidad.estadia.precio_total));
    const sena = sumar(seleccion.map(unidad => unidad.estadia.sena));
    let mensaje = null;
    if (seleccion.length < MINIMO_UNIDADES) {
      mensaje = `Elegí al menos ${MINIMO_UNIDADES} unidades: con una sola, reservala desde la búsqueda.`;
    } else if (capacidad < personas) {
      mensaje = `Las unidades que elegiste tienen lugar para ${capacidad} personas y son ${personas}: sumá otra.`;
    } else if (personas < seleccion.length) {
      mensaje = 'Elegiste más unidades que personas.';
    }
    return { ok: mensaje === null, mensaje, capacidad, total, sena };
  }

  // Junta en Mis reservas las reservas de un mismo grupo: cada grupo pasa a ser un elemento
  // {grupo: {id, titulo}, reservas: [...]}, en el lugar de su primera reserva. Las demás quedan como estaban.
  function agrupar(reservas) {
    const resultado = [];
    const grupos = new Map();
    for (const reserva of reservas) {
      if (!reserva.grupo) {
        resultado.push(reserva);
        continue;
      }
      if (!grupos.has(reserva.grupo.id)) {
        const elemento = { grupo: reserva.grupo, reservas: [] };
        grupos.set(reserva.grupo.id, elemento);
        resultado.push(elemento);
      }
      grupos.get(reserva.grupo.id).reservas.push(reserva);
    }
    return resultado;
  }

  // Si un elemento de agrupar() es un grupo
  function esGrupo(elemento) {
    return Array.isArray(elemento?.reservas) && Boolean(elemento.grupo);
  }

  // Una reserva "resumen" del grupo, con la forma de una reserva de GET /reservas/mias, para usar lo mismo que en
  // una reserva común (PagosModelo.estadoPagoReserva, la pantalla de pago):
  //  - estado: pendiente si alguna espera la seña; si no, confirmada si alguna sigue en pie; si no, el de la primera;
  //  - importes, personas y saldo: la suma de las unidades que siguen en pie (una cancelada no se paga);
  //  - fecha de cobro: la más temprana de las que deben saldo (así vence el saldo del grupo).
  function resumen(grupo, reservas) {
    const pendientes = reservas.filter(reserva => ['pendiente', 'pendiente_pago'].includes(reserva.estado));
    const confirmadas = reservas.filter(reserva => reserva.estado === 'confirmada');
    const vigentes = pendientes.length ? pendientes : confirmadas.length ? confirmadas : reservas;
    const primera = reservas[0];
    const conSaldo = confirmadas.filter(reserva => reserva.saldo != null);
    const fechasDeCobro = conSaldo.map(reserva => reserva.fecha_cobro).filter(Boolean).sort();
    return {
      id: `grupo-${grupo.id}`,
      grupo,
      estado: pendientes.length ? pendientes[0].estado : confirmadas.length ? 'confirmada' : primera.estado,
      vence_en: pendientes[0]?.vence_en ?? null,
      puede_pagar: pendientes.some(reserva => reserva.puede_pagar === true),
      puede_pagar_saldo: confirmadas.some(reserva => reserva.puede_pagar_saldo === true),
      saldo: conSaldo.length ? sumar(conSaldo.map(reserva => reserva.saldo)) : null,
      fecha_cobro: fechasDeCobro[0] ?? null,
      pagos: reservas.flatMap(reserva => Array.isArray(reserva.pagos) ? reserva.pagos : []),
      ingreso: reservas.map(reserva => reserva.ingreso).sort()[0],
      egreso: reservas.map(reserva => reserva.egreso).sort().at(-1),
      noches: primera.noches,
      personas: vigentes.reduce((suma, reserva) => suma + reserva.personas, 0),
      importe_total: sumar(vigentes.map(reserva => reserva.importe_total)),
      importe_sena: sumar(vigentes.map(reserva => reserva.importe_sena)),
      alojamiento: {
        nombre: grupo.titulo ?? 'Reserva grupal',
        localidad: primera.alojamiento?.localidad,
        provincia: primera.alojamiento?.provincia,
        foto_principal: primera.alojamiento?.foto_principal ?? null,
      },
      unidades: reservas.map(reserva => reserva.alojamiento?.nombre).filter(Boolean),
    };
  }

  // Suma importes del backend ("98000.00") sin coma flotante, en centavos
  function sumar(importes) {
    let centavos = 0n;
    for (const importe of importes) {
      const [entera, decimal = '0'] = String(importe ?? '0').split('.');
      centavos += BigInt(entera) * 100n + BigInt(decimal.padEnd(2, '0').slice(0, 2));
    }
    return `${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;
  }

  return { MINIMO_UNIDADES, eleccion, agrupar, esGrupo, resumen, sumar };
})();

// Para poder probar estas reglas con Node (en el navegador no existe module)
if (typeof module !== 'undefined') module.exports = GrupalModelo;
