// Coordina la cotización, la firma y el registro del pago sin repetir transferencias.
const estadoDelPago = {
  reservaId: null, tipo: null, usuario: null, reserva: null,
  cotizacion: null, billetera: null, pendiente: null, ocupado: false, completo: false, espera: false, temporizador: null, conflicto: false, fallido: false,
};

// Centraliza el acceso a los elementos de esta pantalla.
function elementoPago(id) { return document.getElementById(id); }

// Identifica mensajes de la aplicación para distinguirlos de errores técnicos de la billetera.
function errorPantallaPago(mensaje) {
  return Object.assign(new Error(mensaje), { mensajeUsuario: mensaje });
}

// Conserva la reserva al volver a iniciar sesión, sin guardar credenciales.
function enlaceSesionPago() {
  const volver = `../reservas/pagar.html?reserva_id=${estadoDelPago.reservaId}&tipo=${estadoDelPago.tipo}`;
  return `../sesion/inicio-sesion.html?volver=${encodeURIComponent(volver)}`;
}

// Aísla la transacción pendiente por usuario, reserva y concepto.
function clavePagoPendiente() {
  return `haylugar:pago:${estadoDelPago.usuario.id}:${estadoDelPago.reservaId}:${estadoDelPago.tipo}`;
}

// Recupera exclusivamente un hash válido; el servidor siempre verifica su pertenencia.
function leerPagoPendiente() {
  const valor = sessionStorage.getItem(clavePagoPendiente());
  if (!valor) return null;
  let pendiente;
  try { pendiente = JSON.parse(valor); }
  catch { throw errorPantallaPago('No pudimos leer el pago guardado. Revisá tu transacción en MetaMask antes de volver a pagar.'); }
  if (pendiente?.estado === 'envio_incierto' && pendiente.red === 84532 && pendiente.simulado === false) return pendiente;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pendiente?.hash) || !((pendiente?.red === 84532 && pendiente.simulado === false) || (pendiente?.red === 31337 && pendiente.simulado === true))) {
    throw errorPantallaPago('El identificador guardado no es válido. Revisá tu transacción en MetaMask antes de volver a pagar.');
  }
  return pendiente;
}

// Guarda antes de esperar la red para poder recuperar el pago tras una interrupción.
function guardarPagoPendiente(hash, datos = estadoDelPago.pendiente || estadoDelPago.cotizacion) {
  estadoDelPago.pendiente = { hash, red: datos.red, simulado: datos.simulado };
  mostrarTransaccionPago();
  try { sessionStorage.setItem(clavePagoPendiente(), JSON.stringify(estadoDelPago.pendiente)); }
  catch { throw errorPantallaPago('No pudimos guardar el identificador en este dispositivo. Copialo antes de cerrar esta página.'); }
}

// Comprueba la persistencia antes de pedir una firma.
function comprobarAlmacenamientoPago() {
  const clave = `${clavePagoPendiente()}:comprobacion`;
  try { sessionStorage.setItem(clave, '1'); sessionStorage.removeItem(clave); }
  catch { throw errorPantallaPago('Habilitá el almacenamiento de este sitio para recuperar la confirmación si se interrumpe el pago.'); }
}

// Presenta un enlace del explorador solamente para hashes validados.
function mostrarTransaccionPago() {
  const hash = estadoDelPago.pendiente?.hash;
  elementoPago('transaccion-pago').hidden = !hash;
  if (!hash) return;
  elementoPago('hash-pago').textContent = hash;
  elementoPago('enlace-transaccion').hidden = estadoDelPago.pendiente.simulado;
  elementoPago('enlace-transaccion').href = `https://sepolia.basescan.org/tx/${hash}`;
}

// Marca el paso actual y anuncia su estado sin depender del color.
function mostrarPasoPago(paso, texto) {
  ['firma', 'red', 'registro'].forEach((nombre, indice) => {
    const item = elementoPago(`paso-${nombre}`);
    item.classList.toggle('paso-completo', indice < paso);
    if (indice === paso) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  elementoPago('estado-pago').textContent = texto;
}

// Ofrece reintentar la confirmación cuando ya existe un envío.
function actualizarBotonPago() {
  const boton = elementoPago('boton-pagar');
  const incierto = estadoDelPago.pendiente?.estado === 'envio_incierto';
  boton.hidden = estadoDelPago.completo || incierto || estadoDelPago.conflicto;
  elementoPago('recuperar-transaccion').hidden = !incierto;
  elementoPago('hash-recuperar').disabled = estadoDelPago.ocupado;
  elementoPago('boton-recuperar').disabled = estadoDelPago.ocupado;
  boton.disabled = estadoDelPago.ocupado || estadoDelPago.espera || (!estadoDelPago.pendiente && !estadoDelPago.cotizacion && !estadoDelPago.fallido);
  boton.textContent = estadoDelPago.ocupado || estadoDelPago.espera ? 'Confirmando pago…'
    : estadoDelPago.pendiente ? 'Retomar confirmación'
    : estadoDelPago.fallido ? 'Pagar de nuevo'
    : estadoDelPago.cotizacion?.simulado ? 'Pagar (simulado)'
    : estadoDelPago.tipo === 'saldo' ? 'Pagar el saldo' : 'Pagar la seña';
}

// Traduce los errores HTTP y conserva el hash si la sesión vence.
async function consultarPago(ruta, opciones, devolverRespuesta = false) {
  let respuesta, resultado;
  try { ({ respuesta, resultado } = await pedirAlBack(ruta, opciones)); }
  catch { throw errorPantallaPago('No pudimos conectar con el servicio de pagos. Revisá la conexión y volvé a intentar.'); }
  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      const enlace = elementoPago('sesion-pago');
      enlace.href = enlaceSesionPago();
      enlace.hidden = false;
    }
    const mensaje = respuesta.status === 404 || respuesta.status === 503
      ? 'El pago todavía no está disponible para esta reserva. Volvé a intentarlo más tarde desde Mis reservas.'
      : resultado?.error || 'No pudimos consultar el pago. Volvé a intentar.';
    throw Object.assign(errorPantallaPago(mensaje), { status: respuesta.status });
  }
  return devolverRespuesta ? { respuesta, resultado } : resultado;
}

// Valida una cotización nueva; el navegador no decide cuánto cobrar.
async function consultarCotizacionPago() {
  const resultado = await consultarPago(`/pagos/${estadoDelPago.tipo}?reserva_id=${estadoDelPago.reservaId}`);
  return PagosModelo.normalizarCotizacion(resultado, { reservaId: estadoDelPago.reservaId, tipo: estadoDelPago.tipo });
}

// Muestra las fechas usando la convención local de reservas.
function fechaVisiblePago(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return 'No informada';
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${fecha}T12:00:00`));
}

// Renderiza el resumen autorizado obtenido de las reservas de la sesión.
function mostrarResumenPago() {
  const reserva = estadoDelPago.reserva;
  elementoPago('contenido-pago').hidden = false;
  elementoPago('numero-reserva').textContent = `Reserva ${reserva.id}`;
  elementoPago('nombre-alojamiento').textContent = reserva.alojamiento?.nombre || 'Tu alojamiento';
  elementoPago('lugar-reserva').textContent = [reserva.alojamiento?.localidad, reserva.alojamiento?.provincia].filter(Boolean).join(', ');
  elementoPago('ingreso-reserva').textContent = fechaVisiblePago(reserva.ingreso);
  elementoPago('egreso-reserva').textContent = fechaVisiblePago(reserva.egreso);
  elementoPago('personas-reserva').textContent = `${reserva.noches} ${reserva.noches === 1 ? 'noche' : 'noches'} · ${reserva.personas} ${reserva.personas === 1 ? 'huésped' : 'huéspedes'}`;
  elementoPago('total-reserva').textContent = formatearPrecio(reserva.importe_total);
  elementoPago('sena-reserva').textContent = formatearPrecio(reserva.importe_sena);
}

// Presenta pesos, ETH exacto y tipo de cambio del servidor antes de firmar.
function mostrarCotizacionPago() {
  const pago = estadoDelPago.cotizacion;
  elementoPago('cotizacion-pago').hidden = !pago;
  if (!pago) return;
  elementoPago('concepto-pago').textContent = pago.tipo === 'saldo' ? 'Saldo a pagar' : 'Seña a pagar';
  elementoPago('monto-pesos').textContent = formatearPrecio(pago.monto_pesos);
  elementoPago('monto-eth').textContent = `${PagosModelo.formatearEth(pago.monto_wei)} ETH de prueba`;
  elementoPago('cambio-pago').textContent = `Conversión de prueba: 1 ETH = ${formatearPrecio(pago.pesos_por_eth)}.${pago.simulado ? ' No se transfieren fondos.' : ' El costo de la red se suma en MetaMask.'}`;
  mostrarModalidadPago(pago);
  const plazo = pago.tipo === 'sena' ? pago.vence_en : estadoDelPago.reserva.fecha_cobro;
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(plazo || '');
  const fecha = plazo && new Date(soloFecha ? `${plazo}T12:00:00-03:00` : plazo);
  elementoPago('plazo-pago').hidden = !fecha || Number.isNaN(fecha.getTime());
  if (!elementoPago('plazo-pago').hidden) {
    const formato = { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23' };
    if (!soloFecha) formato.timeStyle = 'short';
    const texto = new Intl.DateTimeFormat('es-AR', formato).format(fecha);
    elementoPago('plazo-pago').textContent = `${pago.tipo === 'sena' ? 'Pagá la seña antes del' : 'Vencimiento del saldo:'} ${texto}${soloFecha ? '.' : ' (hora argentina).'}`;
  }
}

// Carga viem solamente al iniciar o recuperar un pago.
async function obtenerBilleteraPago() {
  if (!estadoDelPago.billetera) {
    const { crearBilletera } = await import('./billetera.js');
    estadoDelPago.billetera = crearBilletera();
  }
  return estadoDelPago.billetera;
}

// Adapta las instrucciones a la modalidad explícita del backend.
function mostrarModalidadPago(pago) {
  const simulado = pago.simulado;
  elementoPago('modalidad-pago').textContent = simulado ? 'Pago simulado' : 'Pago en Base Sepolia';
  elementoPago('ayuda-modalidad').textContent = simulado
    ? 'Esta prueba registra el pago de tu reserva sin mover dinero ni conectar una billetera.'
    : 'Usamos ETH de prueba en Base Sepolia. Necesitás cubrir el importe y el costo de la transacción.';
  elementoPago('titulo-paso-firma').textContent = simulado ? 'Iniciá el pago simulado' : 'Confirmá en MetaMask';
  elementoPago('ayuda-paso-firma').textContent = simulado ? 'No necesitás MetaMask ni cambiar de red.' : 'Conectá tu billetera y autorizá el importe.';
  elementoPago('ayuda-paso-red').textContent = simulado ? 'Consultamos el resultado de la simulación.' : 'Verificamos tu transacción en Base Sepolia.';
}

// Genera un identificador único aceptado por el verificador de prueba.
function crearHashSimulado() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hash = Array.from(bytes, valor => valor.toString(16).padStart(2, '0')).join('');
  // El verificador reserva dead para fallos y 0000 para pendiente permanente.
  return `0x${hash.slice(0, -4)}0001`;
}

// Detiene la consulta programada al salir o ante una respuesta terminal.
function detenerConsultaPago() {
  if (estadoDelPago.temporizador !== null) clearTimeout(estadoDelPago.temporizador);
  estadoDelPago.temporizador = null;
  estadoDelPago.espera = false;
}

// El backend es la autoridad de confirmación tanto en simulación como en blockchain.
async function confirmarPagoEnviado() {
  mostrarPasoPago(2, 'Registrando y verificando el pago…');
  const { respuesta, resultado } = await consultarPago('/pagos/confirmar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reserva_id: estadoDelPago.reservaId, tipo: estadoDelPago.tipo, tx_hash: estadoDelPago.pendiente.hash }),
  }, true);
  if (respuesta.status === 202) {
    mostrarPasoPago(1, 'Pago pendiente. Volvemos a consultar en unos segundos; no hace falta pagar otra vez.');
    estadoDelPago.espera = true;
    estadoDelPago.temporizador = setTimeout(() => {
      estadoDelPago.espera = false;
      estadoDelPago.temporizador = null;
      return pagarReserva();
    }, 3500);
    return;
  }
  if (respuesta.status !== 200) throw errorPantallaPago('No pudimos verificar el resultado. Retomá la confirmación.');
  estadoDelPago.completo = true;
  detenerConsultaPago();
  try { sessionStorage.removeItem(clavePagoPendiente()); } catch { /* El backend ya registró el pago. */ }
  mostrarPasoPago(3, estadoDelPago.tipo === 'sena' ? 'Seña registrada. Tu reserva está confirmada.' : 'Saldo registrado. Tu pago está completo.');
  elementoPago('aviso-pago').textContent = estadoDelPago.pendiente.simulado ? 'Pago simulado registrado correctamente. No se transfirieron fondos.' : 'Pago confirmado y registrado correctamente.';
  elementoPago('ayuda-transaccion').textContent = estadoDelPago.pendiente.simulado ? 'Este identificador corresponde a la simulación; no existe una transacción en blockchain.' : 'Podés consultar el comprobante de la transacción en BaseScan.';
  elementoPago('volver-confirmado').hidden = false;
  elementoPago('volver-confirmado').focus();
}

// Compara importes y destino para que cualquier cambio se revise antes de la firma.
function mismaCotizacionPago(anterior, nueva) {
  return ['monto_wei', 'monto_pesos', 'pesos_por_eth', 'contrato', 'funcion', 'simulado', 'red', 'tipo', 'reserva_id']
    .every(campo => anterior?.[campo] === nueva[campo]);
}

// Ejecuta un único envío o retoma el existente, incluso después de recargar.
async function ejecutarPago() {
  estadoDelPago.pendiente = leerPagoPendiente() || estadoDelPago.pendiente;
  if (estadoDelPago.pendiente?.estado === 'envio_incierto') {
    throw errorPantallaPago('No sabemos si MetaMask envió el pago. Revisá su actividad y recuperá el identificador antes de continuar.');
  }
  if (!estadoDelPago.pendiente) {
    comprobarAlmacenamientoPago();
    const anterior = estadoDelPago.cotizacion;
    estadoDelPago.cotizacion = null;
    const nueva = await consultarCotizacionPago();
    estadoDelPago.cotizacion = nueva;
    mostrarCotizacionPago();
    if (!mismaCotizacionPago(anterior, nueva)) {
      throw errorPantallaPago('Los datos del pago cambiaron. Revisá el importe actualizado y volvé a confirmar.');
    }
    const expira = PagosModelo.vencimiento(nueva.vence_en);
    if (expira !== null && expira <= Date.now()) throw Object.assign(errorPantallaPago('Venció el plazo para pagar. Volvé a Mis reservas.'), {status: 409});
    let hash;
    if (nueva.simulado) {
      mostrarPasoPago(0, 'Iniciando el pago simulado…');
      hash = crearHashSimulado();
    } else {
      const billetera = await obtenerBilleteraPago();
      mostrarPasoPago(0, 'Conectá tu billetera y confirmá el pago en MetaMask.');
      const cuenta = await billetera.conectar();
      elementoPago('billetera-pago').textContent = `Billetera: ${cuenta.slice(0, 6)}…${cuenta.slice(-4)}`;
      hash = await billetera.enviarPago(nueva);
    }
    estadoDelPago.fallido = false;
    guardarPagoPendiente(hash, nueva);
  }
  mostrarTransaccionPago();
  await confirmarPagoEnviado();
}

// Bloquea dobles clics y coordina pestañas cuando Web Locks está disponible.
async function pagarReserva() {
  if (estadoDelPago.ocupado || estadoDelPago.completo || estadoDelPago.espera || estadoDelPago.conflicto) return;
  estadoDelPago.ocupado = true;
  elementoPago('error-pago').textContent = '';
  elementoPago('aviso-pago').textContent = '';
  actualizarBotonPago();
  try {
    if (navigator.locks?.request) {
      await navigator.locks.request(clavePagoPendiente(), { ifAvailable: true }, async bloqueo => {
        if (!bloqueo) throw errorPantallaPago('Ya hay un pago en curso en otra pestaña. Continuá allí o esperá su confirmación.');
        await ejecutarPago();
      });
    } else await ejecutarPago();
  } catch (error) {
    if (error.envioIncierto) {
      estadoDelPago.pendiente = { estado: 'envio_incierto', red: 84532, simulado: false };
      try { sessionStorage.setItem(clavePagoPendiente(), JSON.stringify(estadoDelPago.pendiente)); }
      catch { elementoPago('aviso-pago').textContent = 'Mantené esta página abierta mientras revisás la actividad en MetaMask.'; }
      mostrarPasoPago(1, 'El envío necesita revisión en MetaMask.');
    }
    detenerConsultaPago();
    if (error.status === 402 || (error.definitivo && ['TRANSACCION_FALLIDA', 'TRANSACCION_CANCELADA'].includes(error.codigo))) {
      try { sessionStorage.removeItem(clavePagoPendiente()); } catch { /* Reconciliar al volver a cargar si no puede borrarse. */ }
      estadoDelPago.pendiente = null;
      estadoDelPago.fallido = true;
      mostrarTransaccionPago();
      mostrarPasoPago(0, 'El pago fue rechazado. Podés iniciar otro intento.');
    }
    if (error.status === 409) {
      estadoDelPago.conflicto = true;
      elementoPago('recargar-pago').hidden = false;
      mostrarPasoPago(1, 'Revisá el estado actualizado de tu reserva antes de continuar.');
    }
    const mensaje = error.mensajeUsuario || PagosModelo.mensajeErrorPago(error);
    elementoPago('error-pago').textContent = mensaje;
    if (estadoDelPago.pendiente?.hash && !estadoDelPago.conflicto) elementoPago('estado-pago').textContent = 'Transacción guardada. Podés retomar la confirmación sin volver a pagar.';
    elementoPago('error-pago').focus();
    if (!estadoDelPago.pendiente && !estadoDelPago.cotizacion) elementoPago('recargar-pago').hidden = false;
  } finally {
    estadoDelPago.ocupado = false;
    actualizarBotonPago();
  }
}

// Recupera un envío incierto con el hash que el huésped consulta en MetaMask.
async function recuperarTransaccionPago(evento) {
  evento.preventDefault();
  if (estadoDelPago.ocupado) return;
  const hash = elementoPago('hash-recuperar').value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    elementoPago('error-pago').textContent = 'Copiá el identificador completo de la transacción desde MetaMask.';
    return;
  }
  try {
    guardarPagoPendiente(hash);
    await pagarReserva();
  } catch (error) {
    elementoPago('error-pago').textContent = error.mensajeUsuario || PagosModelo.mensajeErrorPago(error);
    actualizarBotonPago();
  }
}

// Autoriza al huésped y carga el resumen antes de ofrecer cualquier pago.
async function cargarPaginaPago() {
  if (estadoDelPago.ocupado) return;
  detenerConsultaPago();
  estadoDelPago.conflicto = false;
  estadoDelPago.fallido = false;
  estadoDelPago.ocupado = true;
  estadoDelPago.cotizacion = null;
  elementoPago('cotizacion-pago').hidden = true;
  elementoPago('error-pago').textContent = '';
  elementoPago('recargar-pago').hidden = true;
  elementoPago('cargando-pago').hidden = false;
  actualizarBotonPago();
  try {
    const parametros = new URLSearchParams(window.location.search);
    const id = parametros.get('reserva_id');
    const tipo = parametros.get('tipo') || 'sena';
    if (!PagosModelo.identificador(id) || !['sena', 'saldo'].includes(tipo)) throw errorPantallaPago('El enlace de pago no es válido. Abrí la reserva desde Mis reservas.');
    estadoDelPago.reservaId = id;
    estadoDelPago.tipo = tipo;
    estadoDelPago.usuario = await obtenerSesion();
    if (!estadoDelPago.usuario) { window.location.href = enlaceSesionPago(); return; }
    if (!tienePermiso(estadoDelPago.usuario.rol, 'huesped')) { window.location.href = '../errores/acceso-denegado.html'; return; }
    armarMenu(estadoDelPago.usuario.rol);
    document.body.hidden = false;
    elementoPago('titulo-pago').textContent = tipo === 'saldo' ? 'Pagá el saldo de tu reserva' : 'Confirmá tu reserva con la seña';
    const resultado = await consultarPago('/reservas/mias');
    estadoDelPago.reserva = resultado.reservas?.find(reserva => String(reserva.id) === id);
    if (!estadoDelPago.reserva) throw errorPantallaPago('No encontramos esta reserva en tu cuenta. Volvé a Mis reservas.');
    mostrarResumenPago();
    estadoDelPago.pendiente = leerPagoPendiente();
    const pagoServidor = estadoDelPago.reserva.pagos?.find(pago => pago.tipo === tipo && ['pendiente', 'confirmado'].includes(pago.estado) && /^0x[0-9a-fA-F]{64}$/.test(pago.tx_hash || ''));
    if ((!estadoDelPago.pendiente || estadoDelPago.pendiente.estado === 'envio_incierto') && pagoServidor && [31337, 84532].includes(pagoServidor.red)) guardarPagoPendiente(pagoServidor.tx_hash, {red: pagoServidor.red, simulado: pagoServidor.red === 31337});
    if (estadoDelPago.pendiente) {
      mostrarModalidadPago(estadoDelPago.pendiente);
      mostrarTransaccionPago();
      mostrarPasoPago(1, estadoDelPago.pendiente.hash ? 'Encontramos una transacción enviada. Retomá su confirmación.' : 'Revisá Actividad en MetaMask para recuperar tu pago.');
    } else {
      const siguiente = PagosModelo.estadoPagoReserva(estadoDelPago.reserva);
      if (siguiente.tipo !== tipo) throw errorPantallaPago(`${siguiente.texto}. Revisá el estado actualizado en Mis reservas.`);
      estadoDelPago.cotizacion = await consultarCotizacionPago();
      mostrarCotizacionPago();
      mostrarPasoPago(0, estadoDelPago.cotizacion.simulado ? 'Todo listo para probar el pago simulado.' : 'Todo listo para pagar con tu billetera.');
    }
  } catch (error) {
    document.body.hidden = false;
    elementoPago('error-pago').textContent = error.mensajeUsuario || PagosModelo.mensajeErrorPago(error);
    elementoPago('recargar-pago').hidden = false;
  } finally {
    estadoDelPago.ocupado = false;
    elementoPago('cargando-pago').hidden = true;
    actualizarBotonPago();
  }
}

window.addEventListener('pagehide', detenerConsultaPago);
elementoPago('boton-pagar').addEventListener('click', pagarReserva);
elementoPago('recargar-pago').addEventListener('click', cargarPaginaPago);
elementoPago('recuperar-transaccion').addEventListener('submit', recuperarTransaccionPago);
cargarPaginaPago();
