const form=document.getElementById('form-inicio-sesion');
form.addEventListener('submit', async (evento) => { // "escucha" el form: cada vez que se envíe (submit), ejecuta esta función. async permite usar await adentro. evento tiene la info del envío
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(form)); // FormData junta los campos del form según su atributo name; Object.fromEntries los pasa a un objeto {nombre: ..., mail: ..., contrasenia: ...}
    
    const respuesta = await fetch('http://localhost:8000/iniciar-sesion', { // le pide al navegador que haga la petición al back; y con await espera a que llegue la respuesta
        method: 'POST',                                   // método HTTP: la ruta del back es POST@/registrarse
        headers: { 'Content-Type': 'application/json' },  // le avisa al back que el cuerpo es JSON
        credentials: 'include',
        body: JSON.stringify(datos)                  // convierte el objeto datos a texto JSON (como json_encode en PHP)
    });
    const resultado = await respuesta.json();
    if (respuesta.ok) {
        irAlHome(resultado.usuario.rol);
    }
    else{
        const mensaje = document.getElementById('mensaje-error');                     // busca el <p id="mensaje"> de ESTA página (post-registro)
        mensaje.textContent = resultado.error;
    }

})