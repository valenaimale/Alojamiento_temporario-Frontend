// Página a la que lleva el enlace del mail de verificación.
// El token viaja en la URL (?token=...), así que esta página no necesita sesión:
// el usuario puede abrir el mail en otro navegador o en el celular.
const mensaje = document.getElementById('mensaje');

async function verificarMail() {
    const token = new URLSearchParams(window.location.search).get('token');

    if (token === null) {   // alguien entró a la página a mano, sin el enlace del mail
        mensaje.textContent = 'El enlace no es válido';
        return;
    }

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch(URL_BACK + '/verificar-mail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',   // si el usuario tiene la sesión abierta acá, el back se la refresca
            body: JSON.stringify({ token })
        });
        resultado = await respuesta.json();
    } catch (error) {//el back no respondió (apagado o sin internet): mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        mensaje.textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    mensaje.textContent = respuesta.ok ? resultado.ok : resultado.error;
}

verificarMail();   // se ejecuta apenas carga la página

// "Ir al inicio": si hay sesión lo lleva al home de su rol; si no, al login.
document.getElementById('boton-ir-al-inicio').addEventListener('click', async () => {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {//sin conexión no se puede saber quién es: lo mandamos al login
        console.error('No se pudo conectar con el back:', error);
        window.location.href = 'inicio-sesion.html';
        return;
    }

    if (usuario === null) {
        window.location.href = 'inicio-sesion.html';
        return;
    }
    irAlHome(usuario.rol);
});
