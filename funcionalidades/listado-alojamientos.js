// Los alojamientos disponibles para una búsqueda (vistas/alojamientos/listado.html), US3.2.
// Lee la búsqueda de la URL, llama a GET /buscar y muestra una tarjeta por alojamiento con el precio final.
// Es pública: con sesión arma el menú del usuario; sin sesión muestra "Iniciar sesión" y "Registrarme".

const resumen = document.getElementById('resumen-busqueda');

// Una tarjeta de resultado: la foto, el nombre (enlace al detalle, con la misma búsqueda), dónde queda,
// para cuántas personas y el precio final de toda la estadía
function crearTarjeta(unidad, parametros) {
    const item = document.createElement('li');
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta';

    if (unidad.foto_principal !== null) {
        const foto = document.createElement('img');
        foto.src = fotoConAncho(unidad.foto_principal, 600);
        foto.alt = `Foto de ${unidad.nombre}`;
        foto.loading = 'lazy';   // las fotos de más abajo se cargan recién cuando se acercan a la pantalla
        tarjeta.appendChild(foto);
    }

    const titulo = document.createElement('h3');
    const enlace = document.createElement('a');
    const busqueda = new URLSearchParams({
        id: unidad.id, ingreso: parametros.get('ingreso'), egreso: parametros.get('egreso'),
        personas: parametros.get('personas'), localidad_id: parametros.get('localidad_id') ?? '',   // para volver a esta misma búsqueda
    });
    enlace.href = `detalle.html?${busqueda}`;
    enlace.textContent = unidad.nombre;
    titulo.appendChild(enlace);

    const lugar = document.createElement('p');
    lugar.textContent = `${unidad.localidad}, ${unidad.provincia} · Hasta ${unidad.capacidad} ${unidad.capacidad === 1 ? 'persona' : 'personas'}`;

    const precio = document.createElement('p');
    precio.className = 'precio';
    const total = document.createElement('strong');
    total.textContent = formatearPrecio(unidad.precio_total);
    precio.append(total, ` por ${unidad.noches} ${unidad.noches === 1 ? 'noche' : 'noches'}, precio final`);

    tarjeta.append(titulo, lugar, precio);
    item.appendChild(tarjeta);
    return item;
}

// Busca con lo que vino en la URL y dibuja los resultados (o por qué no hay)
async function buscar() {
    const parametros = new URLSearchParams(window.location.search);
    if (!parametros.get('ingreso') || !parametros.get('egreso')) {
        resumen.textContent = 'Elegí las fechas de ingreso y de egreso para ver qué alojamientos hay disponibles.';
        return;
    }

    const busqueda = new URLSearchParams({
        localidad_id: parametros.get('localidad_id') ?? '',
        ingreso: parametros.get('ingreso'),
        egreso: parametros.get('egreso'),
        personas: parametros.get('personas') ?? '',
    });
    resumen.textContent = 'Buscando…';

    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await pedirAlBack(`/buscar?${busqueda}`));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        resumen.textContent = MENSAJE_SIN_CONEXION;
        return;
    }
    if (!respuesta.ok) {   // 422: una fecha pasada, demasiadas noches, etc.
        resumen.textContent = resultado.error;
        return;
    }

    const lista = document.getElementById('resultados');
    lista.replaceChildren(...resultado.unidades.map((unidad) => crearTarjeta(unidad, parametros)));

    const cantidad = resultado.unidades.length;
    const fechas = `del ${formatearFecha(parametros.get('ingreso'))} al ${formatearFecha(parametros.get('egreso'))}`;
    resumen.textContent = cantidad === 0
        ? `No hay alojamientos disponibles ${fechas}. Probá con otras fechas o con otro destino.`
        : `${cantidad} ${cantidad === 1 ? 'alojamiento disponible' : 'alojamientos disponibles'} ${fechas} para ${parametros.get('personas')} ${parametros.get('personas') === '1' ? 'persona' : 'personas'}.`;
}

armarEncabezadoPublico();   // unidades-comun.js
prepararBusqueda();
buscar();
