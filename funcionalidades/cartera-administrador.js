// La cartera del administrador (vistas/homes/index-administrador.html), US2.5.
// Pide GET /administrador/unidades y arma una fila por unidad: nombre y localidad, propietario, estado, comisión y "Gestionar".
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).

// Una celda con su texto (textContent: los datos nunca se interpretan como HTML)
function celdaConTexto(texto) {
    const celda = document.createElement('td');
    celda.textContent = texto;
    return celda;
}

// Un badge de estado: <span class="estado ...">texto</span>
function badgeDeEstado(texto, clase) {
    const badge = document.createElement('span');
    badge.className = `estado ${clase}`;
    badge.textContent = texto;
    return badge;
}

// La fila de una unidad. El nombre es el encabezado de la fila (th scope="row"):
// el lector de pantalla lo anuncia al recorrer cada celda.
function armarFila(unidad) {
    const fila = document.createElement('tr');

    const encabezado = document.createElement('th');
    encabezado.scope = 'row';
    encabezado.textContent = unidad.nombre;
    const localidad = document.createElement('span');
    localidad.className = 'localidad';
    localidad.textContent = `${unidad.localidad}, ${unidad.provincia}`;
    encabezado.appendChild(localidad);
    fila.appendChild(encabezado);

    fila.appendChild(celdaConTexto(unidad.propietario));

    const celdaEstado = document.createElement('td');
    const estados = document.createElement('span');
    estados.className = 'estados';
    const clase = unidad.estado_publicacion === 'publicada' ? 'estado-publicada' : 'estado-no-publicada';
    estados.appendChild(badgeDeEstado(NOMBRES_DE_ESTADO[unidad.estado_publicacion] ?? unidad.estado_publicacion, clase));
    if (!unidad.disponible) {
        estados.appendChild(badgeDeEstado('No disponible', 'estado-no-disponible'));
    }
    celdaEstado.appendChild(estados);
    fila.appendChild(celdaEstado);

    fila.appendChild(celdaConTexto(formatearPorcentaje(unidad.porcentaje_comision)));

    // "Gestionar" lleva el nombre oculto, así el enlace se entiende solo ("Gestionar Casa del Bosque")
    const celdaAccion = document.createElement('td');
    const enlace = document.createElement('a');
    enlace.href = `../unidades/configurar-unidad.html?id=${unidad.id}`;
    enlace.className = 'boton boton-outline';
    enlace.textContent = 'Gestionar';
    const nombreOculto = document.createElement('span');
    nombreOculto.className = 'visualmente-oculto';
    nombreOculto.textContent = ` ${unidad.nombre}`;
    enlace.appendChild(nombreOculto);
    celdaAccion.appendChild(enlace);
    fila.appendChild(celdaAccion);

    return fila;
}

// Pide la cartera y la muestra: la tabla, o el aviso de que todavía no tiene unidades
async function cargarCartera() {
    const resumen = document.getElementById('resumen-cartera');
    let unidades;
    try {
        const { respuesta, resultado } = await pedirAlBack('/administrador/unidades');
        if (!respuesta.ok) {   // 401 o 403: proteger-pagina.js ya está redirigiendo
            return;
        }
        unidades = resultado.unidades;
    } catch (error) {
        console.error('No se pudo cargar la cartera:', error);
        resumen.textContent = '';
        document.getElementById('mensaje-error').textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    resumen.textContent = unidades.length === 1 ? '1 unidad a cargo' : `${unidades.length} unidades a cargo`;
    if (unidades.length === 0) {
        document.getElementById('cartera-vacia').hidden = false;
        return;
    }
    const filas = document.getElementById('filas-cartera');
    for (const unidad of unidades) {
        filas.appendChild(armarFila(unidad));
    }
    document.getElementById('tabla-cartera').hidden = false;
}

cargarCartera();
