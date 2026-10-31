// RF-20. Datos personales solo en memoria y en la API; nunca en localStorage.
const $libro = id => document.getElementById(id);
const parametrosLibro = new URLSearchParams(location.search);
const idReservaLibro = parametrosLibro.get('reserva_id');
const idUnidadLibro = parametrosLibro.get('unidad_id');
let reservaLibro, cambiosLibro = false, guardandoLibro = false, indicePeticionLibro = 0;
const camposLibro = [
  ['nombre', 'Nombre completo', 'text', 120],
  ['tipo_documento', 'Tipo de documento', 'select', 20],
  ['documento', 'Número de documento', 'text', 30],
  ['nacionalidad', 'Nacionalidad', 'text', 80],
  ['fecha_nacimiento', 'Fecha de nacimiento', 'date', 10],
  ['domicilio', 'Domicilio', 'text', 250],
];
function nodoLibro(tag, texto, clase = '') { const n = document.createElement(tag); n.textContent = texto; n.className = clase; return n; }
function errorLibro(texto) { $libro('error-libro').textContent = texto; $libro('ok-libro').textContent = ''; }
function filasLibro() {
  return [...$libro('personas-libro').querySelectorAll('fieldset')].map(f => Object.fromEntries(camposLibro.map(([campo]) => [campo, f.querySelector(`[name="${campo}"]`).value.trim()])));
}
function numerarLibro() {
  const filas = $libro('personas-libro').querySelectorAll('fieldset');
  filas.forEach((f, i) => { f.querySelector('legend').textContent = i === 0 ? 'Titular de la reserva' : `Acompañante ${i}`; });
  $libro('agregar-huesped').hidden = filas.length >= reservaLibro.personas;
}
let secuenciaPersonaLibro = 0;
function agregarPersonaLibro(datos = {}, titular = false) {
  const numero = ++secuenciaPersonaLibro, f = nodoLibro('fieldset', '', 'persona-libro');
  const leyenda = document.createElement('legend'), grilla = nodoLibro('div', '', 'campos-libro'); f.append(leyenda, grilla);
  for (const [campo, etiqueta, tipo, max] of camposLibro) {
    const grupo = nodoLibro('div', '', `campo-libro${['nombre','domicilio'].includes(campo) ? ' ancho' : ''}`);
    const label = nodoLibro('label', etiqueta); label.htmlFor = `persona-${numero}-${campo}`;
    const input = document.createElement(tipo === 'select' ? 'select' : 'input');
    input.id = label.htmlFor; input.name = campo; input.required = true;
    if (tipo === 'select') for (const valor of ['DNI','Pasaporte','Otro']) { const op = nodoLibro('option', valor); op.value = valor; input.append(op); }
    else { input.type = tipo; input.maxLength = max; input.autocomplete = 'off'; }
    if (tipo === 'date') { input.min = '1900-01-01'; input.max = EstadiasModelo.dia(); }
    input.value = datos[campo] || (campo === 'tipo_documento' ? 'DNI' : '');
    grupo.append(label, input); grilla.append(grupo);
  }
  if (!titular) {
    const quitar = nodoLibro('button', 'Quitar acompañante', 'boton-texto quitar-huesped'); quitar.type = 'button';
    quitar.addEventListener('click', async () => {
      if (await confirmar({titulo:'¿Quitar este acompañante?', detalle:'El cambio se aplica al guardar los huéspedes.', textoConfirmar:'Quitar', textoCancelar:'Volver'})) { f.remove(); cambiosLibro = true; numerarLibro(); $libro('ok-libro').textContent = ''; $libro('agregar-huesped').focus(); }
    }); f.append(quitar);
  }
  $libro('personas-libro').append(f); numerarLibro(); return f;
}
function personaLecturaLibro(datos, indice) {
  const seccion = nodoLibro('section', '', 'persona-lectura'), dl = document.createElement('dl');
  seccion.append(nodoLibro('h2', indice === 0 ? 'Titular de la reserva' : `Acompañante ${indice}`));
  for (const [campo, label] of camposLibro) { const grupo = document.createElement('div'); grupo.append(nodoLibro('dt', label), nodoLibro('dd', campo === 'fecha_nacimiento' ? formatearFecha(datos[campo]) : datos[campo])); dl.append(grupo); }
  seccion.append(dl); return seccion;
}
function progresoLibro(cantidad, completo) {
  $libro('progreso-libro').textContent = `${cantidad} de ${reservaLibro.personas} huéspedes guardados${completo ? ' · Completo' : ' · Faltan datos'}`;
  $libro('exportar-libro').hidden = !cantidad;
}
async function cargarDetalleLibro() {
  const {respuesta, resultado} = await pedirAlBack(`/reservas/huespedes?reserva_id=${encodeURIComponent(idReservaLibro)}`);
  if (!respuesta.ok) throw new Error(resultado.error || 'No pudimos cargar los huéspedes.');
  reservaLibro = resultado.reserva; cambiosLibro = false;
  const r = reservaLibro;
  $libro('titulo-libro').textContent = r.es_titular ? 'Datos de huéspedes' : 'Libro de huéspedes';
  $libro('contexto-libro').textContent = `${r.alojamiento} · ${formatearFecha(r.ingreso)} al ${formatearFecha(r.egreso)} · ${r.personas} huéspedes`;
  if (!r.es_titular) { $libro('volver-libro').href = `libro-huespedes.html?unidad_id=${r.unidad_id}&mes=${r.ingreso.slice(0,7)}`; $libro('volver-libro').textContent = '← Libro del alojamiento'; }
  $libro('ayuda-libro').textContent = r.puede_editar ? 'Completá los datos de cada persona que se aloja. Podés guardar el titular y agregar acompañantes después, hasta el día anterior al ingreso.' : (r.es_titular ? 'El libro está disponible para consulta. Los datos se pueden modificar hasta el día anterior al ingreso, en reservas pendientes o confirmadas.' : 'Consulta del titular y sus acompañantes. Los datos los completa el titular de la reserva.');
  $libro('exportar-libro').href = `${URL_BACK}/reservas/huespedes/exportar?reserva_id=${r.id}`;
  $libro('personas-libro').replaceChildren();
  if (r.puede_editar) {
    const filas = resultado.huespedes.length ? resultado.huespedes : [{nombre:r.titular.nombre, tipo_documento:'DNI', documento:r.titular.dni || ''}];
    filas.forEach((d, i) => agregarPersonaLibro(d, i === 0));
  } else if (resultado.huespedes.length) $libro('personas-libro').append(...resultado.huespedes.map(personaLecturaLibro));
  else $libro('personas-libro').append(nodoLibro('p', 'Todavía no se cargaron huéspedes para esta reserva.'));
  progresoLibro(resultado.huespedes.length, r.completo);
  $libro('acciones-libro').hidden = !r.puede_editar; $libro('detalle-libro').hidden = false;
}
async function cargarIndiceLibro() {
  const peticion = ++indicePeticionLibro;
  const mes = $libro('mes-libro').value;
  if (!/^\d{4}-\d{2}$/.test(mes)) { errorLibro('Elegí un mes válido.'); return; }
  $libro('reservas-libro').replaceChildren(nodoLibro('li', 'Cargando reservas…'));
  try {
    const {respuesta, resultado} = await pedirAlBack(`/unidades/libro?unidad_id=${encodeURIComponent(idUnidadLibro)}&mes=${encodeURIComponent(mes)}`);
    if (peticion !== indicePeticionLibro) return;
    if (!respuesta.ok) throw new Error(resultado.error || 'No pudimos cargar el libro.');
    $libro('contexto-libro').textContent = resultado.unidad.nombre;
    $libro('reservas-libro').replaceChildren();
    for (const r of resultado.reservas) {
      const item = document.createElement('li'), enlace = nodoLibro('a', 'Ver huéspedes'); enlace.href = `libro-huespedes.html?reserva_id=${r.id}`;
      item.append(nodoLibro('h3', r.titular), nodoLibro('p', `${formatearFecha(r.ingreso)} al ${formatearFecha(r.egreso)} · ${r.estado}`), nodoLibro('p', `${r.cargados} de ${r.personas} huéspedes guardados`, 'ayuda'), enlace); $libro('reservas-libro').append(item);
    }
    if (!resultado.reservas.length) $libro('reservas-libro').append(nodoLibro('li', 'No hay reservas para este mes.'));
    $libro('error-libro').textContent = '';
  } catch (error) { if (peticion === indicePeticionLibro) { $libro('reservas-libro').replaceChildren(); errorLibro(error.message); $libro('recargar-libro').hidden = false; } }
}
$libro('agregar-huesped').addEventListener('click', () => {
  if (filasLibro().length >= reservaLibro.personas) return;
  const f = agregarPersonaLibro(); cambiosLibro = true; f.querySelector('input').focus();
  $libro('ok-libro').textContent = '';
});
$libro('form-libro').addEventListener('input', () => { cambiosLibro = true; $libro('ok-libro').textContent = ''; });
$libro('form-libro').addEventListener('submit', async event => {
  event.preventDefault(); if (guardandoLibro || !reservaLibro?.puede_editar) return;
  const filas = filasLibro(); guardandoLibro = true;
  const controles = [...$libro('form-libro').querySelectorAll('input,select,button')]; controles.forEach(c => { c.disabled = true; });
  $libro('guardar-libro').textContent = 'Guardando…'; $libro('error-libro').textContent = '';
  try {
    const {respuesta, resultado} = await pedirAlBack('/reservas/huespedes', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reserva_id:reservaLibro.id, version:reservaLibro.version, huespedes:filas})});
    if (!respuesta.ok) { if (respuesta.status === 409) $libro('recargar-libro').hidden = false; throw new Error(resultado.error || 'No pudimos guardar. Tus datos siguen en el formulario.'); }
    reservaLibro.version = resultado.version; cambiosLibro = false; progresoLibro(filas.length, resultado.completo);
    $libro('ok-libro').textContent = resultado.completo ? 'Listo. Guardamos los datos de todos los huéspedes.' : 'Datos guardados. Podés agregar los acompañantes que faltan más adelante.';
    $libro('recargar-libro').hidden = true;
  } catch (error) { errorLibro((error instanceof TypeError ? MENSAJE_SIN_CONEXION : error.message) + ' Tus datos siguen en el formulario.'); }
  finally { guardandoLibro = false; controles.forEach(c => { c.disabled = false; }); $libro('guardar-libro').textContent = 'Guardar huéspedes'; }
});
$libro('mes-libro').addEventListener('change', cargarIndiceLibro);
$libro('recargar-libro').addEventListener('click', async () => {
  if (cambiosLibro && !await confirmar({titulo:'¿Cargar la versión guardada?',detalle:'Se perderán los cambios de este formulario que todavía no guardaste.',textoConfirmar:'Cargar versión guardada',textoCancelar:'Seguir editando'})) return;
  await iniciarLibro();
});
window.addEventListener('beforeunload', event => { if (cambiosLibro || guardandoLibro) { event.preventDefault(); event.returnValue = ''; } });
async function iniciarLibro() {
  $libro('recargar-libro').hidden = true; $libro('cargando-libro').hidden = false;
  try {
    const u = await obtenerSesion();
    if (!u) { location.href = '../sesion/inicio-sesion.html'; return; }
    armarMenu(u.rol); document.body.hidden = false;
    if (!['huesped','propietario','administrador'].includes(u.rol)) throw new Error('Tu cuenta no tiene permiso para consultar este libro.');
    $libro('error-libro').textContent = '';
    if (idReservaLibro) await cargarDetalleLibro();
    else if (idUnidadLibro) {
      $libro('titulo-libro').textContent = 'Libro de huéspedes';
      $libro('volver-libro').textContent = '← Calendario del alojamiento'; $libro('volver-libro').href = `../unidades/temporadas-unidad.html?id=${encodeURIComponent(idUnidadLibro)}`;
      $libro('mes-libro').value ||= parametrosLibro.get('mes') || EstadiasModelo.dia().slice(0,7);
      $libro('indice-libro').hidden = false; await cargarIndiceLibro();
    } else throw new Error('Elegí una reserva desde Mis reservas o un alojamiento desde tu calendario.');
  } catch (error) { document.body.hidden = false; errorLibro(error.message || MENSAJE_SIN_CONEXION); $libro('recargar-libro').hidden = false; }
  finally { $libro('cargando-libro').hidden = true; }
}
iniciarLibro();
