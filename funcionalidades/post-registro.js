const mensaje = document.getElementById('mensaje');                     // busca el <p id="mensaje"> de ESTA página (post-registro)
mensaje.textContent = sessionStorage.getItem('mensajeRegistro') ?? '';  // lee el mensaje que guardó registro.js y lo muestra
sessionStorage.removeItem('mensajeRegistro'); //se elimina el item del session storage del navegador, no tiene sentido guardarlo una vez que se utilizo
// "Volver al inicio": si el registro dejó una sesión abierta, va al home de su rol; si no, al home sin sesión
async function volverAlInicio() {
    const usuario = await obtenerSesion();
    if (usuario === null) {
        window.location.href = '../homes/index-sin-sesion.html';
        return;
    }
    irAlHome(usuario.rol);//funcion de sesion.js
}

document.getElementById('boton-volver-inicio').addEventListener('click', volverAlInicio);