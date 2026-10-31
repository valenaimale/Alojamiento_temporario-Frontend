(() => {
    const form = document.getElementById('form-restablecer');
    const mensaje = document.getElementById('mensaje-error');
    const introduccion = document.getElementById('introduccion-recuperacion');
    let token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // Mantenerlo solo en memoria, nunca en storage, historial ni logs.
    history.replaceState(null, '', window.location.pathname);
    function enlaceInvalido(texto) {
        token = null;
        form.reset();
        form.hidden = true;
        introduccion.hidden = true;
        mensaje.textContent = texto;
        document.getElementById('pedir-nuevo-enlace').hidden = false;
    }
    if (!/^[0-9a-f]{64}$/.test(token || '')) {
        enlaceInvalido('Abrí el enlace que recibiste por mail. Si venció, podés pedir uno nuevo.');
        return;
    }
    form.hidden = false;
    let ocupado = false;
    form.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (ocupado) return;
        mensaje.textContent = '';
        const clave = form.elements.contrasenia.value;
        const confirmacion = form.elements.confirmar_contrasenia.value;
        if (clave !== confirmacion) {
            mensaje.textContent = 'Las contraseñas no coinciden.';
            form.elements.confirmar_contrasenia.focus();
            return;
        }
        if (new TextEncoder().encode(clave).length > 72) {
            mensaje.textContent = 'La contraseña es demasiado larga. Las tildes y emojis ocupan más espacio; probá con una más corta.';
            form.elements.contrasenia.focus();
            return;
        }
        ocupado = true;
        const boton = form.querySelector('[type=submit]');
        boton.disabled = true;
        boton.textContent = 'Guardando…';
        try {
            const respuesta = await fetch(URL_BACK + '/restablecer-contrasenia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, contrasenia: clave, confirmar_contrasenia: confirmacion }),
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) {
                if (datos.codigo === 'enlace_invalido') enlaceInvalido(datos.error);
                else mensaje.textContent = datos.error || 'No pudimos guardar la contraseña. Intentá de nuevo.';
                return;
            }
            token = null;
            form.reset();
            form.hidden = introduccion.hidden = true;
            document.getElementById('volver-login').hidden = true;
            document.getElementById('recuperacion-completa').hidden = false;
            document.getElementById('titulo-completo').focus();
        } catch {
            mensaje.textContent = MENSAJE_SIN_CONEXION;
        } finally {
            ocupado = false;
            boton.disabled = false;
            boton.textContent = 'Guardar contraseña';
        }
    });
})();
