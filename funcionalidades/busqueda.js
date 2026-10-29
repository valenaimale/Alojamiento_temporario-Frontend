// El formulario de búsqueda de alojamientos (US3.2), que comparten los dos inicios (con y sin sesión) y el listado.
// El formulario manda la búsqueda a vistas/alojamientos/listado.html por GET, sin JavaScript: así queda en la URL
// (se puede volver atrás o compartir el enlace). Este archivo solo lo prepara: las localidades, las fechas mínimas,
// lo que ya se había buscado y el control de que el egreso sea posterior al ingreso.
// Se incluye después de sesion.js y unidades-comun.js.

// Una fecha de JavaScript como "AAAA-MM-DD", con la fecha local (la del usuario, en Argentina)
function fechaATextoBusqueda(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// "AAAA-MM-DD" más esa cantidad de días, otra vez como "AAAA-MM-DD"
function sumarDias(texto, dias) {
    const [anio, mes, dia] = texto.split('-').map(Number);
    return fechaATextoBusqueda(new Date(anio, mes - 1, dia + dias));
}

// El egreso tiene que ser al menos el día siguiente al ingreso: ajusta el mínimo del egreso y, si ya no sirve, lo borra
function ajustarEgreso(formulario) {
    const { ingreso, egreso } = formulario.elements;
    const manana = sumarDias(fechaATextoBusqueda(new Date()), 1);
    egreso.min = sumarDias(ingreso.value || manana, 1);
    if (egreso.value !== '' && egreso.value < egreso.min) {   // AAAA-MM-DD se compara como texto
        egreso.value = '';
    }
}

// Prepara el formulario de búsqueda de la página (#form-busqueda): carga los destinos, fija las fechas mínimas
// (el ingreso es de mañana en adelante: hoy ya no se reserva) y lo completa con la búsqueda que vino en la URL.
async function prepararBusqueda() {
    const formulario = document.getElementById('form-busqueda');
    const parametros = new URLSearchParams(window.location.search);
    const { localidad_id: destino, ingreso, egreso, personas } = formulario.elements;

    ingreso.min = sumarDias(fechaATextoBusqueda(new Date()), 1);
    ingreso.value = parametros.get('ingreso') ?? '';
    egreso.value = parametros.get('egreso') ?? '';
    personas.value = parametros.get('personas') ?? personas.value;
    ajustarEgreso(formulario);
    ingreso.addEventListener('change', () => ajustarEgreso(formulario));

    // el navegador ya controla los campos obligatorios y los mínimos; esto cubre los navegadores que no lo hacen
    formulario.addEventListener('submit', (evento) => {
        const error = document.getElementById('error-busqueda');
        error.textContent = '';
        if (egreso.value !== '' && egreso.value <= ingreso.value) {
            evento.preventDefault();
            error.textContent = 'El egreso tiene que ser posterior al ingreso.';
            egreso.focus();
        }
    });

    try {
        const seleccionada = Number(parametros.get('localidad_id')) || null;
        await cargarLocalidades(destino, seleccionada);
    } catch (error) {   // sin las localidades se puede buscar igual, en todos los destinos
        console.error('No se pudieron cargar las localidades:', error);
    }
    destino.options[0].textContent = 'Todos los destinos';   // la primera opción (vacía) = buscar en todos
}
