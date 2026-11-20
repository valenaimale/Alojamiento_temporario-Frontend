// Las reservas grupales del administrador (vistas/administrador/grupales.html, US4.4).
// Lista sus grupales (GET /administrador/grupales), las crea y las edita (POST /administrador/grupales/crear y
// /editar) con unidades que administra (GET /administrador/unidades), y las activa o desactiva (/estado).
// Las reglas (2 a 10 unidades, que administre, de la misma localidad) las controla el back; acá se ayuda a elegir.
// La sesión y el rol los controla proteger-pagina.js. Lo que escribió un usuario se inserta con textContent.

const formulario = document.getElementById('form-grupal');
let grupales = [];     // lo último que devolvió el back
let ocupado = false;   // un pedido en curso: los botones esperan

// Pide al back un POST con JSON. Devuelve { respuesta, resultado } (como pedirAlBack)
function enviar(ruta, datos) {
  return pedirAlBack(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
}

// Muestra el resultado de guardar o activar
function avisar(texto) {
  document.getElementById('mensaje-accion').textContent = texto;
}

// Las unidades que administra, como casillas para elegir, agrupadas por localidad (una grupal es de una sola)
async function cargarUnidades() {
  const { respuesta, resultado } = await pedirAlBack('/administrador/unidades');
  document.getElementById('cargando-unidades').hidden = true;
  if (!respuesta.ok) return;
  const opciones = document.getElementById('opciones-unidades');
  const ordenadas = [...resultado.unidades].sort((a, b) => `${a.localidad}${a.nombre}`.localeCompare(`${b.localidad}${b.nombre}`));
  opciones.replaceChildren(...ordenadas.map(unidad => {
    const item = document.createElement('li');
    const etiqueta = document.createElement('label');
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.name = 'unidad';
    casilla.value = String(unidad.id);
    const nombre = document.createElement('strong');
    nombre.textContent = unidad.nombre;
    const detalle = document.createElement('span');
    detalle.className = 'ayuda';
    detalle.textContent = ` · ${unidad.localidad} · de ${unidad.propietario}${unidad.estado_publicacion === 'publicada' ? '' : ' · sin publicar'}`;
    etiqueta.append(casilla, ' ', nombre, detalle);
    item.append(etiqueta);
    return item;
  }));
  if (!ordenadas.length) {
    document.getElementById('cargando-unidades').hidden = false;
    document.getElementById('cargando-unidades').textContent = 'Todavía no administrás unidades.';
  }
}

// Trae las grupales y las dibuja
async function cargarGrupales() {
  const mensaje = document.getElementById('mensaje-lista');
  let respuesta;
  let resultado;
  try {
    ({ respuesta, resultado } = await pedirAlBack('/administrador/grupales'));
  } catch (error) {
    console.error('No se pudieron cargar las reservas grupales:', error);
    mensaje.textContent = MENSAJE_SIN_CONEXION;
    return;
  }
  if (!respuesta.ok) return; // 401 o 403: proteger-pagina.js ya está redirigiendo
  grupales = resultado.grupales;
  mensaje.textContent = grupales.length ? '' : 'Todavía no armaste ninguna reserva grupal.';
  mensaje.hidden = grupales.length > 0;
  document.getElementById('lista-grupales').replaceChildren(...grupales.map(tarjetaDeGrupal));
}

// La tarjeta de una grupal: título, estado, capacidad, sus unidades y los botones para editarla y activarla
function tarjetaDeGrupal(grupal) {
  const item = document.createElement('li');
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta grupal-administrador';
  tarjeta.setAttribute('data-testid', 'grupal-administrador');

  const encabezado = document.createElement('header');
  const titulo = document.createElement('h3');
  titulo.textContent = grupal.titulo;
  const estado = document.createElement('span');
  estado.className = `estado ${grupal.activa && !grupal.incompleta ? 'estado-publicada' : 'estado-no-publicada'}`;
  estado.textContent = !grupal.activa ? 'Desactivada' : grupal.incompleta ? 'Incompleta' : 'Activa';
  encabezado.append(titulo, estado);

  const lugar = document.createElement('p');
  lugar.className = 'ayuda';
  lugar.textContent = `${grupal.localidad}, ${grupal.provincia} · hasta ${grupal.capacidad} personas`;

  const unidades = document.createElement('ul');
  unidades.className = 'unidades-de-grupal';
  for (const unidad of grupal.unidades) {
    const linea = document.createElement('li');
    linea.textContent = `${unidad.nombre} (${unidad.capacidad} personas, de ${unidad.propietario})`;
    if (!unidad.vigente) {
      linea.className = 'no-vigente';
      linea.append(' · ya no la administrás: no cuenta para el grupo');
    }
    unidades.append(linea);
  }

  const acciones = document.createElement('div');
  acciones.className = 'acciones-formulario';
  const editar = document.createElement('button');
  editar.type = 'button';
  editar.className = 'boton boton-outline';
  editar.textContent = 'Editar';
  editar.setAttribute('aria-label', `Editar ${grupal.titulo}`);
  editar.addEventListener('click', () => empezarEdicion(grupal));
  const activar = document.createElement('button');
  activar.type = 'button';
  activar.className = 'boton';
  activar.textContent = grupal.activa ? 'Desactivar' : 'Activar';
  activar.setAttribute('aria-label', `${activar.textContent} ${grupal.titulo}`);
  activar.addEventListener('click', () => cambiarEstado(grupal));
  acciones.append(editar, activar);

  tarjeta.append(encabezado, lugar, unidades);
  if (grupal.incompleta) {
    const aviso = document.createElement('p');
    aviso.className = 'mensaje-error';
    aviso.textContent = 'Tiene menos de 2 unidades que administrás: no aparece en la búsqueda hasta que le sumes otra.';
    tarjeta.append(aviso);
  }
  tarjeta.append(acciones);
  item.append(tarjeta);
  return item;
}

// Carga una grupal en el formulario para editarla
function empezarEdicion(grupal) {
  formulario.elements.id.value = String(grupal.id);
  formulario.elements.titulo.value = grupal.titulo;
  const elegidas = grupal.unidades.filter(u => u.vigente).map(u => String(u.id));
  formulario.querySelectorAll('input[name="unidad"]').forEach(casilla => { casilla.checked = elegidas.includes(casilla.value); });
  document.getElementById('titulo-formulario').textContent = `Editar "${grupal.titulo}"`;
  document.getElementById('boton-guardar').textContent = 'Guardar cambios';
  document.getElementById('boton-cancelar-edicion').hidden = false;
  formulario.elements.titulo.focus();
}

// Deja el formulario listo para una grupal nueva
function terminarEdicion() {
  formulario.reset();
  formulario.elements.id.value = '';
  document.getElementById('titulo-formulario').textContent = 'Nueva reserva grupal';
  document.getElementById('boton-guardar').textContent = 'Crear reserva grupal';
  document.getElementById('boton-cancelar-edicion').hidden = true;
  document.getElementById('error-formulario').textContent = '';
}

// Crea o edita la grupal del formulario
async function guardar(evento) {
  evento.preventDefault();
  if (ocupado) return;
  const error = document.getElementById('error-formulario');
  error.textContent = '';
  const id = formulario.elements.id.value;
  const datos = {
    titulo: formulario.elements.titulo.value,
    unidad_ids: [...formulario.querySelectorAll('input[name="unidad"]:checked')].map(c => Number(c.value)),
  };
  ocupado = true;
  const boton = document.getElementById('boton-guardar');
  boton.disabled = true;
  try {
    const { respuesta, resultado } = await enviar(id ? '/administrador/grupales/editar' : '/administrador/grupales/crear',
      id ? { id: Number(id), ...datos } : datos);
    if (!respuesta.ok) {
      error.textContent = resultado.error;
      return;
    }
    avisar(resultado.ok);
    terminarEdicion();
    await cargarGrupales();
  } catch (fallo) {
    console.error('No se pudo guardar la reserva grupal:', fallo);
    error.textContent = MENSAJE_SIN_CONEXION;
  } finally {
    ocupado = false;
    boton.disabled = false;
  }
}

// Activa o desactiva una grupal
async function cambiarEstado(grupal) {
  if (ocupado) return;
  ocupado = true;
  try {
    const { respuesta, resultado } = await enviar('/administrador/grupales/estado', { id: grupal.id, activa: !grupal.activa });
    avisar(respuesta.ok ? resultado.ok : resultado.error);
    if (respuesta.ok) await cargarGrupales();
  } catch (fallo) {
    console.error('No se pudo cambiar el estado de la reserva grupal:', fallo);
    avisar(MENSAJE_SIN_CONEXION);
  } finally {
    ocupado = false;
  }
}

formulario.addEventListener('submit', guardar);
document.getElementById('boton-cancelar-edicion').addEventListener('click', terminarEdicion);
cargarUnidades().catch(error => console.error('No se pudieron cargar las unidades:', error));
cargarGrupales();
