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

  // Redondea hacia arriba al wei más cercano para no pagar menos de lo cotizado.
  function pesosAWei(monto, tasa) {
    const pesos = decimal(monto);
    const cambio = decimal(tasa);
    if (pesos.numero <= 0n || cambio.numero <= 0n) {
      throw errorDePago('DATOS_INVALIDOS', 'El importe y el tipo de cambio deben ser mayores que cero.');
    }
    const numerador = pesos.numero * cambio.escala * 10n ** 18n;
    const denominador = pesos.escala * cambio.numero;
    const wei = (numerador + denominador - 1n) / denominador;
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
    if (!pago || !id || identificador(pago.reserva_id) !== id || !['sena', 'saldo'].includes(tipo) || pago.tipo !== tipo) {
      throw errorDePago('DATOS_INVALIDOS', 'Los datos del pago no corresponden a esta reserva. Volvé a cargar.');
    }
    if (pago.red !== RED) throw errorDePago('RED_INCORRECTA', 'Este pago debe realizarse en Base Sepolia.');
    if (!DIRECCION.test(pago.contrato_direccion ?? '') || /^0x0{40}$/i.test(pago.contrato_direccion)) {
      throw errorDePago('DATOS_INVALIDOS', 'El contrato de pago todavía no está configurado. Intentá más tarde.');
    }
    if (typeof pago.monto_wei !== 'string' || !/^[1-9]\d{0,77}$/.test(pago.monto_wei) || BigInt(pago.monto_wei) !== pesosAWei(pago.monto_pesos, pago.pesos_por_eth)) {
      throw errorDePago('DATOS_INVALIDOS', 'El importe en ETH no coincide con la cotización. Volvé a cargar el pago.');
    }
    if (Number.isNaN(vencimiento(pago.bloqueo_expira_en))) {
      throw errorDePago('DATOS_INVALIDOS', 'No pudimos validar el vencimiento del pago. Volvé a cargar.');
    }
    return Object.freeze({
      reserva_id: id, tipo, monto_pesos: pago.monto_pesos, monto_wei: pago.monto_wei,
      pesos_por_eth: pago.pesos_por_eth, red: RED, contrato_direccion: pago.contrato_direccion,
      bloqueo_expira_en: pago.bloqueo_expira_en ?? null,
    });
  }

  // Presenta ETH exacto, sin notación científica ni redondeos de punto flotante.
  function formatearEth(wei) {
    if (!/^(0|[1-9]\d*)$/.test(String(wei))) throw errorDePago('DATOS_INVALIDOS', 'Importe en ETH inválido.');
    const texto = String(wei).padStart(19, '0');
    const fraccion = texto.slice(-18).replace(/0+$/, '');
    return texto.slice(0, -18) + (fraccion ? '.' + fraccion : '');
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
      const expira = vencimiento(reserva.bloqueo_expira_en);
      if (Number.isNaN(expira)) return estado('Consultá el vencimiento de tu reserva', null, null, 'estado-no-publicada');
      if (expira !== null && expira <= ahora) return estado('Plazo para pagar vencido', null, null, 'estado-no-publicada');
      if (confirmado('sena')) return estado('Seña pagada; actualizando reserva', null, null, 'estado-publicada');
      return estado('Seña pendiente', 'sena', 'Pagar la seña');
    }
    if (confirmado('saldo')) return estado('Pago completo', null, null, 'estado-publicada');
    if (reserva.monto_faltante != null) {
      try {
        const faltante = decimal(String(reserva.monto_faltante));
        return faltante.numero > 0n ? estado('Saldo pendiente', 'saldo', 'Pagar el saldo') : estado('Pago completo', null, null, 'estado-publicada');
      } catch { return estado('Estado de pago no informado', null, null, 'estado-no-publicada'); }
    }
    return confirmado('sena') ? estado('Seña pagada', null, null, 'estado-publicada') : estado('Estado de pago no informado', null, null, 'estado-no-publicada');
  }

  return { RED, identificador, normalizarCotizacion, pesosAWei, formatearEth, mensajeErrorPago, estadoPagoReserva, vencimiento };
})();
if (typeof module !== 'undefined') module.exports = PagosModelo;
