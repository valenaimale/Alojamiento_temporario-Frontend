// Reutiliza la lista de destinos permitidos del login; nunca redirige a sitios externos.
function volverDespuesDeCompletar(rol) {
    const volver = paginaParaVolver();
    if (volver !== null) window.location.href = volver;
    else irAlHome(rol);
}

// Pide el DNI a las cuentas que no lo tienen (las creadas con Google, o usuarios viejos).
// Sin sesión manda al login; al completar vuelve al alojamiento o al inicio de su rol.
async function prepararPagina() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {
        mostrarPantallaSinConexion(error);
        return;
    }

    if (usuario === null) {
        window.location.href = 'inicio-sesion.html';
        return;
    }
    if (usuario.dni !== null) {
        volverDespuesDeCompletar(usuario.rol);
        return;
    }
    document.body.hidden = false;
}

const form = document.getElementById('form-completar-datos');
form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(form)); // {dni: ...}

    const mensaje = document.getElementById('mensaje-error');
    let respuesta;
    let resultado;
    try {
        respuesta = await fetch(URL_BACK + '/completar-datos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',                          // manda la cookie de sesión: el back toma el usuario de ahí
            body: JSON.stringify(datos)
        });
        resultado = await respuesta.json();
    } catch (error) {//el back no respondió (apagado o sin internet): mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        mensaje.textContent = MENSAJE_SIN_CONEXION;
        return;
    }
    if (respuesta.ok) {
        volverDespuesDeCompletar(resultado.usuario.rol);
    }
    else {
        mensaje.textContent = resultado.error;
    }
});

prepararPagina();
