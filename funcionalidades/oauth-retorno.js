// Página intermedia: el back redirige acá después de iniciar la sesión con Google.
// Se pide la sesión y se decide a dónde va el usuario.
async function continuarDespuesDeGoogle() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {//el back no respondió
        mostrarPantallaSinConexion(error);
        return;
    }

    if (usuario === null) {//no debería pasar: el back inició la sesión antes de redirigir
        window.location.href = 'inicio-sesion.html?error=error';
        return;
    }
    if (usuario.dni === null) {//cuenta creada con Google: falta el DNI
        window.location.href = 'completar-datos.html';
        return;
    }
    irAlHome(usuario.rol);
}

continuarDespuesDeGoogle();
