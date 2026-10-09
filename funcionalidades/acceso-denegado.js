// "Volver a mi inicio": lleva al home del rol del usuario. Si la sesión se venció, al login.
async function volverAlInicio() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {//el back no respondió
        console.error('No se pudo conectar con el back:', error);
        alert(MENSAJE_SIN_CONEXION);
        return;
    }
    if (usuario === null) {
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    irAlHome(usuario.rol);//funcion de sesion.js
}

document.getElementById('boton-volver-inicio').addEventListener('click', volverAlInicio);
