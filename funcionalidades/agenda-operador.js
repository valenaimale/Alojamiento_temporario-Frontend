// RF-10: agenda y registro de hechos. No contiene importes ni documentos de huéspedes.
const $agenda = id => document.getElementById(id);
const fechaMovimiento = new Intl.DateTimeFormat('es-AR', {timeZone:'America/Argentina/Buenos_Aires', dateStyle:'short', timeStyle:'short'});
let usuarioAgenda, almacenAgenda, enviandoAgenda = false, movimientoAbierto;
const dialogoMovimiento = $agenda('dialogo-movimiento');
function avisoAgenda(texto, error = false) {
  $agenda(error ? 'mensaje-error' : 'mensaje-ok').textContent = texto;
}
function elementoAgenda(tag, texto, clase = '') {
  const el = document.createElement(tag); el.textContent = texto; el.className = clase; return el;
}
function tarjetaDeMovimiento({tipo, reserva: r}) {
  const item = document.createElement('li'), tarjeta = elementoAgenda('article', '', 'tarjeta');
  const realizado = r.estadia?.[`${tipo}_en`];
  tarjeta.append(elementoAgenda('p', `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}${realizado ? ' registrado' : ''}`, `badge badge-${tipo}`), elementoAgenda('h3', r.huesped), elementoAgenda('p', r.unidad.nombre, 'unidad'), elementoAgenda('p', `${r.unidad.direccion}, ${r.unidad.localidad}`), elementoAgenda('p', `${r.personas} huéspedes · Del ${formatearFecha(r.ingreso)} al ${formatearFecha(r.egreso)}`, 'estadia'));
  if (realizado) {
    if (tipo === 'egreso') tarjeta.append(elementoAgenda('p', `Ingreso: ${fechaMovimiento.format(new Date(r.estadia.ingreso_en))}`, 'ayuda'));
    tarjeta.append(elementoAgenda('p', fechaMovimiento.format(new Date(realizado)), 'movimiento-hora'));
    for (const campo of ['estado', 'notas']) if (r.estadia[`${campo}_${tipo}`]) tarjeta.append(elementoAgenda('p', r.estadia[`${campo}_${tipo}`], 'movimiento-notas'));
  } else if (r.estado === 'pendiente') tarjeta.append(elementoAgenda('p', 'Pendiente de confirmación. Todavía no se puede registrar.', 'ayuda'));
  else if (r[`puede_registrar_${tipo}`]) {
    const boton = elementoAgenda('button', `Registrar ${tipo}`, 'boton boton-primario'); boton.type = 'button';
    boton.addEventListener('click', () => abrirMovimiento(r, tipo)); tarjeta.append(boton);
  } else tarjeta.append(elementoAgenda('p', tipo === 'ingreso' ? `Disponible desde el ${formatearFecha(r.ingreso)}.` : 'Primero debe registrarse el ingreso.', 'ayuda'));
  item.append(tarjeta); return item;
}
async function cargarAgenda() {
  const {respuesta, resultado} = await pedirAlBack('/operador/agenda');
  if (!respuesta.ok) throw new Error(resultado.error || 'No pudimos cargar la agenda.');
  const dias = new Map();
  for (const m of EstadiasModelo.movimientos(resultado.reservas)) {
    if (!dias.has(m.fecha)) dias.set(m.fecha, []); dias.get(m.fecha).push(m);
  }
  $agenda('dias').replaceChildren();
  for (const [fecha, movimientos] of dias) {
    const item = document.createElement('li');
    const titulo = new Intl.DateTimeFormat('es-AR', {timeZone:'America/Argentina/Buenos_Aires', weekday:'long', day:'numeric', month:'long'}).format(new Date(`${fecha}T12:00:00-03:00`));
    const lista = elementoAgenda('ul', '', 'movimientos'); lista.append(...movimientos.map(tarjetaDeMovimiento));
    item.append(elementoAgenda('h2', `${fecha === EstadiasModelo.dia() ? 'Hoy · ' : ''}${titulo}`), lista); $agenda('dias').append(item);
  }
  $agenda('agenda-vacia').hidden = dias.size > 0;
  $agenda('cargando').hidden = true; $agenda('reintentar-agenda').hidden = true;
}
function pendientesAgenda() {
  const lista = almacenAgenda.leer().pendientes;
  $agenda('pendientes-envio').hidden = !lista.length;
  $agenda('lista-pendientes').replaceChildren();
  for (const e of lista) {
    const item = elementoAgenda('li', `${e.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · ${e.alojamiento} · ${fechaMovimiento.format(new Date(e.ocurrido_en))}`);
    if (e.error) item.append(elementoAgenda('p', e.error, 'ayuda'));
    if (e.codigo === 'SALDO_PENDIENTE' && /^[1-9]\d*$/.test(String(e.reserva_id))) {
      item.append(elementoAgenda('p', 'El ingreso todavía no está registrado. El huésped debe pagar desde su cuenta. Después, usá Reintentar envío.', 'ayuda'));
      const enlace = new URL(`../reservas/pagar.html?reserva_id=${e.reserva_id}&tipo=saldo`, window.location.href).href;
      const campo = elementoAgenda('input', ''); campo.type = 'url'; campo.readOnly = true; campo.value = enlace;
      campo.setAttribute('aria-label', 'Enlace de pago para el huésped'); campo.className = 'enlace-pago-huesped';
      campo.addEventListener('click', () => campo.select());
      const copiar = elementoAgenda('button', 'Copiar enlace de pago', 'boton boton-secundario'); copiar.type = 'button';
      copiar.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(enlace); copiar.textContent = 'Enlace copiado'; }
        catch { campo.focus(); campo.select(); copiar.textContent = 'Seleccioná y copiá el enlace'; }
      });
      item.append(campo, copiar);
    }

    $agenda('lista-pendientes').append(item);
  }
}
function guardarBorrador() {
  if (!movimientoAbierto || !almacenAgenda) return;
  try {
    almacenAgenda.borrador(`${movimientoAbierto.reserva_id}.${movimientoAbierto.tipo}`, {estado_unidad:$agenda('estado-movimiento').value, notas:$agenda('notas-movimiento').value});
  } catch { $agenda('error-movimiento').textContent = 'No pudimos guardar el borrador en este dispositivo. Mantené esta ventana abierta.'; }
}
function abrirMovimiento(r, tipo) {
  try {
    const datos = almacenAgenda.leer();
    if (datos.pendientes.some(e => e.reserva_id === r.id && e.tipo === tipo)) { avisoAgenda('Este movimiento ya está guardado y pendiente de envío. Usá Reintentar envío.', true); return; }
    const borrador = datos.borradores[`${r.id}.${tipo}`] || {};
    movimientoAbierto = {reserva_id:r.id, tipo, alojamiento:r.unidad.nombre};
    $agenda('titulo-movimiento').textContent = `Registrar ${tipo}`;
    $agenda('contexto-movimiento').textContent = `${r.huesped} · ${r.unidad.nombre}`;
    $agenda('estado-movimiento').value = borrador.estado_unidad || ''; $agenda('notas-movimiento').value = borrador.notas || '';
    $agenda('confirmar-movimiento').textContent = `Registrar ${tipo}`; $agenda('error-movimiento').textContent = '';
    dialogoMovimiento.showModal();
  } catch { avisoAgenda('No pudimos abrir el almacenamiento local. Habilitá el almacenamiento del sitio y reintentá.', true); }
}
async function enviarPendientes(manual = false) {
  if (enviandoAgenda || !almacenAgenda) return;
  enviandoAgenda = true; $agenda('reintentar-envio').disabled = true;
  $agenda('mensaje-error').textContent = '';
  try {
    // Una pestaña vieja no puede enviar movimientos con la sesión de otra persona.
    const actual = await obtenerSesion();
    if (!actual || actual.id !== usuarioAgenda.id || actual.rol !== 'operador') throw new Error('Volvé a iniciar sesión con la misma cuenta para enviar tus movimientos.');
    for (const e of almacenAgenda.leer().pendientes) {
      if (e.error && !manual) continue;
      const {alojamiento, error, codigo, ...datos} = e;
      const respuesta = await fetch(URL_BACK + '/operador/estadias/registrar', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(datos)});
      const resultado = await respuesta.json();
      if (respuesta.ok) { almacenAgenda.quitar(e.evento_id); avisoAgenda(`${resultado.ok}.`); }
      else if (respuesta.status >= 500 || respuesta.status === 401) throw new Error(resultado.error || 'No pudimos enviar el movimiento. Reintentá en unos minutos.');
      else { almacenAgenda.error(e.evento_id, resultado.error || 'Revisá este movimiento con el responsable de la unidad.', resultado.codigo); avisoAgenda('Hay un movimiento que requiere revisión. Sus datos siguen guardados.', true); }
    }
    await cargarAgenda();
  } catch (error) {
    const mensaje = error instanceof TypeError ? 'No hay conexión con el servidor.' : error.message;
    avisoAgenda(`${mensaje || 'Sin conexión.'} Los movimientos pendientes siguen guardados en este dispositivo.`, true);
  }
  finally { enviandoAgenda = false; $agenda('reintentar-envio').disabled = false; pendientesAgenda(); }
}
$agenda('form-movimiento').addEventListener('input', guardarBorrador);
$agenda('cancelar-movimiento').addEventListener('click', () => dialogoMovimiento.close());
dialogoMovimiento.addEventListener('close', () => { movimientoAbierto = null; });
$agenda('form-movimiento').addEventListener('submit', async event => {
  event.preventDefault();
  if (!movimientoAbierto) return;
  try {
    const evento = {...movimientoAbierto, evento_id:crypto.randomUUID(), ocurrido_en:new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), estado_unidad:$agenda('estado-movimiento').value.trim(), notas:$agenda('notas-movimiento').value.trim()};
    almacenAgenda.agregar(evento); dialogoMovimiento.close(); pendientesAgenda();
    avisoAgenda('Movimiento guardado en este dispositivo. Enviando…'); await enviarPendientes();
  } catch { $agenda('error-movimiento').textContent = 'No pudimos guardar el movimiento. Revisá el almacenamiento del sitio y reintentá; tus notas siguen acá.'; }
});
$agenda('reintentar-envio').addEventListener('click', () => enviarPendientes(true));
$agenda('reintentar-agenda').addEventListener('click', cargarPaginaAgenda);
window.addEventListener('online', () => enviarPendientes());
window.addEventListener('storage', () => { if (almacenAgenda) pendientesAgenda(); });
async function cargarPaginaAgenda() {
  try {
    usuarioAgenda = await obtenerSesion();
    if (!usuarioAgenda || usuarioAgenda.rol !== 'operador') return;
    almacenAgenda = EstadiasModelo.almacen(localStorage, usuarioAgenda.id);
    pendientesAgenda(); await cargarAgenda();
    if (almacenAgenda.leer().pendientes.some(e => !e.error)) await enviarPendientes();
  } catch (error) { avisoAgenda(error.message || MENSAJE_SIN_CONEXION, true); $agenda('reintentar-agenda').hidden = false; }
  finally { $agenda('cargando').hidden = true; }
}
cargarPaginaAgenda();
