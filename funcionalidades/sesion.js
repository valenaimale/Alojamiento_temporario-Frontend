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
function irAlHome(rol) {
    switch (rol){
        case 'huesped':
            window.location.href= '../homes/index-huesped.html';
            break;
        case 'propietario':
            window.location.href= '../homes/index-propietario.html';
            break;
        case 'administrador':
            window.location.href= '../homes/index-administrador.html';
            break;
        case 'operador':
            window.location.href= '../homes/index-operador.html';
            break;            
    }
}