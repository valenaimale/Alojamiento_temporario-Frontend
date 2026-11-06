// Reglas de pagos compartidas por la pantalla de cobro, Mis reservas y los tests de Node.
const PagosModelo = (() => {
  const RED = 84532;
  const MAX_UINT256 = (1n << 256n) - 1n;
  const DIRECCION = /^0x[0-9a-fA-F]{40}$/;
  const HASH = /^0x[0-9a-fA-F]{64}$/;

  // Marca errores de datos sin exponer detalles internos de la billetera en pantalla.
  function errorDePago(codigo, mensaje, definitivo = false) {
    return Object.assign(new Error(mensaje), { codigo, definitivo });
  }

  // Conserva cada decimal mediante enteros; no pasa importes por Number.
  function decimal(valor) {
    if (typeof valor !== 'string' || !/^(0|[1-9]\d{0,59})(?:\.\d{1,18})?$/.test(valor)) {
      throw errorDePago('DATOS_INVALIDOS', 'El servicio devolvió un importe inválido. Volvé a cargar el pago.');
    }
    const [entero, fraccion = ''] = valor.split('.');
    return { numero: BigInt(entero + fraccion), escala: 10n ** BigInt(fraccion.length) };
  }

  // Convierte a wei enteros con el mismo truncamiento que el backend.
  function pesosAWei(monto, tasa) {
    const pesos = decimal(monto);
    const cambio = decimal(tasa);
    if (pesos.numero <= 0n || cambio.numero <= 0n) {
      throw errorDePago('DATOS_INVALIDOS', 'El importe y el tipo de cambio deben ser mayores que cero.');
    }
    const numerador = pesos.numero * cambio.escala * 10n ** 18n;
    const denominador = pesos.escala * cambio.numero;
    // Coincide con bcdiv(..., 0) del backend: trunca fracciones de wei.
    const wei = numerador / denominador;
    if (wei > MAX_UINT256) throw errorDePago('DATOS_INVALIDOS', 'El importe supera el límite admitido.');
    return wei;
  }

  // Valida identificadores enteros sin aceptar números que ya perdieron precisión.
  function identificador(valor) {
    if (typeof valor === 'number' && !Number.isSafeInteger(valor)) return null;
    const texto = String(valor ?? '');
    if (!/^[1-9]\d{0,77}$/.test(texto) || BigInt(texto) > MAX_UINT256) return null;
    return texto;
  }

  // Solo acepta fechas inequívocas: el servidor debe incluir la zona horaria.
  function vencimiento(valor) {
    if (valor == null) return null;
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) return NaN;
    return Date.parse(valor);
  }

  // Rechaza cotizaciones para otra reserva, otro cobro, otra red o montos inconsistentes.
  function normalizarCotizacion(payload, { reservaId, tipo }) {
    const pago = payload?.pago;
    const id = identificador(reservaId);
    if (!pago || !id || identificador(payload.reserva_id) !== id || !['sena', 'saldo'].includes(tipo) || payload.tipo !== tipo) {
      throw errorDePago('DATOS_INVALIDOS', 'Los datos del pago no corresponden a esta reserva. Volvé a cargar.');
    }
    const simulado = pago.simulado === true;
    if (typeof pago.simulado !== 'boolean' || payload.red !== (simulado ? 31337 : RED)) throw errorDePago('RED_INCORRECTA', 'La modalidad del pago no coincide con la red informada. Volvé a cargar.');
    if (pago.funcion !== (tipo === 'sena' ? 'pagarSena' : 'pagarSaldo')) throw errorDePago('DATOS_INVALIDOS', 'La función de pago no corresponde a este importe.');
    if (!simulado && (!DIRECCION.test(pago.contrato ?? '') || /^0x0{40}$/i.test(pago.contrato))) {
      throw errorDePago('DATOS_INVALIDOS', 'El contrato de pago todavía no está configurado. Intentá más tarde.');
    }
    if (typeof payload.monto_wei !== 'string' || !/^[1-9]\d{0,77}$/.test(payload.monto_wei) || BigInt(payload.monto_wei) !== pesosAWei(payload.monto_pesos, payload.pesos_por_eth)) {
      throw errorDePago('DATOS_INVALIDOS', 'El importe en ETH no coincide con la cotización. Volvé a cargar el pago.');
    }
    if (Number.isNaN(vencimiento(payload.vence_en))) {
      throw errorDePago('DATOS_INVALIDOS', 'No pudimos validar el vencimiento del pago. Volvé a cargar.');
    }
    return Object.freeze({
      reserva_id: id, tipo, monto_pesos: payload.monto_pesos, monto_wei: BigInt(payload.monto_wei),
      pesos_por_eth: payload.pesos_por_eth, red: payload.red, contrato: pago.contrato,
      funcion: pago.funcion, simulado, vence_en: payload.vence_en ?? null,
      fecha_cobro: payload.fecha_cobro ?? null, vencido: payload.vencido === true,
    });
  }

  // Presenta ETH exacto, sin notación científica ni redondeos de punto flotante.
  function formatearEth(wei) {
    if (!/^(0|[1-9]\d*)$/.test(String(wei))) throw errorDePago('DATOS_INVALIDOS', 'Importe en ETH inválido.');
    const texto = String(wei).padStart(19, '0');
    const fraccion = texto.slice(-18).replace(/0+$/, '');
    return texto.slice(0, -18) + (fraccion ? '.' + fraccion : '');
  }

  // Convierte a centavos sin punto flotante; la presentación monetaria conserva dos decimales.
  function weiAPesos(wei, tasa) {
    if (!/^(0|[1-9]\d*)$/.test(String(wei))) throw errorDePago('DATOS_INVALIDOS', 'Importe en wei inválido.');
    const cambio = decimal(tasa);
    const centavos = BigInt(wei) * cambio.numero * 100n / (10n ** 18n * cambio.escala);
    return `${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;
  }

  // Una fecha de cobro sin hora vence al finalizar ese día en Argentina.
  function saldoVencido(fecha, ahora = Date.now()) {
    if (typeof fecha !== 'string') return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return Date.parse(`${fecha}T23:59:59.999-03:00`) < ahora;
    const instante = vencimiento(fecha);
    return Number.isFinite(instante) && instante < ahora;
  }

  // Fechas de calendario: sumar días en UTC evita depender de la zona del dispositivo.
  function fechaCalendario(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
    const fecha = new Date(`${valor}T00:00:00Z`);
    return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor ? fecha : null;
  }
  function plazoSaldo(reserva) {
    const cobro = fechaCalendario(reserva.fecha_cobro), ingreso = fechaCalendario(reserva.ingreso);
    if (!cobro || !ingreso || cobro > ingreso) return null;
    cobro.setUTCDate(cobro.getUTCDate() + 3);
    return new Date(Math.min(cobro.getTime(), ingreso.getTime())).toISOString().slice(0, 10);
  }
  function avisoSaldo(reserva) {
    const limite = plazoSaldo(reserva);
    const porcentaje = reserva.retencion_menos_de_15;
    const valido = /^(?:\d{1,3})(?:\.\d{1,2})?$/.test(String(porcentaje ?? '')) && Number(porcentaje) <= 100;
    const retencion = valido ? `el ${Number(porcentaje).toLocaleString('es-AR')} % de la seña` : 'la retención sobre la seña prevista para menos de 15 días';
    const fecha = limite && new Intl.DateTimeFormat('es-AR', {dateStyle:'medium', timeZone:'UTC'}).format(fechaCalendario(limite));
    return `${fecha ? `Pagá el saldo hasta el ${fecha} inclusive` : 'El plazo máximo para pagar el saldo es 3 días después de la fecha de cobro o el día del ingreso, lo que ocurra antes'}. Si no pagás en ese plazo, la reserva se cancela y se aplica ${retencion}. Para ingresar, el saldo debe estar pagado.`;
  }

  // Busca causas anidadas de viem/MetaMask sin depender de sus clases externas.
  function causas(error) {
    const resultado = [];
    const vistos = new Set();
    for (let actual = error; actual && !vistos.has(actual); actual = actual.cause) {
      resultado.push(actual); vistos.add(actual);
    }
    return resultado;
  }

  // Convierte errores técnicos frecuentes en una acción comprensible para el huésped.
  function mensajeErrorPago(error) {
    const lista = causas(error);
    const tiene = (codigo, patron) => lista.some(e => e.codigo === codigo || e.code === codigo || patron?.test(`${e.name ?? ''} ${e.shortMessage ?? ''} ${e.message ?? ''}`));
    if (lista.some(e => e.envioIncierto)) return 'MetaMask pudo haber enviado el pago, pero no recibimos su identificador. Revisá la actividad de tu billetera antes de volver a pagar.';
    if (tiene(4001, /UserRejected/i)) return 'Rechazaste la solicitud en MetaMask. Podés volver a intentar cuando quieras.';
    if (tiene(-32002)) return 'Hay una solicitud pendiente en MetaMask. Abrí la billetera para responderla.';
    const erroresContrato = {
      HuespedIncorrecto: 'Usá la misma cuenta de MetaMask con la que pagaste la seña.',
      SenaYaPagada: 'La seña ya está pagada en el contrato. Revisá su confirmación en Mis reservas; no vuelvas a pagar.',
      SaldoYaPagado: 'El saldo ya está pagado en el contrato. Revisá su confirmación en Mis reservas; no vuelvas a pagar.',
      SinSena: 'Primero debe confirmarse la seña en el contrato. Si tu reserva no exige seña, contactá a la plataforma para resolver el pago del saldo.',
      ReservaDevuelta: 'Esta reserva ya tiene una devolución en el contrato y no admite nuevos pagos. Revisá Mis reservas.',
      MontoInvalido: 'El contrato rechazó el importe. Volvé a cargar la cotización antes de pagar.',
      FondosInsuficientes: 'El contrato no tiene fondos suficientes para esta operación. Contactá a la plataforma.',
      DestinatarioInvalido: 'La billetera destinataria no es válida. Contactá a la plataforma.',
      TransferenciaFallida: 'No se pudo transferir a la billetera destinataria. Contactá a la plataforma.',
      ListasInvalidas: 'Los datos de la operación no son válidos. Contactá a la plataforma.',
      OwnableInvalidOwner: 'La configuración del contrato no es válida. Contactá a la plataforma.',
      OwnableUnauthorizedAccount: 'Esta cuenta no está autorizada para esa operación del contrato.',
      ReentrancyGuardReentrantCall: 'El contrato bloqueó la operación. Actualizá la reserva antes de reintentar.',
      RenunciaNoPermitida: 'El contrato no permite esa operación. Contactá a la plataforma.',
    };
    const nombre = lista.map(e => e.data?.errorName).find(n => Object.hasOwn(erroresContrato, n));
    if (nombre) return erroresContrato[nombre];
    if (tiene('SIN_BILLETERA')) return 'Necesitás MetaMask para pagar. Instalalo o abrí esta página desde su navegador.';
    if (tiene('CDN_NO_DISPONIBLE')) return 'No pudimos cargar la conexión con MetaMask. Revisá internet y volvé a intentar.';
    if (tiene('SIN_SALDO', /InsufficientFunds|insufficient funds/i)) return 'No tenés suficiente ETH de prueba en Base Sepolia. Necesitás cubrir el pago y la comisión de la red.';
    if (tiene('RED_INCORRECTA', /ChainMismatch|ChainNotConfigured|chain.*mismatch/i) || tiene(4902)) return 'Cambiá MetaMask a Base Sepolia y volvé a intentar. Este pago usa ETH de prueba.';
    if (tiene('CUENTA_CAMBIADA')) return 'Cambiaste de cuenta en MetaMask. Volvé a conectar la billetera antes de pagar.';
    if (tiene('TRANSACCION_FALLIDA')) return 'La transacción falló en la red. El pago no se completó; la red puede haber cobrado una comisión.';
    if (tiene('TRANSACCION_CANCELADA')) return 'Cancelaste la transacción en MetaMask. El pago no se completó.';
    if (tiene('TRANSACCION_REEMPLAZADA')) return 'La transacción cambió en MetaMask. Revisá su estado antes de realizar otro pago.';
    if (tiene('ESPERA_AGOTADA', /WaitForTransactionReceiptTimeout/)) return 'La red todavía no confirmó el pago. Conservamos la transacción: revisá su estado sin volver a pagar.';
    if (tiene('DATOS_INVALIDOS') || tiene('RESERVA_VENCIDA')) return lista.find(e => ['DATOS_INVALIDOS', 'RESERVA_VENCIDA'].includes(e.codigo)).message;
    if (tiene('CONTRATO_NO_DISPONIBLE')) return 'El contrato de pago todavía no está disponible en Base Sepolia. Intentá más tarde.';
    if (tiene(null, /ContractFunctionReverted|ExecutionReverted/)) return 'El contrato rechazó el pago. Actualizá la reserva antes de volver a intentar.';
    return 'No pudimos completar este paso. Revisá la conexión y volvé a intentar; si ya enviaste el pago, consultá su estado.';
  }

  // Muestra solo acciones respaldadas por el estado y los importes que informó el servidor.
  function estadoPagoReserva(reserva, ahora = Date.now()) {
    const estado = (texto, tipo = null, accion = null, clase = 'estado-pendiente') => ({ texto, tipo, accion, clase });
    if (!['pendiente', 'pendiente_pago', 'confirmada'].includes(reserva.estado)) {
      return estado(reserva.estado === 'cancelada' ? 'Reserva cancelada' : 'Sin pagos habilitados', null, null, 'estado-no-publicada');
    }
    const pagos = Array.isArray(reserva.pagos) ? reserva.pagos : [];
    const confirmado = tipo => pagos.some(p => p.tipo === tipo && p.estado === 'confirmado');
    const enProceso = pagos.find(p => ['sena', 'saldo'].includes(p.tipo) && p.estado === 'pendiente' && HASH.test(p.tx_hash ?? ''));
    if (enProceso) return estado('Pago en proceso de confirmación', enProceso.tipo, 'Revisar pago');
    if (reserva.estado === 'pendiente' || reserva.estado === 'pendiente_pago') {
      const expira = vencimiento(reserva.vence_en);
      if (Number.isNaN(expira)) return estado('Consultá el vencimiento de tu reserva', null, null, 'estado-no-publicada');
      if (expira !== null && expira <= ahora) return estado('Plazo para pagar vencido', null, null, 'estado-no-publicada');
      if (confirmado('sena')) return estado('Seña pagada; actualizando reserva', null, null, 'estado-publicada');
      return reserva.puede_pagar === true ? estado('Seña pendiente', 'sena', 'Pagar la seña') : estado('Seña no habilitada para pagar');
    }
    if (confirmado('saldo')) return estado('Pago completo', null, null, 'estado-publicada');
    if (reserva.saldo != null) {
      try {
        const faltante = decimal(reserva.saldo);
        if (faltante.numero === 0n) return estado('Pago completo', null, null, 'estado-publicada');
        if (saldoVencido(reserva.fecha_cobro, ahora)) return reserva.puede_pagar_saldo === true
          ? estado('Saldo vencido: pagalo antes de ingresar', 'saldo', 'Pagar el saldo')
          : estado('Saldo vencido; pago no habilitado', null, null, 'estado-no-publicada');
        return reserva.puede_pagar_saldo === true ? estado('Saldo pendiente', 'saldo', 'Pagar el saldo') : estado('Saldo pendiente; pago no habilitado');
      } catch { return estado('Estado de pago no informado', null, null, 'estado-no-publicada'); }
    }
    return confirmado('sena') ? estado('Seña pagada', null, null, 'estado-publicada') : estado('Estado de pago no informado', null, null, 'estado-no-publicada');
  }

  // La cuenta y el tramo pertenecen al backend; el front valida y presenta su vista previa.
  function normalizarCancelacion(datos, reservaId) {
    const tramos = {mas_de_30: 'más de 30 días', de_15_a_30: 'entre 15 y 30 días', menos_de_15: 'menos de 15 días'};
    if (!identificador(reservaId) || identificador(datos?.reserva_id) !== identificador(reservaId) ||
        !['pendiente', 'confirmada'].includes(datos?.estado) || !tramos[datos?.tramo] ||
        !Number.isSafeInteger(datos?.dias_hasta_cobro)) {
      throw errorDePago('DATOS_INVALIDOS', 'No pudimos validar la cancelación. Actualizá tus reservas antes de continuar.');
    }
    for (const monto of [datos.pagado?.sena, datos.pagado?.saldo, datos.retencion, datos.devolucion]) decimal(monto);
    const porcentaje = decimal(datos.porcentaje_retencion);
    if (porcentaje.numero > 100n * porcentaje.escala || typeof datos.devolucion_wei !== 'string' ||
        !/^(0|[1-9]\d{0,77})$/.test(datos.devolucion_wei) || BigInt(datos.devolucion_wei) > MAX_UINT256) {
      throw errorDePago('DATOS_INVALIDOS', 'La devolución informada no es válida. Volvé a consultar antes de cancelar.');
    }
    const dias = datos.dias_hasta_cobro;
    const plazo = dias < 0 ? 'La fecha de cobro del saldo ya pasó.' : dias === 0 ? 'El cobro del saldo vence hoy.'
      : `Falta${dias === 1 ? '' : 'n'} ${dias} día${dias === 1 ? '' : 's'} para el cobro del saldo.`;
    const explicacion = datos.estado === 'pendiente'
      ? 'Las fechas quedarán libres. Si enviaste un pago, revisá primero su confirmación.'
      : `${plazo} Se aplica el tramo de ${tramos[datos.tramo]} de la política que aceptaste. La retención se calcula sobre la seña.${decimal(datos.pagado.saldo).numero > 0n ? ' El saldo pagado se devuelve entero.' : ''} ${decimal(datos.devolucion).numero > 0n ? 'La devolución corresponde a la billetera con la que pagaste.' : 'Según la política, no corresponde devolución.'}`;
    return {...datos, pagado: {...datos.pagado}, devolucion_wei: BigInt(datos.devolucion_wei), explicacion};
  }

  return { RED, plazoSaldo, avisoSaldo, identificador, normalizarCancelacion, normalizarCotizacion, pesosAWei, weiAPesos, formatearEth, mensajeErrorPago, estadoPagoReserva, vencimiento, saldoVencido };
})();
if (typeof module !== 'undefined') module.exports = PagosModelo;
