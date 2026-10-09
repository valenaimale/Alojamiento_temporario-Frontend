// Alojamientos de ejemplo, para poder armar el listado y la navegación del huésped.
// Cuando esté la épica de alojamientos, esta lista se reemplaza por un fetch al back.
const ALOJAMIENTOS = [
    { id: 1, titulo: 'Cabaña - Las Grutas', localidad: 'Las Grutas', precio: 70000, nochesMinimas: 7 },
    { id: 2, titulo: 'Departamento - Villa Gesell', localidad: 'Villa Gesell', precio: 100000, nochesMinimas: 10 },
    { id: 3, titulo: 'Casa - Villa Gesell', localidad: 'Villa Gesell', precio: 120000, nochesMinimas: 5 },
];

const parametros = new URLSearchParams(window.location.search); // lo que viene después del ? en la URL

// Listado: se usa en el inicio del huésped y en alojamientos/listado.html.
// Si la URL trae ?localidad=..., muestra solo los de esa localidad. Las fechas todavía no se usan.
function mostrarListado(grilla) {
    const localidad = parametros.get('localidad');
    let lista = ALOJAMIENTOS;
    if (localidad) {
        lista = ALOJAMIENTOS.filter((alojamiento) => alojamiento.localidad === localidad);
        document.getElementById('localidad').value = localidad; // deja elegida en el select la localidad buscada
    }

    for (const alojamiento of lista) {
        grilla.insertAdjacentHTML('beforeend', `
            <article class="tarjeta">
                <a href="../alojamientos/detalle.html?id=${alojamiento.id}">
                    <h3>${alojamiento.titulo}</h3>
                    <strong><data value="${alojamiento.precio}">$${alojamiento.precio.toLocaleString('es-AR')}</data></strong>
                    <p>${alojamiento.nochesMinimas} noches min</p>
                </a>
            </article>`);
    }
    if (lista.length === 0) {
        grilla.insertAdjacentHTML('beforeend', '<p>No hay alojamientos en esa localidad.</p>');
    }
}

// Detalle: busca el alojamiento por el id que viene en la URL (detalle.html?id=2).
function mostrarDetalle() {
    const id = Number(parametros.get('id'));
    const alojamiento = ALOJAMIENTOS.find((a) => a.id === id);
    if (!alojamiento) {
        document.getElementById('detalle-titulo').textContent = 'No encontramos ese alojamiento';
        return;
    }
    document.getElementById('detalle-titulo').textContent = alojamiento.titulo;
    document.getElementById('detalle-localidad').textContent = alojamiento.localidad;
    document.getElementById('detalle-precio').textContent = `$${alojamiento.precio.toLocaleString('es-AR')}`;
    document.getElementById('detalle-noches').textContent = `${alojamiento.nochesMinimas} noches min`;
}

// Este archivo se usa en tres páginas: según lo que haya en la página, arma el listado o el detalle.
const grilla = document.getElementById('grilla-alojamientos');
if (grilla) {
    mostrarListado(grilla);
}
if (document.getElementById('detalle-alojamiento')) {
    mostrarDetalle();
}
