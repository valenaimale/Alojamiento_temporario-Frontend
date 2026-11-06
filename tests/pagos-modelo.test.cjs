const { test } = require('node:test');
const assert = require('node:assert/strict');
const modelo = require('../funcionalidades/pagos-modelo.js');

const direccion = '0x1111111111111111111111111111111111111111';
const pago = () => ({ reserva_id: 12, tipo: 'sena', monto_pesos: '100000.00', monto_wei: '1000000000000000', pesos_por_eth: '100000000', red: 84532, pago: {contrato: direccion, funcion: 'pagarSena', simulado: false} });
const normalizar = valor => modelo.normalizarCotizacion(valor, { reservaId: '12', tipo: 'sena' });

test('convierte pesos a wei sin punto flotante y conserva valores grandes', () => {
  assert.equal(modelo.pesosAWei('100000', '100000000'), 1000000000000000n);
  assert.equal(modelo.pesosAWei('9007199254740993.01', '100000000'), 90071992547409930100000000n);
  assert.equal(modelo.pesosAWei('0.01', '100000000'), 100000000n);
  assert.equal(modelo.pesosAWei('1', '3'), 333333333333333333n);
  assert.equal(modelo.pesosAWei('1.25', '2.5'), 500000000000000000n);
});

test('rechaza dinero ambiguo, infinito, negativo o fuera de rango', () => {
  for (const valor of [0.1, '0', '-1', '1e5', 'NaN', 'Infinity', '', ' 1', '1,50', '01', '1.0000000000000000001']) {
    assert.throws(() => modelo.pesosAWei(valor, '100000000'));
  }
  assert.throws(() => modelo.pesosAWei('1', '0'));
  assert.throws(() => modelo.pesosAWei('9'.repeat(60), '0.000000000000000001'));
});

test('normaliza cotización con IDs seguros, pesos como strings y wei BigInt', () => {
  const actual = normalizar(pago());
  assert.equal(actual.reserva_id, '12');
  assert.equal(actual.monto_wei, 1000000000000000n);
  assert.equal(actual.monto_pesos, '100000.00');
  assert.equal(actual.vence_en, null);
  assert.equal(Object.isFrozen(actual), true);
});

test('no autoriza otra reserva, tipo, red, contrato ni monto alterado', () => {
  for (const cambios of [
    { reserva_id: 13 }, { reserva_id: 12.5 }, { reserva_id: Number.MAX_SAFE_INTEGER + 1 },
    { tipo: 'saldo' }, { red: 1 }, { red: '84532' }, { pago:{contrato:'0x'+'0'.repeat(40),funcion:'pagarSena',simulado:false} },
    { pago:{contrato:'javascript:alert(1)',funcion:'pagarSena',simulado:false} }, { monto_wei: 1000000000000000 },
    { monto_wei: '1000000000000001' }, { monto_wei: '0' }, { monto_pesos: 100000 },
    { pesos_por_eth: '99999999' }, { vence_en: '2026-11-05 12:00:00' },
  ]) assert.throws(() => normalizar({ ...pago(), ...cambios }), JSON.stringify(cambios));
});

test('fecha de vencimiento exige zona y admite ISO inequívoco', () => {
  assert.equal(modelo.vencimiento(null), null);
  assert.ok(Number.isNaN(modelo.vencimiento('2026-11-05T12:00:00')));
  assert.equal(modelo.vencimiento('2026-11-05T12:00:00-03:00'), Date.parse('2026-11-05T15:00:00Z'));
  assert.equal(normalizar({ ...pago(), vence_en: '2026-11-05T12:00:00Z' }).vence_en, '2026-11-05T12:00:00Z');
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
    assert.equal(modelo.estadoPagoReserva({ estado, puede_pagar:true }).tipo, 'sena');
    assert.equal(modelo.estadoPagoReserva({ estado, puede_pagar:true, vence_en: '2026-11-05T12:00:00Z' }, Date.parse('2026-11-05T13:00:00Z')).tipo, null);
    assert.equal(modelo.estadoPagoReserva({ estado, puede_pagar:true, vence_en: 'fecha inválida' }).tipo, null);
  }
  for (const estado of ['cancelada', 'finalizada', 'rechazada', 'vencida']) {
    assert.equal(modelo.estadoPagoReserva({ estado, saldo: '500' }).tipo, null);
  }
});

test('saldo necesita importe explícito y estado confirmado; no inventa pagos legacy', () => {
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', puede_pagar_saldo: true, saldo: '9007199254740993.01' }).tipo, 'saldo');
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', puede_pagar_saldo: true, saldo: '0.00' }).texto, 'Pago completo');
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada' }).texto, 'Estado de pago no informado');
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', puede_pagar_saldo: true, saldo: '-20' }).tipo, null);
  assert.equal(modelo.estadoPagoReserva({ estado: 'confirmada', puede_pagar_saldo: true, saldo: '1', pagos: [{ tipo: 'saldo', estado: 'confirmado' }] }).tipo, null);
});

test('una transacción pendiente invita a revisar antes de enviar otro pago', () => {
  const reserva = { estado: 'pendiente', puede_pagar:true, pagos: [{ tipo: 'sena', estado: 'pendiente', tx_hash: '0x' + 'a'.repeat(64) }] };
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


test('simulación exige bandera y red local explícitas, sin contrato', () => {
  const simulado = {...pago(), red:31337, pago:{contrato:null,funcion:'pagarSena',simulado:true}};
  assert.equal(normalizar(simulado).simulado,true);
  for (const cambio of [{red:84532},{pago:{simulado:'true',funcion:'pagarSena'}},{pago:{simulado:true,funcion:'liquidar'}}]) assert.throws(()=>normalizar({...simulado,...cambio}));
});
test('wei a pesos conserva centavos e importes grandes', () => {
  assert.equal(modelo.weiAPesos(90071992547409930100000000n,'100000000'),'9007199254740993.01');
  assert.equal(modelo.weiAPesos(1n,'100000000'),'0.00');
});
test('permiso del servidor prevalece y saldo vence al terminar fecha argentina', () => {
  assert.equal(modelo.estadoPagoReserva({estado:'pendiente',puede_pagar:false}).tipo,null);
  assert.equal(modelo.estadoPagoReserva({estado:'pendiente'}).tipo,null);
  const r={estado:'confirmada',saldo:'50.00',puede_pagar_saldo:true,fecha_cobro:'2026-11-05'};
  assert.equal(modelo.estadoPagoReserva(r,Date.parse('2026-11-06T02:59:59Z')).tipo,'saldo');
  assert.equal(modelo.estadoPagoReserva(r,Date.parse('2026-11-06T03:00:00Z')).texto,'Saldo vencido: pagalo antes de ingresar');
  assert.equal(modelo.estadoPagoReserva({...r,puede_pagar_saldo:false},Date.parse('2026-11-05T12:00:00Z')).tipo,null);
});

const cancelacion = cambios => ({reserva_id:42,estado:'confirmada',tramo:'mas_de_30',dias_hasta_cobro:45,porcentaje_retencion:'30.00',pagado:{sena:'42000.00',saldo:'168000.00'},retencion:'12600.00',devolucion:'197400.00',devolucion_wei:'1974000000000000',...cambios});
test('cancelación conserva importes del backend y wei exacto; explica cada tramo y saldo completo',()=>{
  for(const [tramo,dias,texto] of [['mas_de_30',45,'más de 30'],['de_15_a_30',15,'entre 15 y 30'],['menos_de_15',-2,'ya pasó']]){
    const q=modelo.normalizarCancelacion(cancelacion({tramo,dias_hasta_cobro:dias}),42);
    assert.match(q.explicacion,new RegExp(texto));assert.match(q.explicacion,/saldo pagado se devuelve entero/);
    assert.equal(q.devolucion,'197400.00');assert.equal(q.devolucion_wei,1974000000000000n);
  }
  const sinPago=modelo.normalizarCancelacion(cancelacion({pagado:{sena:'0.00',saldo:'0.00'},retencion:'0.00',devolucion:'0.00',devolucion_wei:'0'}),42);
  assert.match(sinPago.explicacion,/no corresponde devolución/);
  assert.equal(modelo.normalizarCancelacion(cancelacion({devolucion_wei:'9007199254740993123456789'}),42).devolucion_wei,9007199254740993123456789n);
});
test('vista previa ajena, mal formada o sin importes impide confirmar',()=>{
  for(const cambio of [{reserva_id:43},{estado:'cancelada'},{tramo:'otro'},{pagado:null},{devolucion_wei:1974000000000000},{porcentaje_retencion:'101.00'},{devolucion:'NaN'}]){
    assert.throws(()=>modelo.normalizarCancelacion(cancelacion(cambio),42));
  }
});


test('plazo de saldo suma tres días calendario y nunca supera el ingreso', () => {
  for (const [cobro, ingreso, esperado] of [
    ['2026-11-05','2026-11-10','2026-11-08'],
    ['2026-11-05','2026-11-06','2026-11-06'],
    ['2026-12-30','2027-01-10','2027-01-02'],
    ['2028-02-27','2028-03-10','2028-03-01'],
    ['2026-11-05','2026-11-05','2026-11-05'],
  ]) assert.equal(modelo.plazoSaldo({fecha_cobro:cobro,ingreso}), esperado);
  for (const fecha_cobro of [null,'2026-02-30','basura','2026-12-20'])
    assert.equal(modelo.plazoSaldo({fecha_cobro,ingreso:'2026-11-10'}), null);
  assert.match(modelo.avisoSaldo({fecha_cobro:'2026-11-05',ingreso:'2026-11-10',retencion_menos_de_15:'70.00'}), /8 nov 2026 inclusive.*70 % de la seña/);
  assert.doesNotMatch(modelo.avisoSaldo({retencion_menos_de_15:null}), /0 %|null|Invalid/);
});

test('errores decodificados del contrato indican acción sin perder protección ante envío incierto', () => {
  assert.match(modelo.mensajeErrorPago({cause:{data:{errorName:'HuespedIncorrecto'}}}), /misma cuenta/);
  assert.match(modelo.mensajeErrorPago({cause:{data:{errorName:'SaldoYaPagado'}}}), /no vuelvas a pagar/);
  assert.match(modelo.mensajeErrorPago({data:{errorName:'SinSena'}}), /Primero.*seña/);
  assert.match(modelo.mensajeErrorPago({envioIncierto:true,cause:{data:{errorName:'SaldoYaPagado'}}}), /pudo haber enviado/);
  assert.doesNotMatch(modelo.mensajeErrorPago({data:{errorName:'<script>privado</script>'}}), /privado/);
});
