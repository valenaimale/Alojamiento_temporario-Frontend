// Alta de una unidad (vistas/unidades/alta-unidad.html).
// Llena la lista de localidades y manda el formulario a POST /unidades/crear.
// El navegador valida con los atributos del HTML (los mismos límites que el back), pero si el back
// rechaza algo, se muestra su mensaje. Al crearla, va a la página central de la unidad nueva.
// La página la protege proteger-pagina.js (solo propietarios).

const formAlta = document.getElementById('form-alta');
const mensajeError = document.getElementById('mensaje-error');
const mensajeProgreso = document.getElementById('mensaje-progreso');
const botonAlta = formAlta.querySelector('button[type="submit"]');

// Llena el <select> de localidades. Si el back no responde, avisa y deja el formulario sin poder enviarse.
async function prepararFormulario() {
    try {
        await cargarLocalidades(document.getElementById('localidad'));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        mensajeError.textContent = MENSAJE_SIN_CONEXION;
        botonAlta.disabled = true;
    }
}

// Manda los datos al back. Mientras espera, deshabilita el botón para que no se cree la unidad dos veces.
formAlta.addEventListener('submit', async (evento) => {
    evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros
    mensajeError.textContent = '';   // borra el error del intento anterior
    const datos = Object.fromEntries(new FormData(formAlta));   // {nombre, localidad_id, direccion, capacidad, caracteristicas, deposito_garantia}

    botonAlta.disabled = true;
    mensajeProgreso.textContent = 'Dando de alta la unidad...';
    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await pedirAlBack('/unidades/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        }));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        resultado = { error: MENSAJE_SIN_CONEXION };
    }

    if (respuesta?.ok) {
        // a la página central de la unidad nueva, para seguir con las fotos, los precios y las condiciones
        window.location.href = `configurar-unidad.html?id=${resultado.id}`;
        return;
    }
    mensajeProgreso.textContent = '';
    mensajeError.textContent = resultado.error;
    botonAlta.disabled = false;
});

prepararFormulario();
