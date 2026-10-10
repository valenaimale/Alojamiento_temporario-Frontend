// Pide el DNI a las cuentas que no lo tienen (las creadas con Google, o usuarios viejos).
// Sin sesión manda al login; si el DNI ya está cargado, manda al home.
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
        irAlHome(usuario.rol);
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
        respuesta = await fetch('http://localhost:8000/completar-datos', {
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
        irAlHome(resultado.usuario.rol);
    }
    else {
        mensaje.textContent = resultado.error;
    }
});

prepararPagina();
