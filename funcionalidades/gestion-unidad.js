// Quién gestiona una unidad (vistas/unidades/gestion-unidad.html?id=5), US2.2 a US2.4.
// Pide GET /unidades/gestion y muestra el administrador (con su comisión) y el operador, o los formularios para asignarlos.
// - Administrador: asignar, cambiar la comisión y quitar son solo del propietario.
// - Operador: lo asignan y lo quitan el propietario o el administrador de la unidad.
// Quién puede ver la unidad lo decide el backend (404 a cualquier otro).

let idUnidad = null;
let esPropietario = false;

// ---------- utilidades ----------

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

// Borra el mensaje de error y el de éxito de una tarjeta ('administrador' u 'operador')
function limpiarMensajes(tarjeta) {
    document.getElementById(`error-${tarjeta}`).textContent = '';
    document.getElementById(`ok-${tarjeta}`).textContent = '';
}

// "15.00" → "15 %", "17.50" → "17,5 %"
function formatearPorcentaje(valor) {
    return `${Number(valor).toLocaleString('es-AR')} %`;
}

// ---------- mostrar ----------

// Pide la gestión al backend y la muestra. Lanza el error si el backend no responde o responde un error.
async function cargarGestion() {
    const { respuesta, resultado } = await pedirAlBack(`/unidades/gestion?id=${encodeURIComponent(idUnidad)}`);
    if (!respuesta.ok) {
        throw new Error(resultado.error);
    }
    esPropietario = resultado.es_propietario;
    mostrarAdministrador(resultado.administrador);
    mostrarOperador(resultado.operador);
}

// El administrador con sus datos (y, para el propietario, cambiar la comisión y quitarlo), o el formulario para asignar uno
function mostrarAdministrador(administrador) {
    document.getElementById('administrador-asignado').hidden = administrador === null;
    document.getElementById('sin-administrador').hidden = administrador !== null;
    if (administrador === null) {
        return;
    }
    document.getElementById('administrador-nombre').textContent = administrador.nombre;
    document.getElementById('administrador-mail').textContent = administrador.mail;
    document.getElementById('administrador-comision').textContent = formatearPorcentaje(administrador.porcentaje_comision);
    document.getElementById('administrador-desde').textContent = formatearFecha(administrador.desde);
    document.getElementById('form-comision').elements.porcentaje_comision.value = Number(administrador.porcentaje_comision);
}

// El operador con sus datos y "Quitar", o el formulario para asignar uno
function mostrarOperador(operador) {
    document.getElementById('operador-asignado').hidden = operador === null;
    document.getElementById('sin-operador').hidden = operador !== null;
    if (operador !== null) {
        document.getElementById('operador-nombre').textContent = operador.nombre;
        document.getElementById('operador-mail').textContent = operador.mail;
    }
}

// Lo que ve cada uno: el propietario, los botones del administrador; el administrador, solo el aviso de que no los puede usar.
// Se quitan del DOM (no solo se ocultan), así el lector de pantalla no los cuenta.
function ajustarSegunQuienEs() {
    const quitar = esPropietario ? '.solo-administrador' : '.solo-propietario';
    for (const elemento of document.querySelectorAll(quitar)) {
        elemento.remove();
    }
    if (!esPropietario) {
        document.getElementById('sin-administrador').remove();   // un administrador siempre ve una unidad que administra
    }
}

// ---------- acciones ----------

// Hace una acción de una tarjeta ('administrador' u 'operador'): manda el pedido, muestra el resultado,
// vuelve a pedir la gestión y lleva el foco al título de la tarjeta (el formulario o el botón tocado pueden haber desaparecido)
async function hacerAccion(tarjeta, ruta, datos, formulario = null) {
    limpiarMensajes(tarjeta);
    const elementoError = document.getElementById(`error-${tarjeta}`);

    const envio = await enviar(ruta, datos, elementoError);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        elementoError.textContent = envio.resultado.error;
        return;
    }

    formulario?.reset();
    try {
        await cargarGestion();
    } catch (error) {
        console.error('No se pudo actualizar la gestión:', error);
    }
    document.getElementById(`ok-${tarjeta}`).textContent = envio.resultado.ok;
    document.getElementById(`titulo-${tarjeta}`).focus();
}

// Conecta los formularios y los botones con sus acciones
function conectarAcciones() {
    const formAsignarAdministrador = document.getElementById('form-asignar-administrador');
    formAsignarAdministrador?.addEventListener('submit', (evento) => {
        evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros
        const datos = Object.fromEntries(new FormData(formAsignarAdministrador));   // {mail, porcentaje_comision}
        hacerAccion('administrador', '/unidades/administrador/asignar', datos, formAsignarAdministrador);
    });

    const formComision = document.getElementById('form-comision');
    formComision?.addEventListener('submit', (evento) => {
        evento.preventDefault();
        hacerAccion('administrador', '/unidades/administrador/comision', Object.fromEntries(new FormData(formComision)));
    });

    document.getElementById('quitar-administrador')?.addEventListener('click', () => {
        const nombre = document.getElementById('administrador-nombre').textContent;
        if (confirm(`¿Quitar a ${nombre} como administrador? La unidad vuelve a ser de autogestión, y le avisamos por mail.`)) {
            hacerAccion('administrador', '/unidades/administrador/quitar', {});
        }
    });

    const formAsignarOperador = document.getElementById('form-asignar-operador');
    formAsignarOperador.addEventListener('submit', (evento) => {
        evento.preventDefault();
        hacerAccion('operador', '/unidades/operador/asignar', Object.fromEntries(new FormData(formAsignarOperador)), formAsignarOperador);
    });

    document.getElementById('quitar-operador').addEventListener('click', () => {
        const nombre = document.getElementById('operador-nombre').textContent;
        if (confirm(`¿Quitar a ${nombre} como operador de la unidad?`)) {
            hacerAccion('operador', '/unidades/operador/quitar', {});
        }
    });
}

// ---------- arranque ----------

// Arma la página: controla la sesión, arma el menú y pide el nombre de la unidad y su gestión
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
        await cargarGestion();
    } catch (error) {
        console.error('No se pudo cargar la página:', error);
        mostrarErrorPagina(error instanceof TypeError ? MENSAJE_SIN_CONEXION : error.message);
        return;
    }

    document.title = `Administrador y operador de ${unidad.nombre}`;
    document.getElementById('nombre-unidad').textContent = `${unidad.nombre} · ${unidad.localidad}, ${unidad.provincia}`;
    ajustarSegunQuienEs();
    conectarAcciones();

    document.getElementById('contenido').hidden = false;
    document.body.hidden = false;
}

cargarPagina();
