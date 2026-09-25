// Mensaje para cuando el back no responde (servidor apagado o sin internet).
// Es para el usuario, así que no dice nada técnico: el detalle queda en la consola (F12).
const MENSAJE_SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión a internet y volvé a intentar en unos minutos.';

// Reemplaza el contenido de la página por un aviso con un botón para reintentar.
// Se usa en las páginas que no se pueden mostrar sin saber quién es el usuario.
function mostrarPantallaSinConexion(error) {
    console.error('No se pudo conectar con el back:', error);
    document.body.innerHTML = `
        <main>
            <h1>No pudimos cargar la página</h1>
            <p>${MENSAJE_SIN_CONEXION}</p>
            <button type="button" class="boton boton-primario">Reintentar</button>
        </main>`;
    document.querySelector('button').addEventListener('click', () => window.location.reload());
    document.body.hidden = false;
}
async function cerrarSesion() {
    try {
        await fetch('http://localhost:8000/cerrar-sesion', {
            method: 'POST',
            credentials: 'include',
        });
    } catch (error) {//fetch falla solo si no pudo llegar al back
        console.error('No se pudo conectar con el back:', error);
        alert(MENSAJE_SIN_CONEXION);
        return;
    }

    //una vez que el back cerró la sesión, llevamos al usuario al login
    window.location.href = '../homes/index-sin-sesion.html';
}
//Si el back no responde, fetch lanza un error: lo atrapa quien llama a esta función
//(así se distingue "no hay sesión" de "no hay conexión").
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
// Protege una página que solo puede ver un rol (los homes de cada rol).
// Sin sesión: manda al login. Con otro rol: manda al home de su propio rol.
// El body arranca con el atributo hidden y solo se muestra si el rol coincide,
// así no se llega a ver el contenido antes de la redirección.
async function protegerPagina(rolPermitido) {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {
        mostrarPantallaSinConexion(error);
        return;
    }

    if (usuario === null) {
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    if (usuario.rol !== rolPermitido) {
        irAlHome(usuario.rol);
        return;
    }
    document.body.hidden = false;
}
// Para páginas de visitantes (home sin sesión): si ya hay sesión, lleva al home de su rol.
async function redirigirSiHaySesion() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {//es una página pública: sin conexión se muestra igual
        console.error('No se pudo conectar con el back:', error);
        document.body.hidden = false;
        return;
    }

    if (usuario === null) {
        document.body.hidden = false;
        return;
    }
    irAlHome(usuario.rol);
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