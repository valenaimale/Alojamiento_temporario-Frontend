// Listado de usuarios del backoffice: busca, filtra y pagina.
// Todo lo que escribió un usuario (nombre, mail) se inserta con textContent, nunca con innerHTML.

// Nombres que se le muestran al backoffice. En la base el rol es una palabra sola.
const NOMBRES_DE_ROL = {
    huesped: 'Huésped',
    propietario: 'Propietario',
    administrador: 'Administrador de hospedajes',
    operador: 'Operador de estadía',
    backoffice: 'Backoffice',
};

const formulario = document.getElementById('form-filtros');
const mensajeListado = document.getElementById('mensaje-listado');
const tabla = document.getElementById('tabla-usuarios');
const cuerpoTabla = document.getElementById('cuerpo-usuarios');
const paginacion = document.getElementById('paginacion');
const textoPaginacion = document.getElementById('texto-paginacion');
const botonAnterior = document.getElementById('boton-anterior');
const botonSiguiente = document.getElementById('boton-siguiente');

let paginaActual = 1;
let totalDePaginas = 1;

// Pide una página del listado al back, con los filtros que estén puestos en el formulario.
async function cargarUsuarios(pagina) {
    mensajeListado.hidden = false;
    mensajeListado.textContent = 'Cargando usuarios…';
    tabla.hidden = true;
    paginacion.hidden = true;

    // URLSearchParams escapa los valores, así que el texto de búsqueda puede tener cualquier carácter
    const parametros = new URLSearchParams({ pagina });
    const buscar = document.getElementById('filtro-buscar').value.trim();
    const rol = document.getElementById('filtro-rol').value;
    const activo = document.getElementById('filtro-activo').value;
    if (buscar !== '') {
        parametros.set('buscar', buscar);
    }
    if (rol !== '') {
        parametros.set('rol', rol);
    }
    if (activo !== '') {
        parametros.set('activo', activo);
    }

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch(URL_BACK + '/backoffice/usuarios?' + parametros, {
            method: 'GET',
            credentials: 'include',
        });
        resultado = await respuesta.json();
    } catch (error) {//el back no respondió (apagado o sin internet): mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        mensajeListado.textContent = MENSAJE_SIN_CONEXION;
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
        mensajeListado.textContent = resultado.error;
        return;
    }

    paginaActual = resultado.pagina;
    totalDePaginas = Math.max(1, Math.ceil(resultado.total / resultado.por_pagina));

    if (resultado.usuarios.length === 0) {
        mensajeListado.textContent = 'No hay usuarios que coincidan con la búsqueda';
        return;
    }

    dibujarFilas(resultado.usuarios);
    mensajeListado.hidden = true;
    tabla.hidden = false;
    dibujarPaginacion(resultado.total);
}

// Vuelve a armar el cuerpo de la tabla con los usuarios que devolvió el back.
function dibujarFilas(usuarios) {
    cuerpoTabla.replaceChildren();//borra las filas de la búsqueda anterior

    for (const usuario of usuarios) {
        const fila = document.createElement('tr');

        agregarCelda(fila, usuario.nombre);
        agregarCelda(fila, usuario.mail);
        agregarCelda(fila, usuario.dni ?? '—');//el DNI puede ser null (cuentas viejas o de Google)
        agregarCelda(fila, NOMBRES_DE_ROL[usuario.rol] ?? usuario.rol);
        agregarCelda(fila, usuario.mail_verificado ? 'Sí' : 'No');

        // el estado va con el mismo badge que usa el resto del sistema
        const celdaEstado = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = usuario.activo ? 'estado estado-publicada' : 'estado estado-no-publicada';
        badge.textContent = usuario.activo ? 'Activo' : 'Deshabilitado';
        celdaEstado.appendChild(badge);
        fila.appendChild(celdaEstado);

        agregarCelda(fila, formatearFecha(usuario.fecha_alta));

        const celdaAccion = document.createElement('td');
        const enlace = document.createElement('a');
        enlace.href = '../backoffice/usuario.html?id=' + usuario.id;
        enlace.className = 'boton';
        enlace.textContent = 'Ver';
        celdaAccion.appendChild(enlace);
        fila.appendChild(celdaAccion);

        cuerpoTabla.appendChild(fila);
    }
}

function agregarCelda(fila, texto) {
    const celda = document.createElement('td');
    celda.textContent = texto;
    fila.appendChild(celda);
}

// El back manda la fecha como "2026-10-09 14:20:00"; acá se muestra como dd/mm/aaaa.
// Se corta el texto en lugar de usar Date, así no hay corrimientos por zona horaria.
function formatearFecha(fecha) {
    return fecha.slice(0, 10).split('-').reverse().join('/');
}

function dibujarPaginacion(total) {
    textoPaginacion.textContent = `Página ${paginaActual} de ${totalDePaginas} · ${total} usuarios`;
    botonAnterior.disabled = paginaActual <= 1;
    botonSiguiente.disabled = paginaActual >= totalDePaginas;
    paginacion.hidden = false;
}

// Cada búsqueda nueva arranca en la página 1
formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    cargarUsuarios(1);
});

botonAnterior.addEventListener('click', () => cargarUsuarios(paginaActual - 1));
botonSiguiente.addEventListener('click', () => cargarUsuarios(paginaActual + 1));
document.getElementById('boton-cerrar-sesion').addEventListener('click', cerrarSesion);

cargarUsuarios(1);   // se ejecuta apenas carga la página
