// Temporadas y precios por noche de una unidad (vistas/unidades/temporadas-unidad.html?id=5), US2.7 y US2.9.
// - Temporadas: lista, crear, editar (el mismo formulario) y borrar, con GET/POST /unidades/temporadas...
// - Precios: un calendario por mes (GET /unidades/precios) y el formulario para cargar el precio de un rango.
// Solo es del propietario: si entra otro usuario, el backend responde 403 o 404 y se muestra ese mensaje.

const NOMBRES_DE_TEMPORADA = { alta: 'Alta', media: 'Media', baja: 'Baja' };

const formTemporada = document.getElementById('form-temporada');
const formPrecio = document.getElementById('form-precio');
let idUnidad = null;
let temporadaEnEdicion = null;   // la temporada que se está editando, o null si el formulario es para crear una nueva
let mesMostrado = null;          // el primer día del mes que muestra el calendario

// ---------- utilidades ----------

// Una fecha de JavaScript como "AAAA-MM-DD", con la fecha local (la del usuario, en Argentina)
function fechaATexto(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

// La fecha de hoy como "AAAA-MM-DD"
function hoyATexto() {
    return fechaATexto(new Date());
}

// Un precio corto para las celdas del calendario: 70000 → "$ 70.000" (sin centavos, para que entre)
function precioCorto(monto) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(monto));
}

// Muestra un error en lugar de la página (sin conexión, unidad inexistente o ajena)
function mostrarErrorPagina(texto) {
    document.getElementById('mensaje-error').textContent = texto;
    document.body.hidden = false;
}

// Manda un POST con JSON al backend. Devuelve { respuesta, resultado }, o null si el backend no respondió
// (en ese caso ya mostró el aviso en el elemento de error que se le pasa).
async function enviar(ruta, datos, elementoError) {
    try {
        return await pedirAlBack(ruta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unidad_id: idUnidad, ...datos }),
        });
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        elementoError.textContent = MENSAJE_SIN_CONEXION;
        return null;
    }
}

// Borra los mensajes de error y de éxito de un formulario
function limpiarMensajes(...ids) {
    for (const id of ids) {
        document.getElementById(id).textContent = '';
    }
}

// ---------- temporadas ----------

// Pide las temporadas al backend y las dibuja. Lanza el error si el backend no responde.
async function cargarTemporadas() {
    const { respuesta, resultado } = await pedirAlBack(`/unidades/temporadas?id=${encodeURIComponent(idUnidad)}`);
    if (!respuesta.ok) {
        throw new Error(resultado.error);
    }
    dibujarTemporadas(resultado.temporadas);
}

// Dibuja la lista de temporadas: cada una con sus fechas, su mínimo y sus tres acciones
function dibujarTemporadas(temporadas) {
    const lista = document.getElementById('lista-temporadas');
    lista.replaceChildren();
    document.getElementById('sin-temporadas').hidden = temporadas.length > 0;

    for (const temporada of temporadas) {
        const descripcion = `temporada ${temporada.nombre} del ${formatearFecha(temporada.fecha_inicio)} al ${formatearFecha(temporada.fecha_fin)}`;
        const item = document.createElement('li');

        const titulo = document.createElement('h3');
        titulo.textContent = `Temporada ${temporada.nombre}`;
        const detalle = document.createElement('p');
        const noches = temporada.minimo_noches === 1 ? '1 noche' : `${temporada.minimo_noches} noches`;
        detalle.textContent = `Del ${formatearFecha(temporada.fecha_inicio)} al ${formatearFecha(temporada.fecha_fin)} · Mínimo ${noches}`;
        item.append(titulo, detalle);

        // los botones dicen de qué temporada son, para que se entiendan fuera de contexto (lector de pantalla).
        // El nombre accesible empieza con el texto visible: así quien usa control por voz puede decir "Editar".
        item.append(
            crearBoton('Editar', `Editar la ${descripcion}`, () => empezarEdicion(temporada)),
            crearBoton('Cargar precio para estas fechas', `Cargar precio para estas fechas: ${descripcion}`, () => usarFechasDeTemporada(temporada)),
            crearBoton('Borrar', `Borrar la ${descripcion}`, () => borrarTemporada(temporada, descripcion)),
        );
        lista.appendChild(item);
    }
}

// Un botón con su texto visible, su nombre completo para el lector de pantalla y lo que hace al tocarlo
function crearBoton(texto, nombreAccesible, alTocar) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton boton-outline';
    boton.textContent = texto;
    boton.setAttribute('aria-label', nombreAccesible);
    boton.addEventListener('click', alTocar);
    return boton;
}

// Pasa el formulario a "editar esta temporada": lo llena con sus datos y lleva el foco ahí
function empezarEdicion(temporada) {
    temporadaEnEdicion = temporada;
    limpiarMensajes('error-temporada', 'ok-temporada');
    formTemporada.elements.nombre.value = temporada.nombre;
    formTemporada.elements.fecha_inicio.value = temporada.fecha_inicio;
    formTemporada.elements.fecha_fin.value = temporada.fecha_fin;
    formTemporada.elements.minimo_noches.value = temporada.minimo_noches;
    document.getElementById('titulo-form-temporada').textContent = `Editar la temporada ${temporada.nombre}`;
    document.getElementById('guardar-temporada').textContent = 'Guardar los cambios';
    document.getElementById('cancelar-edicion').hidden = false;
    formTemporada.elements.nombre.focus();
}

// Vuelve el formulario a "nueva temporada", vacío
function terminarEdicion() {
    temporadaEnEdicion = null;
    formTemporada.reset();
    document.getElementById('titulo-form-temporada').textContent = 'Nueva temporada';
    document.getElementById('guardar-temporada').textContent = 'Crear la temporada';
    document.getElementById('cancelar-edicion').hidden = true;
}

// Crea o edita la temporada del formulario. Si se superpone con otra, el backend dice con cuál.
async function guardarTemporada(evento) {
    evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros
    limpiarMensajes('error-temporada', 'ok-temporada');
    const errorTemporada = document.getElementById('error-temporada');

    const datos = Object.fromEntries(new FormData(formTemporada));   // {nombre, fecha_inicio, fecha_fin, minimo_noches}
    const ruta = temporadaEnEdicion === null ? '/unidades/temporadas/crear' : '/unidades/temporadas/editar';
    if (temporadaEnEdicion !== null) {
        datos.temporada_id = temporadaEnEdicion.id;
    }

    const envio = await enviar(ruta, datos, errorTemporada);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        errorTemporada.textContent = envio.resultado.error;
        return;
    }

    terminarEdicion();
    document.getElementById('ok-temporada').textContent = envio.resultado.ok;
    await recargar(errorTemporada);   // la temporada cambia la lista y el calendario
}

// Borra una temporada, después de confirmarlo
async function borrarTemporada(temporada, descripcion) {
    if (!confirm(`¿Borrar la ${descripcion}? Esas noches van a quedar sin mínimo de noches (mínimo 1).`)) {
        return;
    }
    limpiarMensajes('error-temporada', 'ok-temporada');
    const errorTemporada = document.getElementById('error-temporada');

    const envio = await enviar('/unidades/temporadas/borrar', { temporada_id: temporada.id }, errorTemporada);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        errorTemporada.textContent = envio.resultado.error;
        return;
    }

    if (temporadaEnEdicion?.id === temporada.id) {   // si justo la estaba editando
        terminarEdicion();
    }
    document.getElementById('ok-temporada').textContent = envio.resultado.ok;
    await recargar(errorTemporada);
    document.getElementById('titulo-temporadas').focus();   // el botón que tenía el foco ya no existe
}

// "Cargar precio para estas fechas": completa el rango del formulario de precios con las noches de la temporada
// (desde hoy, si la temporada ya empezó) y lleva el foco al precio
function usarFechasDeTemporada(temporada) {
    const hoy = hoyATexto();
    formPrecio.elements.desde.value = temporada.fecha_inicio < hoy ? hoy : temporada.fecha_inicio;   // AAAA-MM-DD se compara como texto
    formPrecio.elements.hasta.value = temporada.fecha_fin;
    limpiarMensajes('error-precio', 'ok-precio');
    formPrecio.elements.precio.focus();
}

// ---------- precios y calendario ----------

// Pide los precios del mes que se muestra y dibuja el calendario. Lanza el error si el backend no responde.
async function cargarCalendario() {
    const desde = fechaATexto(mesMostrado);
    const hasta = fechaATexto(new Date(mesMostrado.getFullYear(), mesMostrado.getMonth() + 1, 0));   // el día 0 del mes siguiente = el último de este
    const { respuesta, resultado } = await pedirAlBack(
        `/unidades/precios?id=${encodeURIComponent(idUnidad)}&desde=${desde}&hasta=${hasta}`
    );
    if (!respuesta.ok) {
        throw new Error(resultado.error);
    }

    document.getElementById('aclaracion-iva').hidden = !resultado.cobra_iva;
    const nombreDelMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(mesMostrado);
    document.getElementById('titulo-mes').textContent = nombreDelMes.charAt(0).toUpperCase() + nombreDelMes.slice(1);   // "Diciembre de 2026"
    dibujarCalendario(resultado.noches);
}

// Dibuja el mes como una tabla de 7 columnas (de lunes a domingo): cada celda, el día, su precio y su temporada
function dibujarCalendario(noches) {
    const cuerpo = document.getElementById('dias-del-mes');
    cuerpo.replaceChildren();
    const hoy = hoyATexto();

    let fila = document.createElement('tr');
    const huecosAlPrincipio = (mesMostrado.getDay() + 6) % 7;   // getDay(): 0 = domingo; la semana empieza el lunes
    for (let i = 0; i < huecosAlPrincipio; i++) {
        fila.appendChild(document.createElement('td'));
    }

    for (const noche of noches) {
        const celda = document.createElement('td');
        if (noche.fecha < hoy) {
            celda.classList.add('pasada');
        }
        if (noche.fecha === hoy) {
            celda.setAttribute('aria-current', 'date');   // el lector de pantalla anuncia que es hoy
        }

        const dia = document.createElement('span');
        dia.className = 'dia';
        dia.textContent = Number(noche.fecha.slice(8));   // "2026-12-05" → 5
        const precio = document.createElement('span');
        precio.className = noche.precio === null ? 'precio sin-precio' : 'precio';
        precio.textContent = noche.precio === null ? 'Sin precio' : precioCorto(noche.precio);
        celda.append(dia, precio);

        if (noche.temporada !== null) {
            const temporada = document.createElement('span');
            temporada.className = `temporada temporada-${noche.temporada}`;
            temporada.textContent = `${NOMBRES_DE_TEMPORADA[noche.temporada]} · mín. ${noche.minimo_noches}`;
            celda.appendChild(temporada);
        }

        fila.appendChild(celda);
        if (fila.children.length === 7) {   // terminó la semana
            cuerpo.appendChild(fila);
            fila = document.createElement('tr');
        }
    }
    if (fila.children.length > 0) {   // la última semana, completada con celdas vacías
        while (fila.children.length < 7) {
            fila.appendChild(document.createElement('td'));
        }
        cuerpo.appendChild(fila);
    }
}

// Muestra el mes anterior (-1) o el siguiente (+1)
async function cambiarMes(desplazamiento) {
    mesMostrado = new Date(mesMostrado.getFullYear(), mesMostrado.getMonth() + desplazamiento, 1);
    const errorCalendario = document.getElementById('error-calendario');
    errorCalendario.textContent = '';
    try {
        await cargarCalendario();
    } catch (error) {
        console.error('No se pudo cargar el calendario:', error);
        errorCalendario.textContent = MENSAJE_SIN_CONEXION;
    }
}

// Carga el mismo precio para todas las noches del rango, y muestra en el calendario el mes donde empieza
async function cargarPrecio(evento) {
    evento.preventDefault();
    limpiarMensajes('error-precio', 'ok-precio');
    const errorPrecio = document.getElementById('error-precio');

    const datos = Object.fromEntries(new FormData(formPrecio));   // {desde, hasta, precio}
    const envio = await enviar('/unidades/precios/cargar', datos, errorPrecio);
    if (envio === null) {
        return;
    }
    if (!envio.respuesta.ok) {
        errorPrecio.textContent = envio.resultado.error;
        return;
    }

    document.getElementById('ok-precio').textContent = envio.resultado.ok;
    const [anio, mes] = datos.desde.split('-').map(Number);
    mesMostrado = new Date(anio, mes - 1, 1);
    await recargar(errorPrecio);
}

// Vuelve a pedir las temporadas y el calendario (después de un cambio). Si el backend no responde, lo dice en ese elemento.
async function recargar(elementoError) {
    try {
        await Promise.all([cargarTemporadas(), cargarCalendario()]);
    } catch (error) {
        console.error('No se pudo recargar:', error);
        elementoError.textContent = MENSAJE_SIN_CONEXION;
    }
}

// ---------- arranque ----------

// Arma la página: controla la sesión, arma el menú y pide el nombre de la unidad, sus temporadas y los precios del mes
async function cargarPagina() {
    let usuario;
    try {
        usuario = await obtenerSesion();
    } catch (error) {
        mostrarPantallaSinConexion(error);
        return;
    }
    if (usuario === null) {   // sin sesión: al login
        window.location.href = '../sesion/inicio-sesion.html';
        return;
    }
    armarMenu(usuario.rol);

    idUnidad = idUnidadDeLaUrl();
    if (idUnidad === null) {
        mostrarErrorPagina('No encontramos esa unidad.');
        return;
    }
    document.getElementById('enlace-volver').href = `configurar-unidad.html?id=${idUnidad}`;
    const hoy = new Date();
    mesMostrado = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    let resumen;
    try {
        resumen = await obtenerResumenUnidad(idUnidad);
        if (!resumen.respuesta.ok) {
            mostrarErrorPagina(resumen.resultado.error);
            return;
        }
        await Promise.all([cargarTemporadas(), cargarCalendario()]);
    } catch (error) {   // sin conexión, o el backend respondió un error (el administrador recibe 403)
        console.error('No se pudo cargar la página:', error);
        mostrarErrorPagina(error instanceof TypeError ? MENSAJE_SIN_CONEXION : error.message);
        return;
    }

    const unidad = resumen.resultado.unidad;
    document.title = `Temporadas y precios de ${unidad.nombre}`;
    document.getElementById('nombre-unidad').textContent = `${unidad.nombre} · ${unidad.localidad}, ${unidad.provincia}`;

    // no se cargan temporadas que ya terminaron ni precios de noches pasadas
    formTemporada.elements.fecha_fin.min = hoyATexto();
    formPrecio.elements.desde.min = hoyATexto();
    formPrecio.elements.hasta.min = hoyATexto();

    formTemporada.addEventListener('submit', guardarTemporada);
    document.getElementById('cancelar-edicion').addEventListener('click', () => {
        terminarEdicion();
        limpiarMensajes('error-temporada', 'ok-temporada');
        formTemporada.elements.nombre.focus();
    });
    formPrecio.addEventListener('submit', cargarPrecio);
    document.getElementById('mes-anterior').addEventListener('click', () => cambiarMes(-1));
    document.getElementById('mes-siguiente').addEventListener('click', () => cambiarMes(1));

    document.getElementById('contenido').hidden = false;
    document.body.hidden = false;
}

cargarPagina();
