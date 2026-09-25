// Carga los datos del usuario logueado en la página. Si no hay sesión, manda al login.
async function cargarPerfil() {
    let usuario;
    try {
        usuario = await obtenerSesion();   // con paréntesis: ejecuta la función; con await: espera el resultado
    } catch (error) {                     // el back no respondió: se muestra el aviso de sesion.js
        mostrarPantallaSinConexion(error);
        return;
    }

    if (usuario === null) {                   // no hay sesión: esta página no se puede ver
        window.location.href = '../homes/index-sin-sesion.html';
        return;
    }

    document.getElementById('saludo-nombre').textContent = `Hola, ${usuario.nombre}`;   // comillas invertidas para meter la variable
    document.getElementById('perfil-nombre').textContent = usuario.nombre;
    document.getElementById('perfil-mail').textContent = usuario.mail;
    document.getElementById('perfil-rol').textContent = usuario.rol;
}

cargarPerfil();   // la ejecuta apenas carga la página

const boton = document.getElementById('boton-cerrar-sesion');
boton.addEventListener('click', cerrarSesion);