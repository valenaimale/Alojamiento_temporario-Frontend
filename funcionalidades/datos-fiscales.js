// Muestra los datos fiscales (CUIT, razón social y domicilio fiscal) solo si el usuario elige "Sí, cobro IVA".
// Lo usan el registro de propietario, el de administrador y "hacerme propietario": las tres páginas tienen
// los mismos radios name="cobra_iva" y el mismo <fieldset id="datos-fiscales">.
// La cuenta bancaria (CBU, alias y titular) se pide siempre, así que no depende de esta elección.
const radiosCobraIva = document.querySelectorAll('input[name="cobra_iva"]');
const datosFiscales = document.getElementById('datos-fiscales');
const camposFiscales = datosFiscales.querySelectorAll('input');

function actualizarDatosFiscales() {
    const cobraIva = document.querySelector('input[name="cobra_iva"]:checked')?.value === '1'; // ?. por si todavía no eligió ninguno
    datosFiscales.hidden = !cobraIva;
    for (const campo of camposFiscales) {
        campo.required = cobraIva; // un input oculto con required bloquearía el envío del formulario, por eso se apaga
        if (!cobraIva) {
            campo.value = ''; // si se arrepiente y elige "No", no queda nada cargado
        }
    }
}

for (const radio of radiosCobraIva) {
    radio.addEventListener('change', actualizarDatosFiscales);
}
actualizarDatosFiscales(); // por si el navegador recuerda lo que estaba elegido al recargar la página
