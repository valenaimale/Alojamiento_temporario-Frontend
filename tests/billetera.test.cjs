const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fuente = fs.readFileSync(path.join(__dirname, '../funcionalidades/billetera.js'), 'utf8');
const modulo = import('data:text/javascript;base64,' + Buffer.from(fuente).toString('base64'));
const cuenta = '0x1111111111111111111111111111111111111111';
const contrato = '0x2222222222222222222222222222222222222222';
const hash = '0x' + 'a'.repeat(64);
const hashNuevo = '0x' + 'b'.repeat(64);
const cotizacion = () => ({ reserva_id: '12', tipo: 'sena', monto_wei: '1000000000000000', red: 84532, contrato_direccion: contrato });

// Simula viem en su límite público y registra lo que realmente se pediría firmar.
async function entorno() {
  const llamadas = [];
  const estado = { red: 84532, cuenta, saldo: 1000000000000000000n };
  const wallet = {
    requestAddresses: async () => [estado.cuenta],
    getAddresses: async () => [estado.cuenta],
    getChainId: async () => estado.red,
    switchChain: async ({ id }) => { llamadas.push(['switch', id]); estado.red = id; },
    addChain: async ({ chain }) => { llamadas.push(['add', chain.id]); },
    writeContract: async request => { llamadas.push(['write', request]); return hash; },
  };
  const publico = {
    getBytecode: async () => '0x6000',
    getBalance: async () => estado.saldo,
    simulateContract: async request => { llamadas.push(['simulate', request]); return { request }; },
    waitForTransactionReceipt: async opciones => { llamadas.push(['wait', opciones]); return { status: 'success', transactionHash: opciones.hash }; },
  };
  const viem = { createWalletClient: () => wallet, createPublicClient: () => publico, http() {}, custom() {} };
  const { crearBilletera } = await modulo;
  const billetera = crearBilletera({ proveedor: { request() {} }, cargarViem: async () => viem });
  return { billetera, wallet, publico, estado, llamadas, viem, crearBilletera };
}

test('conecta MetaMask y cambia a Base Sepolia antes de devolver cuenta', async () => {
  const e = await entorno(); e.estado.red = 1;
  assert.equal(await e.billetera.conectar(), cuenta);
  assert.deepEqual(e.llamadas, [['switch', 84532]]);
});

test('agrega red desconocida y verifica que el cambio se haya aplicado', async () => {
  const e = await entorno(); e.estado.red = 1;
  let intentos = 0;
  e.wallet.switchChain = async ({ id }) => { if (!intentos++) throw { cause: { code: 4902 } }; e.estado.red = id; };
  await e.billetera.conectar();
  assert.deepEqual(e.llamadas, [['add', 84532]]);
  e.estado.red = 1;
  e.wallet.switchChain = async () => {};
  await assert.rejects(e.billetera.conectar(), { codigo: 'RED_INCORRECTA' });
});

test('rechazar permiso o red no dispara transacciones', async () => {
  const e = await entorno();
  e.wallet.requestAddresses = async () => { throw { code: 4001 }; };
  await assert.rejects(e.billetera.conectar(), { code: 4001 });
  assert.equal(e.llamadas.length, 0);
});

test('pagar seña y saldo simula ABI fijo con monto e ID BigInt', async () => {
  const e = await entorno(); await e.billetera.conectar();
  for (const [tipo, funcion] of [['sena', 'pagarSena'], ['saldo', 'pagarSaldo']]) {
    assert.equal(await e.billetera.enviarPago({ ...cotizacion(), tipo }), hash);
    const request = e.llamadas.at(-1)[1];
    assert.equal(request.functionName, funcion);
    assert.equal(request.value, 1000000000000000n);
    assert.deepEqual(request.args, [12n]);
    assert.equal(request.address, contrato);
    assert.equal(request.account, cuenta);
    assert.equal(request.chain.id, 84532);
  }
  assert.deepEqual(e.llamadas.map(c => c[0]), ['simulate', 'write', 'simulate', 'write']);
});

test('rechazo de firma conserva la causa y permite reintentar', async () => {
  const e = await entorno(); await e.billetera.conectar();
  e.wallet.writeContract = async () => { throw { cause: { code: 4001 } }; };
  await assert.rejects(e.billetera.enviarPago(cotizacion()), error => error.cause.code === 4001 && !error.envioIncierto);
  e.wallet.writeContract = async () => hash;
  assert.equal(await e.billetera.enviarPago(cotizacion()), hash);
});

test('respuesta perdida o hash inválido después de firmar bloquean un nuevo cobro', async () => {
  const e = await entorno(); await e.billetera.conectar();
  const causa = new Error('RPC disconnected after send');
  e.wallet.writeContract = async () => { throw causa; };
  await assert.rejects(e.billetera.enviarPago(cotizacion()), error => error.codigo === 'ENVIO_INCIERTO' && error.envioIncierto === true && error.cause === causa);
  e.wallet.writeContract = async () => 'respuesta perdida';
  await assert.rejects(e.billetera.enviarPago(cotizacion()), { codigo: 'RESPUESTA_BILLETERA_INVALIDA', envioIncierto: true });
});

test('errores de simulación previos al envío no se marcan como envío incierto', async () => {
  const e = await entorno(); await e.billetera.conectar();
  e.publico.simulateContract = async () => { throw new Error('RPC disconnected before send'); };
  await assert.rejects(e.billetera.enviarPago(cotizacion()), error => !error.envioIncierto);
  assert.equal(e.llamadas.some(c => c[0] === 'write'), false);
});

test('no envía fondos a una dirección sin contrato ni con saldo insuficiente', async () => {
  const e = await entorno(); await e.billetera.conectar();
  e.publico.getBytecode = async () => '0x';
  await assert.rejects(e.billetera.enviarPago(cotizacion()), { codigo: 'CONTRATO_NO_DISPONIBLE' });
  e.publico.getBytecode = async () => '0x6000'; e.estado.saldo = 1n;
  await assert.rejects(e.billetera.enviarPago(cotizacion()), { codigo: 'SIN_SALDO' });
  assert.equal(e.llamadas.length, 0);
});

test('rechaza red, tipo y vencimiento inválidos antes de firmar', async () => {
  const e = await entorno(); await e.billetera.conectar();
  await assert.rejects(e.billetera.enviarPago({ ...cotizacion(), red: 1 }), { codigo: 'DATOS_INVALIDOS' });
  await assert.rejects(e.billetera.enviarPago({ ...cotizacion(), tipo: 'liquidacion' }), { codigo: 'DATOS_INVALIDOS' });
  await assert.rejects(e.billetera.enviarPago({ ...cotizacion(), bloqueo_expira_en: '2020-01-01T00:00:00Z' }), { codigo: 'RESERVA_VENCIDA' });
  assert.equal(e.llamadas.length, 0);
});

test('cambiar cuenta o red durante la simulación impide enviar', async () => {
  for (const cambio of ['cuenta', 'red']) {
    const e = await entorno(); await e.billetera.conectar();
    e.publico.simulateContract = async request => { e.estado[cambio] = cambio === 'red' ? 1 : contrato; return { request }; };
    await assert.rejects(e.billetera.enviarPago(cotizacion()), { codigo: cambio === 'red' ? 'RED_INCORRECTA' : 'CUENTA_CAMBIADA' });
    assert.equal(e.llamadas.some(c => c[0] === 'write'), false);
  }
});

test('vencimiento durante simulación impide abrir la firma', async () => {
  const e = await entorno(); await e.billetera.conectar();
  const original = Date.now;
  let ahora = Date.parse('2030-01-01T00:00:00Z');
  Date.now = () => ahora;
  try {
    e.publico.simulateContract = async request => { ahora += 60000; return { request }; };
    await assert.rejects(e.billetera.enviarPago({ ...cotizacion(), bloqueo_expira_en: '2030-01-01T00:00:30Z' }), { codigo: 'RESERVA_VENCIDA' });
    assert.equal(e.llamadas.some(c => c[0] === 'write'), false);
  } finally { Date.now = original; }
});

test('doble envío no abre dos pedidos de firma', async () => {
  const e = await entorno(); await e.billetera.conectar();
  let resolver;
  e.publico.getBytecode = () => new Promise(resolve => { resolver = resolve; });
  const envio = e.billetera.enviarPago(cotizacion());
  await assert.rejects(e.billetera.enviarPago(cotizacion()), { codigo: 'ENVIO_EN_CURSO' });
  await new Promise(resolve => setImmediate(resolve));
  resolver('0x6000'); await envio;
  assert.equal(e.llamadas.filter(c => c[0] === 'write').length, 1);
});

test('espera receipt sin solicitar permisos de billetera', async () => {
  const e = await entorno();
  e.wallet.requestAddresses = async () => { throw new Error('No debe conectar'); };
  assert.equal((await e.billetera.esperarPago(hash)).transactionHash, hash);
  assert.equal(e.llamadas[0][1].confirmations, 1);
});

test('un pago acelerado devuelve y notifica el hash nuevo', async () => {
  const e = await entorno(); let recibido;
  e.publico.waitForTransactionReceipt = async ({ onReplaced }) => {
    const receipt = { status: 'success', transactionHash: hashNuevo };
    onReplaced({ reason: 'repriced', transactionReceipt: receipt, transaction: { hash: hashNuevo } });
    return receipt;
  };
  const receipt = await e.billetera.esperarPago(hash, { onReplaced: evento => { recibido = evento; } });
  assert.equal(recibido.reason, 'repriced'); assert.equal(receipt.transactionHash, hashNuevo);
});

test('cancelación y reversión son terminales; reemplazo distinto requiere revisión', async () => {
  const e = await entorno();
  for (const reason of ['cancelled', 'replaced']) {
    e.publico.waitForTransactionReceipt = async ({ onReplaced }) => { onReplaced({ reason }); return { status: 'success', transactionHash: hashNuevo }; };
    await assert.rejects(e.billetera.esperarPago(hash), { codigo: reason === 'cancelled' ? 'TRANSACCION_CANCELADA' : 'TRANSACCION_REEMPLAZADA', definitivo: reason === 'cancelled' });
  }
  e.publico.waitForTransactionReceipt = async () => ({ status: 'reverted' });
  await assert.rejects(e.billetera.esperarPago(hash), { codigo: 'TRANSACCION_FALLIDA', definitivo: true });
});

test('timeout y fallo RPC nunca afirman que el pago falló definitivamente', async () => {
  const e = await entorno();
  e.publico.waitForTransactionReceipt = async () => { throw { name: 'WaitForTransactionReceiptTimeoutError' }; };
  await assert.rejects(e.billetera.esperarPago(hash), { codigo: 'ESPERA_AGOTADA', definitivo: false });
  e.publico.waitForTransactionReceipt = async () => { throw new Error('RPC sin conexión'); };
  await assert.rejects(e.billetera.esperarPago(hash), error => error.definitivo !== true);
});

test('una caída del CDN permite reintentar su carga', async () => {
  const e = await entorno(); let cargas = 0;
  const billetera = e.crearBilletera({ proveedor: { request() {} }, cargarViem: async () => { if (!cargas++) throw new Error('Offline'); return e.viem; } });
  await assert.rejects(billetera.conectar(), { codigo: 'CDN_NO_DISPONIBLE' });
  assert.equal(await billetera.conectar(), cuenta);
  assert.equal(cargas, 2);
});
