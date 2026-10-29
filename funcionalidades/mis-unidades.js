// "Mis hospedajes" del propietario (vistas/homes/index-propietario.html).
// Pide al backend las unidades del propietario y arma una tarjeta por cada una, copiando el <template> de la página:
// la foto principal, el nombre, la localidad, el estado (y qué le falta para publicarse), quién la gestiona,
// el depósito y el enlace para configurarla. La página la protege proteger-pagina.js (solo propietarios).

const estadoCarga = document.getElementById('estado-carga');

// Un elemento de la tarjeta por su data-campo
function campo(tarjeta, nombre) {
    return tarjeta.querySelector(`[data-campo="${nombre}"]`);
}

// Arma la tarjeta de una unidad a partir de la plantilla. Todo lo que escribió el propietario va con textContent.
function armarTarjeta(unidad) {
    const tarjeta = document.getElementById('plantilla-unidad').content.cloneNode(true);

    if (unidad.foto_principal !== null) {
        const foto = campo(tarjeta, 'foto');
        foto.src = fotoConAncho(unidad.foto_principal, 600);
        foto.alt = `Foto de ${unidad.nombre}`;
        campo(tarjeta, 'sin-fotos').remove();
    } else {
        campo(tarjeta, 'foto').remove();
    }

    campo(tarjeta, 'nombre').textContent = unidad.nombre;
    const estado = campo(tarjeta, 'estado');
    estado.textContent = NOMBRES_DE_ESTADO[unidad.estado_publicacion] ?? unidad.estado_publicacion;
    estado.classList.add(unidad.estado_publicacion === 'publicada' ? 'estado-publicada' : 'estado-no-publicada');
    campo(tarjeta, 'ubicacion').textContent = `${unidad.localidad}, ${unidad.provincia}`;

    if (unidad.disponible) {   // fuera de servicio por un daño (Épica 8)
        campo(tarjeta, 'no-disponible').remove();
    }

    // por qué no está publicada (solo importa mientras no lo está)
    if (unidad.faltantes.length > 0 && unidad.estado_publicacion !== 'publicada') {
        const lista = campo(tarjeta, 'lista-faltantes');
        for (const faltante of unidad.faltantes) {
            const item = document.createElement('li');
            item.textContent = faltante;
            lista.appendChild(item);
        }
    } else {
        campo(tarjeta, 'faltantes').remove();
    }

    campo(tarjeta, 'gestion').textContent = unidad.administrador === null
        ? 'Autogestión'
        : `${unidad.administrador.nombre}, con una comisión del ${Number(unidad.administrador.porcentaje_comision).toLocaleString('es-AR')} %`;
    campo(tarjeta, 'deposito').textContent = unidad.deposito_garantia === null
        ? 'Sin depósito'
        : formatearPrecio(unidad.deposito_garantia);

    // el nombre oculto completa el enlace para el lector de pantalla: "Configurar Cabaña del Mar"
    campo(tarjeta, 'configurar').href = `../unidades/configurar-unidad.html?id=${unidad.id}`;
    campo(tarjeta, 'nombre-oculto').textContent = ` ${unidad.nombre}`;

    return tarjeta;
}

// Pide las unidades al backend y las muestra (o el aviso de que todavía no tiene ninguna)
async function cargarUnidades() {
    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await pedirAlBack('/unidades/mias'));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        estadoCarga.textContent = '';
        document.getElementById('mensaje-error').textContent = MENSAJE_SIN_CONEXION;
        return;
    }
    estadoCarga.textContent = '';
    if (!respuesta.ok) {   // sin sesión u otro rol: proteger-pagina.js ya lo está llevando a otra página
        document.getElementById('mensaje-error').textContent = resultado.error;
        return;
    }

    if (resultado.unidades.length === 0) {
        document.getElementById('sin-unidades').hidden = false;
        return;
    }
    const lista = document.getElementById('lista-unidades');
    for (const unidad of resultado.unidades) {
        lista.appendChild(armarTarjeta(unidad));
    }
}

cargarUnidades();
