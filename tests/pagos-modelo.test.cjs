const { test } = require('node:test');
const assert = require('node:assert/strict');
const modelo = require('../funcionalidades/pagos-modelo.js');

const direccion = '0x1111111111111111111111111111111111111111';
const pago = () => ({ reserva_id: 12, tipo: 'sena', monto_pesos: '100000.00', monto_wei: '1000000000000000', pesos_por_eth: '100000000', red: 84532, contrato_direccion: direccion });
const normalizar = valor => modelo.normalizarCotizacion({ pago: valor }, { reservaId: '12', tipo: 'sena' });

test('convierte pesos a wei sin punto flotante y conserva valores grandes', () => {
  assert.equal(modelo.pesosAWei('100000', '100000000'), 1000000000000000n);
  assert.equal(modelo.pesosAWei('9007199254740993.01', '100000000'), 90071992547409930100000000n);
  assert.equal(modelo.pesosAWei('0.01', '100000000'), 100000000n);
  assert.equal(modelo.pesosAWei('1', '3'), 333333333333333334n);
  assert.equal(modelo.pesosAWei('1.25', '2.5'), 500000000000000000n);
});

test('rechaza dinero ambiguo, infinito, negativo o fuera de rango', () => {
  for (const valor of [0.1, '0', '-1', '1e5', 'NaN', 'Infinity', '', ' 1', '1,50', '01', '1.0000000000000000001']) {
    assert.throws(() => modelo.pesosAWei(valor, '100000000'));
  }
  assert.throws(() => modelo.pesosAWei('1', '0'));
  assert.throws(() => modelo.pesosAWei('9'.repeat(60), '0.000000000000000001'));
});

test('normaliza cotización con IDs seguros y mantiene importes como strings', () => {
  const actual = normalizar(pago());
  assert.equal(actual.reserva_id, '12');
  assert.equal(actual.monto_wei, '1000000000000000');
  assert.equal(actual.monto_pesos, '100000.00');
  assert.equal(actual.bloqueo_expira_en, null);
  assert.equal(Object.isFrozen(actual), true);
});

test('no autoriza otra reserva, tipo, red, contrato ni monto alterado', () => {
  for (const cambios of [
    { reserva_id: 13 }, { reserva_id: 12.5 }, { reserva_id: Number.MAX_SAFE_INTEGER + 1 },
    { tipo: 'saldo' }, { red: 1 }, { red: '84532' }, { contrato_direccion: '0x' + '0'.repeat(40) },
    { contrato_direccion: 'javascript:alert(1)' }, { monto_wei: 1000000000000000 },
    { monto_wei: '1000000000000001' }, { monto_wei: '0' }, { monto_pesos: 100000 },
    { pesos_por_eth: '99999999' }, { bloqueo_expira_en: '2026-11-05 12:00:00' },
  ]) assert.throws(() => normalizar({ ...pago(), ...cambios }), JSON.stringify(cambios));
});

test('fecha de vencimiento exige zona y admite ISO inequívoco', () => {
  assert.equal(modelo.vencimiento(null), null);
  assert.ok(Number.isNaN(modelo.vencimiento('2026-11-05T12:00:00')));
  assert.equal(modelo.vencimiento('2026-11-05T12:00:00-03:00'), Date.parse('2026-11-05T15:00:00Z'));
  assert.equal(normalizar({ ...pago(), bloqueo_expira_en: '2026-11-05T12:00:00Z' }).bloqueo_expira_en, '2026-11-05T12:00:00Z');
});

test('presenta ETH de cualquier precisión sin notación científica', () => {
  assert.equal(modelo.formatearEth('1000000000000000'), '0.001');
  assert.equal(modelo.formatearEth('1'), '0.000000000000000001');
  assert.equal(modelo.formatearEth('1000000000000000000'), '1');
  assert.equal(modelo.formatearEth('1234567890123456789'), '1.234567890123456789');
  assert.throws(() => modelo.formatearEth('-1'));
});

test('solo habilita seña en reservas pendientes vigentes', () => {
  for (const estado of ['pendiente', 'pendiente_pago']) {
    assert.equal(modelo.estadoPagoReserva({ estado }).tipo, 'sena');
    assert.equal(modelo.estadoPagoReserva({ estado, bloqueo_expira_en: '2026-11-05T12:00:00Z' }, Date.parse('2026-11-05T13:00:00Z')).tipo, null);
    assert.equal(modelo.estadoPagoReserva({ estado, bloqueo_expira_en: 'fecha inválida' }).tipo, null);
  }
  for (const estado of ['cancelada', 'finalizada', 'rechazada', 'vencida']) {
    assert.equal(modelo.estadoPagoReserva({ estado, monto_faltante: '500' }).tipo, null);
  }
});

test('saldo necesita importe explícito y estado confirmado; no inventa pagos legacy', () => {
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', monto_faltante: '9007199254740993.01' }).tipo, 'saldo');
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', monto_faltante: '0.00' }).texto, 'Pago completo');
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada' }).texto, 'Estado de pago no informado');
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', monto_faltante: '-20' }).tipo, null);
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', monto_faltante: '1', pagos: [{ tipo: 'saldo', estado: 'confirmado' }] }).tipo, null);
});

test('una transacción pendiente invita a revisar antes de enviar otro pago', () => {
  const reserva = { estado: 'pendiente', pagos: [{ tipo: 'sena', estado: 'pendiente', tx_hash: '0x' + 'a'.repeat(64) }] };
  assert.equal(modelo.estadoPagoReserva(reserva).accion, 'Revisar pago');
  reserva.estado = 'cancelada';
  assert.equal(modelo.estadoPagoReserva(reserva).tipo, null);
});

test('explica rechazo, fondos, red, caída de CDN y espera sin filtrar mensajes arbitrarios', () => {
  assert.match(modelo.mensajeErrorPago({ cause: { code: 4001 } }), /Rechazaste/);
  assert.match(modelo.mensajeErrorPago({ cause: { name: 'InsufficientFundsError' } }), /ETH de prueba/);
  assert.match(modelo.mensajeErrorPago({ name: 'ChainMismatchError' }), /Base Sepolia/);
  assert.match(modelo.mensajeErrorPago({ codigo: 'CDN_NO_DISPONIBLE' }), /cargar/);
  assert.match(modelo.mensajeErrorPago({ name: 'WaitForTransactionReceiptTimeoutError' }), /sin volver a pagar/);
  assert.match(modelo.mensajeErrorPago({ envioIncierto: true, cause: { name: 'InsufficientFundsError' } }), /pudo haber enviado/);
  assert.doesNotMatch(modelo.mensajeErrorPago(new Error('<script>privado</script>')), /privado/);
  const ciclo = {}; ciclo.cause = ciclo;
  assert.ok(modelo.mensajeErrorPago(ciclo));
});
