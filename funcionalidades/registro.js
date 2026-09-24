const form = document.getElementById('form-registro'); // busca en el HTML el elemento con id="form-registro" y lo guarda en la constante form
form.addEventListener('submit', async (evento) => { // "escucha" el form: cada vez que se envíe (submit), ejecuta esta función. async permite usar await adentro. evento tiene la info del envío
    evento.preventDefault();   // frena el envío clásico del form (que iría a otra página y recargaría). A partir de acá lo manejamos nosotros

    console.log('Se envió el formulario'); // muestra un texto en la consola del navegador (F12 → Console), para confirmar que se ejecutó
    console.log('Rol:', form.dataset.rol);   // lee el atributo data-rol del form (dataset.rol = data-rol) y lo muestra en consola
    const datos = Object.fromEntries(new FormData(form)); // FormData junta los campos del form según su atributo name; Object.fromEntries los pasa a un objeto {nombre: ..., mail: ..., contrasenia: ...}
    datos.rol = form.dataset.rol; // agrega al objeto la propiedad rol, con el valor de data-rol (el rol no es un campo del form)

    console.log(datos); // muestra en consola el objeto completo, que es lo que después se va a enviar al back

    const respuesta = await fetch('http://localhost:8000/registrarse', { // le pide al navegador que haga la petición al back; y con await espera a que llegue la respuesta
        method: 'POST',                                   // método HTTP: la ruta del back es POST@/registrarse
        headers: { 'Content-Type': 'application/json' },  // le avisa al back que el cuerpo es JSON
        body: JSON.stringify(datos),                      // convierte el objeto datos a texto JSON (como json_encode en PHP)
    });

    const resultado = await respuesta.json(); // lee el cuerpo de la respuesta y lo convierte de JSON a objeto (como json_decode en PHP)
    console.log(respuesta.status, resultado); // muestra el código HTTP (201, 422...) y lo que respondió el back ({ok: ...} o {error: ...})
}); // cierra la función del submit y el addEventListener
