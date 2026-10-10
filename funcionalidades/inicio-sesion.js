// Si el login con Google falla, el back vuelve a esta página con ?error=<codigo>.
// El código se usa solo como clave de este objeto: nunca se muestra el texto de la URL tal cual.
const ERRORES_OAUTH = {
    cancelado: 'Cancelaste el inicio de sesión con Google.',
    invalido: 'No pudimos validar el inicio de sesión con Google. Intentá de nuevo.',
    mail_no_verificado: 'Tu cuenta de Google no tiene el mail verificado.',
    no_permitido: 'Esa cuenta no puede entrar con Google. Iniciá sesión con tu mail y contraseña.',
    deshabilitada: 'Tu cuenta está deshabilitada.',
    error: 'Hubo un problema al iniciar sesión con Google. Intentá de nuevo en unos minutos.',
};
const codigoError = new URLSearchParams(window.location.search).get('error');
if (codigoError !== null) {
    document.getElementById('mensaje-error').textContent = ERRORES_OAUTH[codigoError] ?? ERRORES_OAUTH.error; // código desconocido: mensaje genérico
}

const form=document.getElementById('form-inicio-sesion');
form.addEventListener('submit', async (evento) => { // "escucha" el form: cada vez que se envíe (submit), ejecuta esta función. async permite usar await adentro. evento tiene la info del envío
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(form)); // FormData junta los campos del form según su atributo name; Object.fromEntries los pasa a un objeto {nombre: ..., mail: ..., contrasenia: ...}
    
    const mensaje = document.getElementById('mensaje-error');                     // busca el <p id="mensaje-error"> de ESTA página (inicio-sesion)
    let respuesta;
    let resultado;
    try {
        respuesta = await fetch('http://localhost:8000/iniciar-sesion', { // le pide al navegador que haga la petición al back; y con await espera a que llegue la respuesta
            method: 'POST',                                   // método HTTP: la ruta del back es POST@/iniciar-sesion
            headers: { 'Content-Type': 'application/json' },  // le avisa al back que el cuerpo es JSON
            credentials: 'include',
            body: JSON.stringify(datos)                  // convierte el objeto datos a texto JSON (como json_encode en PHP)
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
    else{
        mensaje.textContent = resultado.error;
    }

})