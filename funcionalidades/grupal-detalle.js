// El detalle de una reserva grupal (vistas/alojamientos/grupal.html, US4.4).
// Pide GET /grupal con la búsqueda de la URL, muestra cada unidad libre con una casilla para elegirla (todas elegidas
// al entrar) y, al reservar, manda POST /reservas/grupal/crear y lleva a pagar la seña del grupo.
// Las reglas de qué se puede elegir están en grupal-modelo.js (las mismas que controla el back).
// Lo que escribió un usuario (nombres, características) se inserta con textContent, nunca con innerHTML.

const ROLES_QUE_RESERVAN = ['huesped', 'propietario']; // el propietario también es huésped (como en el back)

const estado = {
  usuario: null,
  grupal: null,       // la respuesta de GET /grupal
  elegidas: [],       // ids de las unidades elegidas
  personas: 0,
  reservando: false,
};

// Los parámetros de la búsqueda que vinieron en la URL
function parametrosDeLaUrl() {
  const parametros = new URLSearchParams(window.location.search);
  return {
    id: parametros.get('id') ?? '',
    ingreso: parametros.get('ingreso') ?? '',
    egreso: parametros.get('egreso') ?? '',
    personas: parametros.get('personas') ?? '',
    localidad_id: parametros.get('localidad_id') ?? '',
  };
}

// Pide la grupal armada para esta búsqueda y dibuja la página (o por qué no se puede)
async function cargarGrupal() {
  const busqueda = parametrosDeLaUrl();
  const volver = new URLSearchParams({
    localidad_id: busqueda.localidad_id, ingreso: busqueda.ingreso, egreso: busqueda.egreso, personas: busqueda.personas,
  });
  document.getElementById('enlace-volver').href = `listado.html?${volver}`;

  let respuesta;
  let resultado;
  try {
    const parametros = new URLSearchParams({
      id: busqueda.id, ingreso: busqueda.ingreso, egreso: busqueda.egreso, personas: busqueda.personas,
    });
    ({ respuesta, resultado } = await pedirAlBack(`/grupal?${parametros}`));
  } catch (error) {
    console.error('No se pudo cargar la reserva grupal:', error);
    document.getElementById('mensaje-error').textContent = MENSAJE_SIN_CONEXION;
    return;
  } finally {
    document.getElementById('cargando').hidden = true;
  }
  if (!respuesta.ok) {
    document.getElementById('mensaje-error').textContent = respuesta.status === 409
      ? `${resultado.error}. Volvé a los resultados para ver lo que hay disponible.`
      : resultado.error;
    return;
  }

  estado.grupal = resultado.grupal;
  estado.personas = Number(busqueda.personas);
  estado.elegidas = estado.grupal.unidades.map(unidad => unidad.id);
  document.title = `${estado.grupal.titulo} · Reserva grupal`;
  document.getElementById('titulo').textContent = estado.grupal.titulo;
  document.getElementById('resumen-busqueda').textContent =
    `${estado.grupal.localidad}, ${estado.grupal.provincia} · del ${formatearFecha(busqueda.ingreso)} al ` +
    `${formatearFecha(busqueda.egreso)} · ${estado.grupal.noches} ${estado.grupal.noches === 1 ? 'noche' : 'noches'} · ` +
    `${estado.personas} ${estado.personas === 1 ? 'persona' : 'personas'}`;
  document.getElementById('unidades').replaceChildren(...estado.grupal.unidades.map(tarjetaDeUnidad));
  actualizarEleccion();
  mostrarParaReservar();
  document.getElementById('grupal').hidden = false;
}

// La tarjeta de una unidad del grupo, con su casilla para elegirla
function tarjetaDeUnidad(unidad) {
  const item = document.createElement('li');
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta unidad-grupal';
  tarjeta.setAttribute('data-testid', 'unidad-grupal');

  const elegir = document.createElement('label');
  elegir.className = 'elegir-unidad';
  const casilla = document.createElement('input');
  casilla.type = 'checkbox';
  casilla.checked = true;
  casilla.value = String(unidad.id);
  casilla.addEventListener('change', () => {
    estado.elegidas = [...document.querySelectorAll('.elegir-unidad input:checked')].map(c => Number(c.value));
    actualizarEleccion();
  });
  const nombre = document.createElement('strong');
  nombre.textContent = unidad.nombre;
  elegir.append(casilla, ' ', nombre);

  const fotos = document.createElement('div');
  fotos.className = 'fotos-unidad';
  for (const url of unidad.fotos.slice(0, 3)) {
    const foto = document.createElement('img');
    foto.src = fotoConAncho(url, 400);
    foto.alt = `Foto de ${unidad.nombre}`;
    foto.loading = 'lazy';
    fotos.append(foto);
  }

  const capacidad = document.createElement('p');
  capacidad.textContent = `Hasta ${unidad.capacidad} ${unidad.capacidad === 1 ? 'persona' : 'personas'}`;
  const caracteristicas = document.createElement('p');
  caracteristicas.className = 'ayuda';
  caracteristicas.textContent = unidad.caracteristicas ?? '';

  const datos = document.createElement('dl');
  const agregar = (termino, valor) => {
    const dt = document.createElement('dt');
    dt.textContent = termino;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    datos.append(dt, dd);
  };
  agregar('Precio de la estadía', formatearPrecio(unidad.estadia.precio_total));
  agregar(`Seña (${formatearPorcentaje(unidad.porcentaje_sena)})`, formatearPrecio(unidad.estadia.sena));
  agregar('Si cancelás con más de 30 días', `se retiene el ${formatearPorcentaje(unidad.politica.retencion_mas_de_30)} de la seña`);
  agregar('Entre 15 y 30 días', `se retiene el ${formatearPorcentaje(unidad.politica.retencion_de_15_a_30)} de la seña`);
  agregar('Con menos de 15 días', `se retiene el ${formatearPorcentaje(unidad.politica.retencion_menos_de_15)} de la seña`);
  if (unidad.deposito_garantia !== null && Number(unidad.deposito_garantia) > 0) {
    agregar('Depósito de garantía (se paga al llegar)', formatearPrecio(unidad.deposito_garantia));
  }

  tarjeta.append(elegir);
  if (fotos.children.length) tarjeta.append(fotos);
  tarjeta.append(capacidad, caracteristicas, datos);
  item.append(tarjeta);
  return item;
}

// Recalcula el total, la seña y si la elección se puede reservar
function actualizarEleccion() {
  const resultado = GrupalModelo.eleccion(estado.grupal.unidades, estado.elegidas, estado.personas);
  document.getElementById('total').textContent = formatearPrecio(resultado.total);
  document.getElementById('sena').textContent = formatearPrecio(resultado.sena);
  document.getElementById('eleccion').textContent = resultado.ok
    ? `${estado.elegidas.length} unidades elegidas, con lugar para ${resultado.capacidad} personas.`
    : resultado.mensaje;
  const boton = document.querySelector('#form-reservar button[type="submit"]');
  boton.disabled = !resultado.ok || estado.reservando;
}

// El formulario para reservar si esta cuenta puede, o por qué no puede (igual que el detalle de una unidad)
function mostrarParaReservar() {
  const aviso = document.getElementById('aviso-reservar');
  const { usuario } = estado;
  if (usuario !== null && ROLES_QUE_RESERVAN.includes(usuario.rol) && usuario.mail_verificado && usuario.dni) {
    document.getElementById('form-reservar').hidden = false;
    return;
  }
  aviso.replaceChildren();
  if (usuario === null) {
    const enlace = document.createElement('a');
    enlace.href = urlParaIniciarSesionYVolver(); // unidades-comun.js: vuelve a esta grupal con la misma búsqueda
    enlace.textContent = 'Iniciá sesión';
    aviso.append(enlace, ' para reservar. Si todavía no tenés cuenta, registrate: es gratis.');
  } else if (!ROLES_QUE_RESERVAN.includes(usuario.rol)) {
    aviso.textContent = 'Las reservas se hacen con una cuenta de huésped.';
  } else if (!usuario.mail_verificado) {
    aviso.textContent = 'Para reservar tenés que verificar tu mail: entrá al enlace del mail que te mandamos al registrarte.';
  } else {
    const enlace = document.createElement('a');
    enlace.href = `../sesion/completar-datos.html?volver=${encodeURIComponent(`../alojamientos/grupal.html${window.location.search}`)}`;
    enlace.textContent = 'Completá tu DNI';
    aviso.append(enlace, ' para reservar.');
  }
  aviso.hidden = false;
}

// Reserva las unidades elegidas y lleva a pagar la seña del grupo. Si alguna se ocupó mientras tanto, lo dice.
async function reservar(evento) {
  evento.preventDefault();
  if (estado.reservando) return;
  const formulario = evento.target;
  const error = document.getElementById('error-reserva');
  error.textContent = '';
  if (!GrupalModelo.eleccion(estado.grupal.unidades, estado.elegidas, estado.personas).ok) return;
  if (!formulario.elements.acepta_politica.checked) {
    error.textContent = 'Leé y aceptá la política de cancelación de cada unidad para continuar.';
    return;
  }

  const busqueda = parametrosDeLaUrl();
  const boton = formulario.querySelector('button[type="submit"]');
  estado.reservando = true;
  boton.disabled = true; // evita reservar dos veces con un doble clic
  let respuesta;
  let resultado;
  try {
    ({ respuesta, resultado } = await pedirAlBack('/reservas/grupal/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupal_id: estado.grupal.id, ingreso: busqueda.ingreso, egreso: busqueda.egreso, personas: estado.personas,
        unidad_ids: estado.elegidas, acepta_politica: true,
      }),
    }));
  } catch (fallo) {
    console.error('No se pudo reservar la grupal:', fallo);
    error.textContent = MENSAJE_SIN_CONEXION;
    estado.reservando = false;
    actualizarEleccion();
    return;
  }

  if (respuesta.ok && /^[1-9]\d*$/.test(String(resultado.grupo?.id))) {
    window.location.href = `../reservas/pagar.html?grupo_id=${encodeURIComponent(resultado.grupo.id)}&tipo=sena`;
    return;
  }
  estado.reservando = false;
  error.textContent = resultado.error;
  actualizarEleccion();
}

// Arma el encabezado (con o sin sesión) y carga la grupal
async function iniciar() {
  estado.usuario = await armarEncabezadoPublico(); // unidades-comun.js; null sin sesión
  document.getElementById('form-reservar').addEventListener('submit', reservar);
  await cargarGrupal();
}

iniciar();
