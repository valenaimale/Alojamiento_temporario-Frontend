// Página central de una unidad (vistas/unidades/configurar-unidad.html?id=5).
// Pide el resumen al backend y muestra el nombre, el estado y lo que le falta para publicarse,
// con un enlace a cada sección. No usa proteger-pagina.js porque la pueden ver dos roles (propietario y
// administrador): quién puede ver ESTA unidad lo decide el backend (responde 404 a cualquier otro).

const mensajeError = document.getElementById('mensaje-error');

// Muestra un error en lugar de la unidad (sin conexión, unidad inexistente o ajena)
function mostrarError(texto) {
    mensajeError.textContent = texto;
    document.body.hidden = false;
}

// Llena la página con el resumen de la unidad
function mostrarUnidad(unidad) {
    document.title = `Configurar ${unidad.nombre}`;
    document.getElementById('nombre-unidad').textContent = unidad.nombre;
    document.getElementById('ubicacion-unidad').textContent = `${unidad.localidad}, ${unidad.provincia}`;
    document.getElementById('estado-unidad').textContent = NOMBRES_DE_ESTADO[unidad.estado_publicacion] ?? unidad.estado_publicacion;

    if (!unidad.disponible) {   // fuera de servicio por un daño (Épica 8)
        const aviso = document.getElementById('no-disponible');
        aviso.textContent = `No disponible: ${unidad.motivo_no_disponible ?? 'fuera de servicio'}.`;
        aviso.hidden = false;
    }

    // hasta cuándo tiene precios: las reglas se exigen al publicar, así que el propietario tiene que ir cargando más
    if (unidad.es_propietario) {
        const preciosHasta = document.getElementById('precios-hasta');
        preciosHasta.textContent = unidad.precios_hasta === null
            ? 'Todavía no cargaste el precio de la noche de mañana.'
            : `Tenés precios cargados hasta el ${formatearFecha(unidad.precios_hasta)}.`;
        preciosHasta.hidden = false;
    }

    // lo que falta para publicarse solo importa mientras no está publicada
    if (unidad.faltantes.length > 0 && unidad.estado_publicacion !== 'publicada') {
        const lista = document.getElementById('lista-faltantes');
        for (const faltante of unidad.faltantes) {
            const item = document.createElement('li');
            item.textContent = faltante;
            lista.appendChild(item);
        }
        document.getElementById('faltantes').hidden = false;
    }

    // cada enlace lleva el id de la unidad
    for (const enlace of document.querySelectorAll('a[data-seccion]')) {
        enlace.href = `${enlace.getAttribute('href')}?id=${unidad.id}`;
    }

    // el administrador no ve lo que es solo del propietario, y vuelve a su cartera
    if (!unidad.es_propietario) {
        for (const seccion of document.querySelectorAll('[data-solo-propietario]')) {
            seccion.remove();   // se quita (no solo se oculta) para que el lector de pantalla no la cuente
        }
        const volver = document.getElementById('enlace-volver');
        volver.href = '../homes/index-administrador.html';
        volver.textContent = 'Volver a mi cartera';
    }

    document.getElementById('unidad').hidden = false;
    document.body.hidden = false;
}

// Arma la página: controla la sesión, arma el menú y pide el resumen de la unidad
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

    const id = idUnidadDeLaUrl();
    if (id === null) {
        mostrarError('No encontramos esa unidad.');
        return;
    }

    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await obtenerResumenUnidad(id));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        mostrarError(MENSAJE_SIN_CONEXION);
        return;
    }
    if (!respuesta.ok) {
        mostrarError(resultado.error);
        return;
    }
    mostrarUnidad(resultado.unidad);
}

cargarPagina();
