// Aviso para verificar el mail en los homes de cada rol.
// Está incluido en los cuatro homes, después de sesion.js: si el usuario ya verificó
// su mail (o no hay sesión), no agrega nada a la página.
// El mail lo escribió el usuario, así que se inserta con textContent, nunca con innerHTML.
async function mostrarAvisoDeVerificacion() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {//el aviso es secundario: si el back no responde, la página sigue andando
        console.error('No se pudo conectar con el back:', error);
        return;
    }

    if (usuario === null || usuario.mail_verificado !== false) {
        return;
    }

    const aviso = document.createElement('div');
    aviso.className = 'aviso-verificacion';
    aviso.setAttribute('role', 'status');

    const texto = document.createElement('p');
    texto.textContent = 'Verificá tu mail: te enviamos un enlace a ' + usuario.mail;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton';
    boton.textContent = 'Reenviar mail';
    boton.addEventListener('click', () => reenviarMail(boton, texto));

    aviso.appendChild(texto);
    aviso.appendChild(boton);
    document.body.prepend(aviso);//primer hijo del body: queda como una franja arriba de todo
}

// Pide un mail de verificación nuevo y muestra la respuesta del back en el mismo aviso.
async function reenviarMail(boton, texto) {
    boton.disabled = true;   // para que no se pueda pedir dos veces mientras espera

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch('http://localhost:8000/reenviar-verificacion', {
            method: 'POST',
            credentials: 'include',
        });
        resultado = await respuesta.json();
    } catch (error) {//el back no respondió (apagado o sin internet): mensaje de sesion.js
        console.error('No se pudo conectar con el back:', error);
        texto.textContent = MENSAJE_SIN_CONEXION;
        boton.disabled = false;
        return;
    }

    texto.textContent = respuesta.ok ? resultado.ok : resultado.error;
    boton.disabled = false;
}

mostrarAvisoDeVerificacion();   // se ejecuta apenas carga la página
