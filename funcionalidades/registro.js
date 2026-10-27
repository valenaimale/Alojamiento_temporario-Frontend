// Envía al backend cualquiera de los cuatro formularios de registro (el rol sale del atributo data-rol del formulario).
// Si el backend rechaza algún dato, muestra el error en el mismo formulario; si sale bien, va a post-registro.html.
const form = document.getElementById('form-registro'); // busca en el HTML el elemento con id="form-registro" y lo guarda en la constante form
form.addEventListener('submit', async (evento) => { // "escucha" el form: cada vez que se envíe (submit), ejecuta esta función. async permite usar await adentro. evento tiene la info del envío
    evento.preventDefault();   // frena el envío clásico del form (que iría a otra página y recargaría). A partir de acá lo manejamos nosotros

    const mensajeError = document.getElementById('mensaje-error'); // el <p id="mensaje-error"> que está debajo del formulario
    mensajeError.textContent = ''; // borra el error del intento anterior
    const datos = Object.fromEntries(new FormData(form)); // FormData junta los campos del form según su atributo name; Object.fromEntries los pasa a un objeto {nombre: ..., mail: ..., contrasenia: ...}
    datos.rol = form.dataset.rol; // agrega al objeto la propiedad rol, con el valor de data-rol (el rol no es un campo del form)

    // el mail y la contraseña se escriben dos veces: si no coinciden se avisa acá, sin enviar nada al back
    if (datos.mail.trim().toLowerCase() !== datos.mail_confirmacion.trim().toLowerCase()) {
        mensajeError.textContent = 'Los mails no coinciden';
        return;
    }
    if (datos.contrasenia !== datos.contrasenia_confirmacion) {
        mensajeError.textContent = 'Las contraseñas no coinciden';
        return;
    }
    // los datos fiscales solo se mandan si cobra IVA (huésped y operador no tienen esos campos;
    // propietario y administrador además mandan siempre su cuenta bancaria: cbu, alias y titular_cuenta)
    if (datos.cobra_iva !== '1') {
        delete datos.cuit;
        delete datos.razon_social;
        delete datos.domicilio_fiscal;
    }

    let respuesta;
    let resultado;
    try {
        respuesta = await fetch(URL_BACK + '/registrarse', { // le pide al navegador que haga la petición al back; y con await espera a que llegue la respuesta
            method: 'POST',
            credentials: 'include',                                   // método HTTP: la ruta del back es POST@/registrarse
            headers: { 'Content-Type': 'application/json' },  // le avisa al back que el cuerpo es JSON
            body: JSON.stringify(datos),                      // convierte el objeto datos a texto JSON (como json_encode en PHP)
        });
        resultado = await respuesta.json(); // lee el cuerpo de la respuesta y lo convierte de JSON a objeto
    } catch (error) {
        //el back no respondió (apagado o sin internet): se avisa en el mismo formulario,
        //así el usuario no pierde lo que escribió y puede volver a intentar
        console.error('No se pudo conectar con el back:', error);
        mensajeError.textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    // si el back rechazó algún dato, el error se muestra acá mismo: el usuario corrige ese campo
    // sin perder todo lo que ya escribió (y el <p role="alert"> hace que el lector de pantalla lo lea en voz alta)
    if (!respuesta.ok) {
        mensajeError.textContent = resultado.error;
        return;
    }

    sessionStorage.setItem('mensajeRegistro', resultado.ok);     // guarda el mensaje en el session storage del navegador para que lo lea la página siguiente.
    sessionStorage.setItem('registroExitoso', '1');              // para que la página siguiente avise del mail de verificación
    //lo que se guarda en el session storage del navegador permanece ahi hasta cerrar la ventana.
    window.location.href = 'post-registro.html';                 // navega a la página de resultado   
}); // cierra la función del submit y el addEventListener
