(() => {
    const form = document.getElementById('form-recuperacion');
    const enviado = document.getElementById('recuperacion-enviada');
    const introduccion = document.getElementById('introduccion-recuperacion');
    const mensaje = document.getElementById('mensaje-error');
    const reenviar = document.getElementById('reenviar-enlace');
    const cambiar = document.getElementById('cambiar-mail');
    let ultimoMail = '';
    let ocupado = false;
    let temporizador;

    function esperarReenvio() {
        clearInterval(temporizador);
        const hasta = Date.now() + 60_000;
        const actualizar = () => {
            const segundos = Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
            reenviar.disabled = segundos > 0 || ocupado;
            reenviar.textContent = segundos ? 'Volver a enviar en ' + segundos + ' s' : 'Volver a enviar';
            if (!segundos) clearInterval(temporizador);
        };
        actualizar();
        temporizador = setInterval(actualizar, 1000);
    }

    async function solicitar(mail) {
        if (ocupado) return;
        ocupado = true;
        mensaje.textContent = '';
        const boton = form.querySelector('[type=submit]');
        boton.disabled = reenviar.disabled = cambiar.disabled = true;
        boton.textContent = 'Enviando…';
        try {
            const respuesta = await fetch(URL_BACK + '/recuperar-contrasenia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mail }),
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) {
                mensaje.textContent = datos.error || 'No pudimos enviar el enlace. Intentá de nuevo.';
                return;
            }
            ultimoMail = mail;
            form.hidden = true;
            introduccion.hidden = true;
            enviado.hidden = false;
            document.getElementById('titulo-enviado').focus();
            esperarReenvio();
        } catch {
            mensaje.textContent = MENSAJE_SIN_CONEXION;
        } finally {
            ocupado = false;
            boton.disabled = cambiar.disabled = false;
            boton.textContent = 'Enviar enlace';
            if (mensaje.textContent) reenviar.disabled = false;
        }
    }

    form.addEventListener('submit', evento => {
        evento.preventDefault();
        solicitar(form.elements.mail.value.trim());
    });
    reenviar.addEventListener('click', () => solicitar(ultimoMail));
    cambiar.addEventListener('click', () => {
        clearInterval(temporizador);
        enviado.hidden = true;
        form.hidden = false;
        introduccion.hidden = false;
        mensaje.textContent = '';
        form.elements.mail.focus();
    });
})();
