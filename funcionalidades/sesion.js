async function cerrarSesion() {
    await fetch('http://localhost:8000/cerrar-sesion', {
        method: 'POST',
        credentials: 'include',
    });

    //una vez que el back cerró la sesión, llevamos al usuario al login
    window.location.href = '../homes/index-sin-sesion.html';
}
async function obtenerSesion() {
    const respuesta = await fetch('http://localhost:8000/sesion', {
        method: 'GET',
        credentials: 'include',
    });

    //si el back respondió 401 (no hay sesión), devolvemos null y cortamos acá
    if (!respuesta.ok) {
        return null;
    }

    //leemos el JSON {"usuario": {...}} y devolvemos solo lo de adentro
    const resultado = await respuesta.json();
    return resultado.usuario;
}