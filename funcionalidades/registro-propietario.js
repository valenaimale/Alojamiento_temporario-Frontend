// Muestra los datos fiscales (CUIT, razón social y domicilio fiscal) solo si el usuario elige "Sí, cobro IVA".
// Lo usan el registro de propietario y "hacerme propietario": las dos páginas tienen
// el mismo <select id="cobra_iva"> y el mismo <fieldset id="datos-fiscales">.
const selectCobraIva = document.getElementById('cobra_iva');
const datosFiscales = document.getElementById('datos-fiscales');
const camposFiscales = datosFiscales.querySelectorAll('input');

function actualizarDatosFiscales() {
    const cobraIva = selectCobraIva.value === '1';
    datosFiscales.hidden = !cobraIva;
    for (const campo of camposFiscales) {
        campo.required = cobraIva; // un input oculto con required bloquearía el envío del formulario, por eso se apaga
        if (!cobraIva) {
            campo.value = ''; // si se arrepiente y elige "No", no queda nada cargado
        }
    }
}

selectCobraIva.addEventListener('change', actualizarDatosFiscales);
actualizarDatosFiscales(); // por si el navegador recuerda lo que estaba elegido al recargar la página
