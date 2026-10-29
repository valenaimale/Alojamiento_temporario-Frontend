// Publicación y fechas bloqueadas de una unidad (vistas/unidades/disponibilidad-unidad.html?id=5), US3.1 y US3.3.
// - Publicación: el estado, lo que le falta, y los botones Publicar o Pausar (POST /unidades/publicar y /pausar).
//   Solo para el propietario: al administrador se le quita la sección.
// - Fechas bloqueadas: la lista (GET /unidades/bloqueos), bloquear (POST .../crear) y liberar (POST .../liberar).
//   Para el propietario y el administrador asignado. El backend responde 404 a cualquier otro.

// Cómo se muestra cada motivo de bloqueo (los mismos textos que las opciones del formulario)
const MOTIVOS_DE_BLOQUEO = {
    reserva_externa: 'Reserva por otro medio',
    mantenimiento: 'Mantenimiento o arreglos',
    danio: 'Daños en la unidad',
    uso_personal: 'No quiero recibir reservas en esas fechas',
    otro: 'Otro motivo',
};
// Qué significa cada estado de publicación, para el propietario
const EXPLICACION_DE_ESTADO = {
    borrador: 'Todavía no la publicaste: no aparece en la búsqueda.',
    publicada: 'Aparece en la búsqueda y se puede reservar.',
    pausada: 'La pausaste: no aparece en la búsqueda, pero las reservas que ya tiene siguen en pie.',
};

const formBloqueo = document.getElementById('form-bloqueo');
let idUnidad = null;

// ---------- utilidades ----------

// La fecha de hoy como "AAAA-MM-DD", con la fecha local (la del usuario, en Argentina)
function hoyATexto() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

// Muestra un error en lugar de la página (sin conexión, unidad inexistente o ajena)
function mostrarErrorPagina(texto) {
    document.getElementById('mensaje-error').textContent = texto;
    document.body.hidden = false;
}

// Manda un POST con JSON al backend. Devuelve { respuesta, resultado }, o null si el backend no respondió
// (en ese caso ya mostró el aviso en el elemento de error que se le pasa).
async function enviar(ruta, datos, elementoError) {
    try {
        return await pedirAlBack(ruta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unidad_id: idUnidad, ...datos }),
        });
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        elementoError.textContent = MENSAJE_SIN_CONEXION;
        return null;
    }
}

// Borra los mensajes de error y de éxito indicados
function limpiarMensajes(...ids) {
    for (const id of ids) {
        document.getElementById(id).textContent = '';
    }
}

// ---------- publicación ----------

// Muestra el estado de la unidad, lo que le falta para publicarse y el botón que corresponde (Publicar o Pausar)
function mostrarPublicacion(unidad) {
    document.getElementById('estado-unidad').textContent = NOMBRES_DE_ESTADO[unidad.estado_publicacion] ?? unidad.estado_publicacion;
    document.getElementById('explicacion-estado').textContent = EXPLICACION_DE_ESTADO[unidad.estado_publicacion] ?? '';

    const aviso = document.getElementById('no-disponible');
    aviso.hidden = unidad.disponible;
    if (!unidad.disponible) {   // fuera de servicio por un daño (Épica 8)
        aviso.textContent = `No disponible: ${unidad.motivo_no_disponible ?? 'fuera de servicio'}. Mientras tanto no se puede publicar.`;
    }

    mostrarFaltantes(unidad.estado_publicacion === 'publicada' ? [] : unidad.faltantes);
    document.getElementById('publicar').hidden = unidad.estado_publicacion === 'publicada';
    document.getElementById('pausar').hidden = unidad.estado_publicacion !== 'publicada';
}

// Muestra la lista de lo que le falta para publicarse (u oculta la sección si no falta nada)
function mostrarFaltantes(faltantes) {
    const lista = document.getElementById('lista-faltantes');
    lista.replaceChildren();
    for (const faltante of faltantes) {
        const item = document.createElement('li');
        item.textContent = faltante;
        lista.appendChild(item);
    }
    document.getElementById('faltantes').hidden = faltantes.length === 0;
}

// Publica o pausa la unidad (accion: 'publicar' o 'pausar') y muestra cómo quedó
async function cambiarPublicacion(accion) {
    if (accion === 'pausar' && !await confirmar({
        titulo: '¿Pausar la publicación?',
        detalle: 'La unidad deja de aparecer en la búsqueda. Las reservas que ya tiene siguen en pie.',
        textoConfirmar: 'Pausar',
    })) {
        return;
    }
    limpiarMensajes('error-publicacion', 'ok-publicacion');
    const errorPublicacion = document.getElementById('error-publicacion');

    const envio = await enviar(`/unidades/${accion}`, {}, errorPublicacion);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        errorPublicacion.textContent = envio.resultado.error;
        if (envio.resultado.faltantes) {   // 422: le falta algo para publicarse
            mostrarFaltantes(envio.resultado.faltantes);
        }
        return;
    }

    // vuelve a pedir el resumen, así el estado y lo que falta quedan como en el backend
    try {
        const { resultado } = await obtenerResumenUnidad(idUnidad);
        mostrarPublicacion(resultado.unidad);
    } catch (error) {
        console.error('No se pudo actualizar el estado:', error);
    }
    document.getElementById('ok-publicacion').textContent = envio.resultado.ok;
    // el botón que se tocó se ocultó: el foco pasa al que lo reemplaza
    document.getElementById(accion === 'publicar' ? 'pausar' : 'publicar').focus();
}

// ---------- fechas bloqueadas ----------

// Pide los bloqueos al backend y los dibuja. Lanza el error si el backend no responde.
async function cargarBloqueos() {
    const { respuesta, resultado } = await pedirAlBack(`/unidades/bloqueos?id=${encodeURIComponent(idUnidad)}`);
    if (!respuesta.ok) {
        throw new Error(resultado.error);
    }
    dibujarBloqueos(resultado.bloqueos);
}

// Dibuja la lista de bloqueos: las fechas, el motivo con su detalle, quién lo cargó y el botón Liberar
function dibujarBloqueos(bloqueos) {
    const lista = document.getElementById('lista-bloqueos');
    lista.replaceChildren();
    document.getElementById('sin-bloqueos').hidden = bloqueos.length > 0;
    const hoy = hoyATexto();

    for (const bloqueo of bloqueos) {
        const enCurso = bloqueo.fecha_desde < hoy;   // AAAA-MM-DD se compara como texto
        const rango = `del ${formatearFecha(bloqueo.fecha_desde)} al ${formatearFecha(bloqueo.fecha_hasta)}`;
        const item = document.createElement('li');

        const titulo = document.createElement('h3');
        titulo.textContent = `Noches ${rango}${enCurso ? ' (en curso)' : ''}`;
        const motivo = document.createElement('p');
        motivo.textContent = MOTIVOS_DE_BLOQUEO[bloqueo.motivo] ?? bloqueo.motivo;
        if (bloqueo.detalle !== null) {
            motivo.textContent += `: ${bloqueo.detalle}`;
        }
        const autor = document.createElement('p');
        autor.className = 'autor';
        autor.textContent = `Lo bloqueó ${bloqueo.creado_por}`;

        const liberar = document.createElement('button');
        liberar.type = 'button';
        liberar.className = 'boton boton-outline';
        liberar.textContent = 'Liberar';
        liberar.setAttribute('aria-label', `Liberar las noches ${rango}`);   // empieza con el texto visible
        liberar.addEventListener('click', () => liberarBloqueo(bloqueo, rango, enCurso));

        item.append(titulo, motivo, autor, liberar);
        lista.appendChild(item);
    }
}

// El detalle es obligatorio solo con el motivo "otro": cambia el texto del campo y su atributo required
function actualizarDetalle() {
    const esOtro = formBloqueo.elements.motivo.value === 'otro';
    formBloqueo.elements.detalle.required = esOtro;
    document.getElementById('texto-detalle').textContent = esOtro ? 'Contanos el motivo (obligatorio)' : 'Detalle (opcional)';
}

// Bloquea el rango del formulario
async function bloquear(evento) {
    evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros
    limpiarMensajes('error-bloqueo', 'ok-bloqueo');
    const errorBloqueo = document.getElementById('error-bloqueo');

    const datos = Object.fromEntries(new FormData(formBloqueo));   // {fecha_desde, fecha_hasta, motivo, detalle}
    const envio = await enviar('/unidades/bloqueos/crear', datos, errorBloqueo);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        errorBloqueo.textContent = envio.resultado.error;
        return;
    }

    formBloqueo.reset();
    actualizarDetalle();
    document.getElementById('ok-bloqueo').textContent = envio.resultado.ok;
    await recargarBloqueos(errorBloqueo);
}

// Libera un bloqueo, después de confirmarlo. Si está en curso, se liberan las noches de hoy en adelante.
async function liberarBloqueo(bloqueo, rango, enCurso) {
    const detalle = enCurso
        ? 'Se liberan de hoy en adelante: las que ya pasaron quedan como estaban.'
        : 'Se van a poder reservar.';
    if (!await confirmar({ titulo: `¿Liberar las noches ${rango}?`, detalle, textoConfirmar: 'Liberar' })) {
        return;
    }
    limpiarMensajes('error-bloqueo', 'ok-bloqueo');
    const errorBloqueo = document.getElementById('error-bloqueo');

    const envio = await enviar('/unidades/bloqueos/liberar', { bloqueo_id: bloqueo.id }, errorBloqueo);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        errorBloqueo.textContent = envio.resultado.error;
        return;
    }

    document.getElementById('ok-bloqueo').textContent = envio.resultado.ok;
    await recargarBloqueos(errorBloqueo);
    document.getElementById('titulo-bloqueos').focus();   // el botón que tenía el foco ya no existe
}

// Vuelve a pedir los bloqueos después de un cambio. Si el backend no responde, lo dice en ese elemento.
async function recargarBloqueos(elementoError) {
    try {
        await cargarBloqueos();
    } catch (error) {
        console.error('No se pudieron recargar los bloqueos:', error);
        elementoError.textContent = MENSAJE_SIN_CONEXION;
    }
}

// ---------- arranque ----------

// Arma la página: controla la sesión, arma el menú, pide el resumen de la unidad y sus bloqueos
async function cargarPagina() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {
        mostrarPantallaSinConexion(error);
        return;
    }
    if (usuario === null) {   // sin sesión: al login
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    armarMenu(usuario.rol);

    idUnidad = idUnidadDeLaUrl();
    if (idUnidad === null) {
        mostrarErrorPagina('No encontramos esa unidad.');
        return;
    }
    document.getElementById('enlace-volver').href = `configurar-unidad.html?id=${idUnidad}`;

    let unidad;
    try {
        const { respuesta, resultado } = await obtenerResumenUnidad(idUnidad);
        if (!respuesta.ok) {   // 404: no existe o no es suya
            mostrarErrorPagina(resultado.error);
            return;
        }
        unidad = resultado.unidad;
        await cargarBloqueos();
    } catch (error) {
        console.error('No se pudo cargar la página:', error);
        mostrarErrorPagina(MENSAJE_SIN_CONEXION);
        return;
    }

    document.title = `Publicación y fechas bloqueadas de ${unidad.nombre}`;
    document.getElementById('nombre-unidad').textContent = `${unidad.nombre} · ${unidad.localidad}, ${unidad.provincia}`;

    if (unidad.es_propietario) {
        mostrarPublicacion(unidad);
        document.getElementById('publicar').addEventListener('click', () => cambiarPublicacion('publicar'));
        document.getElementById('pausar').addEventListener('click', () => cambiarPublicacion('pausar'));
    } else {
        // el administrador no publica ni pausa: se quita la sección (no solo se oculta, así el lector de pantalla no la cuenta)
        document.getElementById('seccion-publicacion').remove();
        document.querySelector('h1').textContent = 'Fechas bloqueadas';
        document.title = `Fechas bloqueadas de ${unidad.nombre}`;
    }

    // no se bloquean noches pasadas
    formBloqueo.elements.fecha_desde.min = hoyATexto();
    formBloqueo.elements.fecha_hasta.min = hoyATexto();
    formBloqueo.elements.motivo.addEventListener('change', actualizarDetalle);
    formBloqueo.addEventListener('submit', bloquear);

    document.getElementById('contenido').hidden = false;
    document.body.hidden = false;
}

cargarPagina();
