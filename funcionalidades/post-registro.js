// Página que se ve después de registrarse (vistas/registros/post-registro.html).
// La cuenta todavía no existe: se crea cuando la persona abre el enlace del mail (verificar-mail.html).
// Acá se muestra a qué mail se mandó el enlace y se ofrece reenviarlo (POST /reenviar-registro, sin sesión).
const mensaje = document.getElementById('mensaje');
const mailRegistro = sessionStorage.getItem('mailRegistro');   // lo guardó registro.js

// el mensaje del back ("Te enviamos un mail a ..."), o uno genérico si alguien entró a la página a mano
mensaje.textContent = sessionStorage.getItem('mensajeRegistro') ?? 'Podés volver al inicio para buscar alojamiento o entrar a tu cuenta.';
sessionStorage.removeItem('mensajeRegistro'); // ya se mostró: no tiene sentido guardarlo
// el mail queda guardado mientras la pestaña esté abierta, así el botón de reenviar sigue andando si se recarga la página
document.getElementById('aviso-enlace').hidden = mailRegistro === null;

// Pide otro enlace para el mismo mail. El back responde siempre lo mismo y manda como mucho uno por minuto.
async function reenviarMail() {
    const boton = document.getElementById('boton-reenviar');
    const estado = document.getElementById('mensaje-reenvio');
    boton.disabled = true;
    estado.textContent = 'Enviando…';
    try {
        const respuesta = await fetch(URL_BACK + '/reenviar-registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mail: mailRegistro }),
        });
        const resultado = await respuesta.json();
        estado.textContent = respuesta.ok ? resultado.ok : resultado.error;
    } catch (error) {//el back no respondió: mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        estado.textContent = MENSAJE_SIN_CONEXION;
    }
    // un minuto sin poder volver a tocarlo: el back tampoco manda otro antes
    setTimeout(() => { boton.disabled = false; }, 60_000);
}

// "Volver al inicio": si hay una sesión abierta va al home de su rol; si no, al home sin sesión
async function volverAlInicio() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {//el back no respondió: se avisa en el mismo mensaje de la página
        console.error('No se pudo conectar con el back:', error);
        mensaje.textContent = MENSAJE_SIN_CONEXION;
        return;
    }
    if (usuario === null) {
        window.location.href = '../homes/index-sin-sesion.html';
        return;
    }
    irAlHome(usuario.rol);//funcion de sesion.js
}

document.getElementById('boton-reenviar').addEventListener('click', reenviarMail);
document.getElementById('boton-volver-inicio').addEventListener('click', volverAlInicio);
