// Adaptador de MetaMask con viem ESM: no requiere bundler ni recibe claves privadas.
export const VERSION_VIEM = '2.38.5';
export const BASE_SEPOLIA = Object.freeze({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' } },
  testnet: true,
});
export const ABI_PAGOS = Object.freeze(['pagarSena', 'pagarSaldo'].map(name => ({
  type: 'function', name, stateMutability: 'payable', inputs: [{ name: 'reservaId', type: 'uint256' }], outputs: [],
})));

// Conserva código y causa para distinguir errores terminales de una espera pendiente.
function fallo(codigo, message, opciones = {}) {
  return Object.assign(new Error(message), { codigo, definitivo: false, ...opciones });
}

// Encuentra errores JSON-RPC anidados por viem sin importar clases de la librería.
function codigoEn(error, codigo) {
  const vistos = new Set();
  for (let causa = error; causa && !vistos.has(causa); causa = causa.cause) {
    if (causa.code === codigo) return true;
    vistos.add(causa);
  }
  return false;
}

// Elige MetaMask cuando el navegador tiene varias extensiones de billetera.
function proveedorMetaMask() {
  const ethereum = globalThis.window?.ethereum;
  return ethereum?.providers?.find(p => p.isMetaMask) ?? (ethereum?.isMetaMask ? ethereum : null);
}

// La versión fija evita cambios involuntarios del cliente entre cargas de la página.
async function importarViem() {
  return import('https://esm.sh/viem@2.38.5?bundle');
}

// Crea clientes independientes: consultar una transacción no exige conectar MetaMask otra vez.
export function crearBilletera({ proveedor, cargarViem = importarViem } = {}) {
  let clientes;
  let cuenta;
  let wallet;
  let enviando = false;

  // Carga viem una vez y permite reintentar si el CDN estaba temporalmente caído.
  async function obtenerClientes() {
    if (!clientes) clientes = Promise.resolve().then(cargarViem).then(viem => ({
      viem,
      publico: viem.createPublicClient({ chain: BASE_SEPOLIA, transport: viem.http(), pollingInterval: 2000 }),
    })).catch(cause => { clientes = null; throw fallo('CDN_NO_DISPONIBLE', 'No se pudo cargar viem.', { cause }); });
    return clientes;
  }

  // Agrega la red solo si MetaMask informa que todavía no la conoce.
  async function asegurarRed() {
    if (await wallet.getChainId() !== BASE_SEPOLIA.id) {
      try { await wallet.switchChain({ id: BASE_SEPOLIA.id }); }
      catch (error) {
        if (!codigoEn(error, 4902)) throw error;
        await wallet.addChain({ chain: BASE_SEPOLIA });
        await wallet.switchChain({ id: BASE_SEPOLIA.id });
      }
    }
    if (await wallet.getChainId() !== BASE_SEPOLIA.id) throw fallo('RED_INCORRECTA', 'MetaMask no cambió a Base Sepolia.');
  }

  // Solicita permiso a MetaMask y deja la cuenta preparada para Base Sepolia.
  async function conectar() {
    const provider = proveedor ?? proveedorMetaMask();
    if (!provider?.request) throw fallo('SIN_BILLETERA', 'MetaMask no está disponible.');
    const { viem } = await obtenerClientes();
    wallet = viem.createWalletClient({ chain: BASE_SEPOLIA, transport: viem.custom(provider) });
    const cuentas = await wallet.requestAddresses();
    cuenta = undefined;
    if (!/^0x[0-9a-fA-F]{40}$/.test(cuentas[0] ?? '')) throw fallo('CUENTA_CAMBIADA', 'MetaMask no informó una cuenta.');
    await asegurarRed();
    cuenta = cuentas[0];
    return cuenta;
  }

  // Confirma cuenta y red inmediatamente antes de enviar, incluso si cambiaron durante la simulación.
  async function verificarConexion() {
    if (!wallet || !cuenta) throw fallo('CUENTA_CAMBIADA', 'Conectá la billetera antes de pagar.');
    const cuentas = await wallet.getAddresses();
    if (cuentas[0]?.toLowerCase() !== cuenta.toLowerCase()) throw fallo('CUENTA_CAMBIADA', 'La cuenta de MetaMask cambió.');
    if (await wallet.getChainId() !== BASE_SEPOLIA.id) throw fallo('RED_INCORRECTA', 'La red de MetaMask cambió.');
  }

  // Simula y envía únicamente las dos funciones de pago acordadas; nunca usa calldata del servidor.
  async function enviarPago(cotizacion) {
    if (enviando) throw fallo('ENVIO_EN_CURSO', 'Ya hay un pago esperando respuesta de MetaMask.');
    enviando = true;
    try {
      if (cotizacion?.red !== BASE_SEPOLIA.id || !['sena', 'saldo'].includes(cotizacion?.tipo)) throw fallo('DATOS_INVALIDOS', 'La cotización del pago es inválida.');
      const { publico } = await obtenerClientes();
      await verificarConexion();
      const expira = cotizacion.bloqueo_expira_en == null ? null : Date.parse(cotizacion.bloqueo_expira_en);
      if (expira !== null && (!Number.isFinite(expira) || expira <= Date.now())) throw fallo('RESERVA_VENCIDA', 'El plazo para pagar venció. Volvé a Mis reservas.');
      const value = BigInt(cotizacion.monto_wei);
      if (value <= 0n) throw fallo('DATOS_INVALIDOS', 'El importe del pago es inválido.');
      const codigo = await publico.getBytecode({ address: cotizacion.contrato_direccion });
      if (!codigo || codigo === '0x') throw fallo('CONTRATO_NO_DISPONIBLE', 'No existe un contrato en la dirección configurada.');
      if (await publico.getBalance({ address: cuenta }) < value) throw fallo('SIN_SALDO', 'Saldo de ETH insuficiente.');
      const { request } = await publico.simulateContract({
        account: cuenta, address: cotizacion.contrato_direccion, abi: ABI_PAGOS,
        functionName: cotizacion.tipo === 'sena' ? 'pagarSena' : 'pagarSaldo',
        args: [BigInt(cotizacion.reserva_id)], value,
      });
      await verificarConexion();
      if (expira !== null && expira <= Date.now()) throw fallo('RESERVA_VENCIDA', 'El plazo para pagar venció. Volvé a Mis reservas.');
      let hash;
      try {
        hash = await wallet.writeContract({ ...request, chain: BASE_SEPOLIA, account: cuenta });
      } catch (cause) {
        // La solicitud pudo llegar a la red aunque se haya perdido su respuesta.
        if (codigoEn(cause, 4001)) throw cause;
        throw fallo('ENVIO_INCIERTO', 'No pudimos comprobar si MetaMask envió la transacción.', { cause, envioIncierto: true });
      }
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? '')) throw fallo('RESPUESTA_BILLETERA_INVALIDA', 'La billetera no devolvió el identificador de la transacción.', { envioIncierto: true });
      return hash;
    } finally { enviando = false; }
  }

  // Una espera vencida conserva el pago pendiente; solo una reversión o cancelación lo termina.
  async function esperarPago(hash, { onReplaced } = {}) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? '')) throw fallo('DATOS_INVALIDOS', 'El identificador de transacción es inválido.');
    const { publico } = await obtenerClientes();
    let reemplazo;
    let receipt;
    try {
      receipt = await publico.waitForTransactionReceipt({
        hash, confirmations: 1, timeout: 120000, pollingInterval: 2000,
        onReplaced: evento => { reemplazo = evento; onReplaced?.(evento); },
      });
    } catch (cause) {
      if (cause.name === 'WaitForTransactionReceiptTimeoutError') throw fallo('ESPERA_AGOTADA', 'La transacción sigue pendiente.', { cause });
      throw cause;
    }
    if (reemplazo?.reason === 'cancelled') throw fallo('TRANSACCION_CANCELADA', 'La transacción fue cancelada.', { definitivo: true });
    if (reemplazo?.reason === 'replaced') throw fallo('TRANSACCION_REEMPLAZADA', 'La transacción fue reemplazada por otra operación.');
    if (receipt.status === 'reverted') throw fallo('TRANSACCION_FALLIDA', 'La transacción revirtió.', { definitivo: true });
    if (receipt.status !== 'success' || !/^0x[0-9a-fA-F]{64}$/.test(receipt.transactionHash ?? '')) throw fallo('RESPUESTA_RED_INVALIDA', 'La red no informó un resultado válido.');
    return receipt;
  }

  return { conectar, enviarPago, esperarPago };
}
