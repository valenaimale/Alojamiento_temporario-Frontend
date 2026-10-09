// Detalle de un usuario para el backoffice: muestra sus datos y permite
// deshabilitar o reactivar la cuenta.
// Todo lo que escribió el usuario se inserta con textContent, nunca con innerHTML.

// Los mismos nombres legibles que usa el listado (backoffice-usuarios.js es de otra página).
const NOMBRES_DE_ROL_DETALLE = {
    huesped: 'Huésped',
    propietario: 'Propietario',
    administrador: 'Administrador de hospedajes',
    operador: 'Operador de estadía',
    backoffice: 'Backoffice',
};

const idDelUsuario = new URLSearchParams(window.location.search).get('id');

const mensaje = document.getElementById('mensaje');
const seccionCuenta = document.getElementById('datos-cuenta');
const seccionFiscal = document.getElementById('datos-fiscales');
const acciones = document.getElementById('acciones');
const mensajeAccion = document.getElementById('mensaje-accion');
const botonCambiarEstado = document.getElementById('boton-cambiar-estado');
const confirmacion = document.getElementById('confirmacion');

let usuarioMostrado = null;

async function cargarUsuario() {
    if (idDelUsuario === null) {   // alguien entró a la página sin el ?id=
        mensaje.textContent = 'Usuario inválido';
        return;
    }

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch('http://localhost:8000/backoffice/usuario?id=' + encodeURIComponent(idDelUsuario), {
            method: 'GET',
            credentials: 'include',
        });
        resultado = await respuesta.json();
    } catch (error) {//el back no respondió (apagado o sin internet): mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        mensaje.textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    if (respuesta.status === 401) {//se cayó la sesión o deshabilitaron la cuenta mientras estaba adentro
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    if (respuesta.status === 403) {//no es backoffice: la página de acceso denegado lo devuelve a su home
        window.location.href = '../errores/acceso-denegado.html';
        return;
    }
    if (!respuesta.ok) {
        mensaje.textContent = resultado.error;
        return;
    }

    mostrarUsuario(resultado.usuario);
    mensaje.hidden = true;
}

// Llena la página con los datos del usuario. Se vuelve a llamar después de cambiar el estado.
function mostrarUsuario(usuario) {
    usuarioMostrado = usuario;

    document.getElementById('dato-nombre').textContent = usuario.nombre;
    document.getElementById('dato-mail').textContent = usuario.mail;
    document.getElementById('dato-dni').textContent = usuario.dni ?? '—';//puede ser null
    document.getElementById('dato-rol').textContent = NOMBRES_DE_ROL_DETALLE[usuario.rol] ?? usuario.rol;
    document.getElementById('dato-mail-verificado').textContent = usuario.mail_verificado ? 'Sí' : 'No';
    document.getElementById('dato-estado').textContent = usuario.activo ? 'Activo' : 'Deshabilitado';
    document.getElementById('dato-alta').textContent = formatearFechaDetalle(usuario.fecha_alta);
    seccionCuenta.hidden = false;

    // solo los propietarios tienen fila en propietarios: para el resto el back manda null
    if (usuario.datos_fiscales !== null) {
        document.getElementById('dato-cobra-iva').textContent = usuario.datos_fiscales.cobra_iva ? 'Sí' : 'No';
        document.getElementById('dato-cuit').textContent = usuario.datos_fiscales.cuit ?? '—';
        document.getElementById('dato-razon-social').textContent = usuario.datos_fiscales.razon_social ?? '—';
        document.getElementById('dato-domicilio-fiscal').textContent = usuario.datos_fiscales.domicilio_fiscal ?? '—';
        seccionFiscal.hidden = false;
    } else {
        seccionFiscal.hidden = true;
    }

    botonCambiarEstado.textContent = usuario.activo ? 'Deshabilitar cuenta' : 'Reactivar cuenta';
    confirmacion.hidden = true;
    botonCambiarEstado.hidden = false;
    acciones.hidden = false;
}

// El back manda la fecha como "2026-10-09 14:20:00"; acá se muestra como dd/mm/aaaa.
function formatearFechaDetalle(fecha) {
    return fecha.slice(0, 10).split('-').reverse().join('/');
}

// Pide al back el cambio de estado y vuelve a dibujar los datos con el usuario que devuelve.
async function cambiarEstado(activo) {
    let respuesta;
    let resultado;
    try {
        respuesta = await fetch('http://localhost:8000/backoffice/usuario/estado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: usuarioMostrado.id, activo }),
        });
        resultado = await respuesta.json();
    } catch (error) {//el back no respondió (apagado o sin internet): mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        mensajeAccion.textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    if (respuesta.status === 401) {
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    if (!respuesta.ok) {
        confirmacion.hidden = true;
        botonCambiarEstado.hidden = false;
        mensajeAccion.textContent = resultado.error;
        return;
    }

    mensajeAccion.textContent = resultado.ok;
    mostrarUsuario(resultado.usuario);
}

// Deshabilitar pide confirmación en la página; reactivar no hace falta
botonCambiarEstado.addEventListener('click', () => {
    mensajeAccion.textContent = '';
    if (usuarioMostrado.activo) {
        botonCambiarEstado.hidden = true;
        confirmacion.hidden = false;
        return;
    }
    cambiarEstado(true);
});

document.getElementById('boton-confirmar').addEventListener('click', () => cambiarEstado(false));
document.getElementById('boton-cancelar').addEventListener('click', () => {
    confirmacion.hidden = true;
    botonCambiarEstado.hidden = false;
});

cargarUsuario();   // se ejecuta apenas carga la página
