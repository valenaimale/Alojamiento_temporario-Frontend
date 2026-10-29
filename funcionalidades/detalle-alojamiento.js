// El detalle de un alojamiento para el huésped (vistas/alojamientos/detalle.html?id=1&ingreso=...&egreso=...&personas=2), US3.2.
// - Los datos: GET /alojamiento (sin la dirección, que se da al reservar).
// - El calendario: GET /alojamiento/calendario, mes por mes. Las fechas se eligen tocando el calendario: solo se puede
//   elegir como ingreso (o como noche de la estadía) una noche libre. El egreso no es una noche, así que puede caer
//   en una noche ocupada, siempre que todas las noches anteriores estén libres.
// - Con las dos fechas, el precio total y la seña: GET /alojamiento con las fechas (el mismo cálculo que la búsqueda).
// - Reservar (Épica 4, sin pago todavía): POST /reservas/crear, aceptando la política de cancelación.
// Es pública: se ve con o sin sesión. Reservan el huésped y el propietario con el mail verificado.

const MAXIMO_NOCHES = 60;
const MESES_HACIA_ADELANTE = 24;   // el calendario se puede ver hasta dos años hacia adelante (como el backend)
const ROLES_QUE_RESERVAN = ['huesped', 'propietario'];   // el propietario también es huésped (como en el backend)
const fechaLarga = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

// Lo que el usuario está viendo y eligiendo
const estado = {
    id: null,
    usuario: null,     // el usuario logueado, o null sin sesión
    alojamiento: null,
    ingreso: null,     // "AAAA-MM-DD" o null
    egreso: null,      // "AAAA-MM-DD" o null
    mes: null,         // el primer día del mes que se muestra (Date)
    foco: null,        // la fecha que tiene el foco del teclado en el calendario
    meses: new Map(),  // "AAAA-MM" → Map("AAAA-MM-DD" → noche): los meses ya pedidos al backend
};

// ---------- fechas ----------

// Una fecha de JavaScript como "AAAA-MM-DD" (fecha local)
function fechaATexto(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// "AAAA-MM-DD" como fecha de JavaScript (a las 00:00 locales)
function textoAFecha(texto) {
    const [anio, mes, dia] = texto.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
}

// "AAAA-MM-DD" más esa cantidad de días
function sumarDias(texto, dias) {
    const fecha = textoAFecha(texto);
    fecha.setDate(fecha.getDate() + dias);
    return fechaATexto(fecha);
}

// Cuántas noches hay entre dos fechas "AAAA-MM-DD" (la segunda no es una noche)
function nochesEntre(desde, hasta) {
    return Math.round((textoAFecha(hasta) - textoAFecha(desde)) / 86400000);
}

// "2026-12-05" → "sábado, 5 de diciembre"
function fechaEnPalabras(texto) {
    return fechaLarga.format(textoAFecha(texto));
}

// ---------- calendario: datos ----------

// Pide al backend las noches de un mes ("AAAA-MM"), si todavía no las tiene. Lanza el error si no responde.
async function cargarMes(clave) {
    if (estado.meses.has(clave)) {
        return;
    }
    const { respuesta, resultado } = await pedirAlBack(`/alojamiento/calendario?id=${encodeURIComponent(estado.id)}&mes=${clave}`);
    if (!respuesta.ok) {
        throw new Error(resultado.error);
    }
    estado.meses.set(clave, new Map(resultado.noches.map((noche) => [noche.fecha, noche])));
}

// Se asegura de tener todos los meses entre dos fechas (para controlar una estadía que cruza meses)
async function cargarMesesEntre(desde, hasta) {
    for (let mes = desde.slice(0, 7); mes <= hasta.slice(0, 7); mes = sumarDias(`${mes}-01`, 32).slice(0, 7)) {
        await cargarMes(mes);
    }
}

// La noche de esa fecha ({fecha, estado, precio, minimo_noches}), o null si su mes todavía no se pidió
function noche(fecha) {
    return estado.meses.get(fecha.slice(0, 7))?.get(fecha) ?? null;
}

// Si esa fecha puede ser el egreso: es posterior al ingreso, no pasa el máximo de noches,
// y todas las noches desde el ingreso hasta la anterior están libres (las de meses no pedidos se controlan al elegir)
function puedeSerEgreso(fecha) {
    if (estado.ingreso === null || estado.egreso !== null || fecha <= estado.ingreso) {
        return false;
    }
    if (nochesEntre(estado.ingreso, fecha) > MAXIMO_NOCHES) {
        return false;
    }
    for (let fechaNoche = estado.ingreso; fechaNoche < fecha; fechaNoche = sumarDias(fechaNoche, 1)) {
        const datos = noche(fechaNoche);
        if (datos !== null && datos.estado !== 'libre') {
            return false;
        }
    }
    return true;
}

// Si el egreso está limitado por una noche no disponible (mirando los meses ya pedidos), esa fecha: es el último
// día en que se puede salir (esa noche no se duerme). null si no hay un límite así a la vista.
function ultimoEgresoPorNocheNoDisponible() {
    for (let fecha = sumarDias(estado.ingreso, 1); nochesEntre(estado.ingreso, fecha) <= MAXIMO_NOCHES; fecha = sumarDias(fecha, 1)) {
        const datos = noche(fecha);
        if (datos === null) {
            return null;   // mes todavía no pedido: no se sabe
        }
        if (datos.estado !== 'libre') {
            return fecha;
        }
    }
    return null;
}

// Si esa fecha se puede tocar: como egreso (si ya hay ingreso), o como ingreso nuevo (si es una noche libre)
function sePuedeElegir(fecha) {
    return puedeSerEgreso(fecha) || noche(fecha)?.estado === 'libre';
}

// ---------- calendario: elegir ----------

// Toca una fecha: si puede ser el egreso, completa la estadía; si no, si es una noche libre, empieza una nueva
async function elegir(fecha) {
    const errorCalendario = document.getElementById('error-calendario');
    errorCalendario.textContent = '';
    estado.foco = fecha;

    if (puedeSerEgreso(fecha)) {
        try {
            await cargarMesesEntre(estado.ingreso, fecha);   // por si la estadía cruza meses que no se vieron
        } catch (error) {
            console.error('No se pudo cargar el calendario:', error);
            errorCalendario.textContent = MENSAJE_SIN_CONEXION;
            return;
        }
        if (puedeSerEgreso(fecha)) {
            estado.egreso = fecha;
            dibujarCalendario();
            enfocar(fecha);
            await calcularEstadia();
            return;
        }
    }

    if (noche(fecha)?.estado !== 'libre') {
        return;   // no disponible: no se puede elegir
    }
    estado.ingreso = fecha;
    estado.egreso = null;
    dibujarCalendario();
    enfocar(fecha);
    mostrarEstadia(null);
    // si el egreso tiene un límite por una noche ocupada, se explica: si no, parece raro poder tocar un día tachado
    const limite = ultimoEgresoPorNocheNoDisponible();
    document.getElementById('seleccion').textContent = limite === null
        ? `Ingreso: ${fechaEnPalabras(fecha)}. Ahora elegí el día de egreso.`
        : `Ingreso: ${fechaEnPalabras(fecha)}. Ahora elegí el día de egreso: como mucho el ${fechaEnPalabras(limite)}. Esa noche no está disponible, pero ese día podés salir.`;
}

// ---------- calendario: dibujo ----------

// El nombre de una fecha para el lector de pantalla: "sábado, 5 de diciembre, $ 70.000, disponible, ingreso"
function nombreAccesible(fecha, datos) {
    const partes = [fechaEnPalabras(fecha)];
    if (datos.estado === 'libre') {
        partes.push(formatearPrecio(datos.precio));
    }
    if (puedeSerEgreso(fecha)) {
        partes.push('se puede elegir como egreso');
    } else {
        partes.push(datos.estado === 'libre' ? 'disponible' : 'no disponible');
    }
    if (fecha === estado.ingreso) partes.push('ingreso elegido');
    if (fecha === estado.egreso) partes.push('egreso elegido');
    return partes.join(', ');
}

// Dibuja el mes que se muestra: una tabla de lunes a domingo, con un botón por día.
// Solo un botón está en el orden del Tab (el del foco); dentro del calendario se mueve con las flechas.
function dibujarCalendario() {
    const clave = fechaATexto(estado.mes).slice(0, 7);
    const noches = [...(estado.meses.get(clave)?.values() ?? [])];
    const cuerpo = document.getElementById('dias-del-mes');
    cuerpo.replaceChildren();

    const nombreDelMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(estado.mes);
    document.getElementById('titulo-mes').textContent = nombreDelMes.charAt(0).toUpperCase() + nombreDelMes.slice(1);
    const esteMes = new Date();
    document.getElementById('mes-anterior').disabled = estado.mes.getFullYear() === esteMes.getFullYear() && estado.mes.getMonth() === esteMes.getMonth();

    // el foco queda en la fecha elegida si es de este mes; si no, en el primer día que se pueda elegir (o el 1)
    if (estado.foco === null || estado.foco.slice(0, 7) !== clave) {
        estado.foco = noches.find((datos) => sePuedeElegir(datos.fecha))?.fecha ?? `${clave}-01`;
    }

    let fila = document.createElement('tr');
    for (let i = 0; i < (estado.mes.getDay() + 6) % 7; i++) {   // getDay(): 0 = domingo; la semana empieza el lunes
        fila.appendChild(document.createElement('td'));
    }
    for (const datos of noches) {
        const celda = document.createElement('td');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.dataset.fecha = datos.fecha;
        boton.tabIndex = datos.fecha === estado.foco ? 0 : -1;
        boton.setAttribute('aria-label', nombreAccesible(datos.fecha, datos));
        if (!sePuedeElegir(datos.fecha)) {
            boton.setAttribute('aria-disabled', 'true');   // sigue siendo enfocable, así el lector de pantalla dice "no disponible"
            boton.classList.add('no-disponible');
        }
        if (datos.fecha === estado.ingreso || datos.fecha === estado.egreso) {
            boton.classList.add('elegida');
        } else if (estado.ingreso && estado.egreso && datos.fecha > estado.ingreso && datos.fecha < estado.egreso) {
            boton.classList.add('en-rango');
        }

        const dia = document.createElement('span');
        dia.className = 'dia';
        dia.textContent = Number(datos.fecha.slice(8));
        boton.appendChild(dia);
        if (datos.estado === 'libre') {
            const precio = document.createElement('span');
            precio.className = 'precio';
            precio.textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(datos.precio));
            boton.appendChild(precio);
        }
        boton.addEventListener('click', () => {
            if (boton.getAttribute('aria-disabled') !== 'true') {
                elegir(datos.fecha);
            }
        });

        celda.appendChild(boton);
        fila.appendChild(celda);
        if (fila.children.length === 7) {
            cuerpo.appendChild(fila);
            fila = document.createElement('tr');
        }
    }
    if (fila.children.length > 0) {
        while (fila.children.length < 7) {
            fila.appendChild(document.createElement('td'));
        }
        cuerpo.appendChild(fila);
    }
}

// Muestra otro mes (desplazamiento: -1 el anterior, +1 el siguiente), dentro de lo que permite el backend
async function cambiarMes(desplazamiento) {
    const nuevo = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + desplazamiento, 1);
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + MESES_HACIA_ADELANTE, 1);
    if (nuevo < primero || nuevo > ultimo) {
        return false;
    }
    const errorCalendario = document.getElementById('error-calendario');
    errorCalendario.textContent = '';
    try {
        await cargarMes(fechaATexto(nuevo).slice(0, 7));
    } catch (error) {
        console.error('No se pudo cargar el calendario:', error);
        errorCalendario.textContent = MENSAJE_SIN_CONEXION;
        return false;
    }
    estado.mes = nuevo;
    dibujarCalendario();
    return true;
}

// Las flechas mueven el foco un día (izquierda, derecha) o una semana (arriba, abajo); si se pasa del mes, cambia de mes.
// Enter y Espacio eligen la fecha (lo hace el botón solo).
async function moverConTeclado(evento) {
    const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(evento.key in pasos) || !evento.target.dataset.fecha) {
        return;
    }
    evento.preventDefault();   // que las flechas no muevan la página
    const destino = sumarDias(evento.target.dataset.fecha, pasos[evento.key]);
    const mesDestino = destino.slice(0, 7);
    if (mesDestino !== fechaATexto(estado.mes).slice(0, 7)) {
        if (!(await cambiarMes(mesDestino > fechaATexto(estado.mes).slice(0, 7) ? 1 : -1))) {
            return;
        }
    }
    estado.foco = destino;
    dibujarCalendario();
    enfocar(destino);
}

// Pone el foco en el botón de esa fecha (al redibujar el calendario, los botones se reemplazan y el foco se perdería)
function enfocar(fecha) {
    document.querySelector(`#dias-del-mes button[data-fecha="${fecha}"]`)?.focus();
}

// ---------- la estadía ----------

// Pide al backend si se puede reservar la estadía elegida y cuánto sale, y lo muestra
async function calcularEstadia() {
    const seleccion = document.getElementById('seleccion');
    const personas = document.getElementById('personas').value;
    const busqueda = new URLSearchParams({ id: estado.id, ingreso: estado.ingreso, egreso: estado.egreso, personas });

    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await pedirAlBack(`/alojamiento?${busqueda}`));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        seleccion.textContent = MENSAJE_SIN_CONEXION;
        return;
    }
    if (!respuesta.ok) {   // 422: fechas o personas inválidas
        seleccion.textContent = resultado.error;
        mostrarEstadia(null);
        return;
    }

    // la URL queda con la estadía elegida: si se recarga o se comparte, se ve lo mismo
    history.replaceState(null, '', `?${busqueda}${localidadDeLaBusqueda()}`);
    actualizarEnlaceVolver();
    mostrarEstadia(resultado.estadia);
}

// Muestra el resultado de la estadía (o lo borra, con null): las noches, el total y la seña, o por qué no se puede.
// Si se puede, también el formulario para reservar (o por qué esta cuenta no puede).
function mostrarEstadia(estadia) {
    const seleccion = document.getElementById('seleccion');
    const detalle = document.getElementById('precio-estadia');
    const saldo = document.getElementById('aclaracion-saldo');
    detalle.hidden = true;
    saldo.hidden = true;
    document.getElementById('form-reservar').hidden = true;
    document.getElementById('aviso-reservar').hidden = true;
    document.getElementById('error-reserva').textContent = '';
    if (estadia === null) {
        if (estado.ingreso === null) {
            seleccion.textContent = 'Elegí las fechas en el calendario para ver el precio.';
        }
        return;
    }

    const fechas = `Del ${formatearFecha(estado.ingreso)} al ${formatearFecha(estado.egreso)}`;
    if (!estadia.disponible) {
        seleccion.textContent = `${fechas}: ${estadia.motivo}.`;
        return;
    }
    seleccion.textContent = `${fechas}: está disponible.`;
    document.getElementById('noches').textContent = estadia.noches;
    document.getElementById('precio-total').textContent = formatearPrecio(estadia.precio_total);
    document.getElementById('texto-sena').textContent = `Seña al reservar (${Number(estado.alojamiento.porcentaje_sena).toLocaleString('es-AR')} %)`;
    document.getElementById('sena').textContent = formatearPrecio(estadia.sena);
    saldo.textContent = `El resto se paga ${estado.alojamiento.politica.dias_cobro_saldo} días antes del ingreso.`;
    detalle.hidden = false;
    saldo.hidden = false;
    mostrarParaReservar();
}

// ---------- reservar ----------

// Con la estadía disponible: el formulario para reservar si esta cuenta puede, o por qué no puede.
// Sin sesión, el enlace para iniciarla vuelve a este mismo detalle con las mismas fechas.
function mostrarParaReservar() {
    const aviso = document.getElementById('aviso-reservar');
    const { usuario } = estado;

    if (usuario !== null && ROLES_QUE_RESERVAN.includes(usuario.rol) && usuario.mail_verificado) {
        document.getElementById('form-reservar').hidden = false;
        return;
    }

    aviso.replaceChildren();
    if (usuario === null) {
        const enlace = document.createElement('a');
        enlace.href = urlParaIniciarSesionYVolver();   // unidades-comun.js; la URL ya tiene las fechas elegidas
        enlace.textContent = 'Iniciá sesión';
        aviso.append(enlace, ' para reservar. Si todavía no tenés cuenta, registrate: es gratis.');
    } else if (!ROLES_QUE_RESERVAN.includes(usuario.rol)) {
        aviso.textContent = 'Las reservas se hacen con una cuenta de huésped.';
    } else {
        aviso.textContent = 'Para reservar tenés que verificar tu mail: entrá al enlace del mail que te mandamos al registrarte.';
    }
    aviso.hidden = false;
}

// Reserva la estadía elegida. Si sale bien, lleva a "Mis reservas"; si no, muestra el motivo.
// Si mientras tanto otro reservó esas noches (409), vuelve a pedir el calendario para que se vean ocupadas.
async function reservar(evento) {
    evento.preventDefault();   // frena el envío clásico del form: lo manejamos nosotros
    const formulario = evento.target;
    const errorReserva = document.getElementById('error-reserva');
    errorReserva.textContent = '';
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;   // evita reservar dos veces con un doble clic

    let respuesta;
    let resultado;
    try {
        ({ respuesta, resultado } = await pedirAlBack('/reservas/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unidad_id: estado.id,
                ingreso: estado.ingreso,
                egreso: estado.egreso,
                personas: Number(document.getElementById('personas').value),
                acepta_politica: formulario.elements.acepta_politica.checked,
            }),
        }));
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        errorReserva.textContent = MENSAJE_SIN_CONEXION;
        boton.disabled = false;
        return;
    }

    if (respuesta.ok) {
        window.location.href = '../reservas/mis-reservas.html?nueva=1';
        return;
    }
    boton.disabled = false;
    errorReserva.textContent = resultado.error;
    if (respuesta.status === 409) {
        estado.meses.clear();   // el calendario guardado ya no sirve: se pide de nuevo
        try {
            await cargarMes(fechaATexto(estado.mes).slice(0, 7));
            dibujarCalendario();
        } catch (error) {
            console.error('No se pudo cargar el calendario:', error);
        }
    }
}

// ---------- los datos del alojamiento ----------

// "&localidad_id=1" si la búsqueda tenía destino (para volver al mismo listado), o ""
function localidadDeLaBusqueda() {
    const localidad = new URLSearchParams(window.location.search).get('localidad_id');
    return localidad ? `&localidad_id=${encodeURIComponent(localidad)}` : '';
}

// "Volver a los resultados" lleva al listado con la misma búsqueda (si hay fechas)
function actualizarEnlaceVolver() {
    const enlace = document.getElementById('enlace-volver');
    if (estado.ingreso && estado.egreso) {
        const busqueda = new URLSearchParams({ ingreso: estado.ingreso, egreso: estado.egreso, personas: document.getElementById('personas').value });
        enlace.href = `listado.html?${busqueda}${localidadDeLaBusqueda()}`;
    }
}

// Llena la página con los datos del alojamiento: fotos, características, política y depósito
function mostrarAlojamiento(alojamiento) {
    document.title = alojamiento.nombre;
    document.getElementById('nombre').textContent = alojamiento.nombre;
    document.getElementById('ubicacion').textContent =
        `${alojamiento.localidad}, ${alojamiento.provincia} · Hasta ${alojamiento.capacidad} ${alojamiento.capacidad === 1 ? 'persona' : 'personas'}`;
    document.getElementById('personas').max = alojamiento.capacidad;

    const galeria = document.getElementById('galeria');
    alojamiento.fotos.forEach((url, indice) => {
        const item = document.createElement('li');
        const foto = document.createElement('img');
        foto.src = fotoConAncho(url, indice === 0 ? 1200 : 600);   // la principal, más grande
        foto.alt = `Foto ${indice + 1} de ${alojamiento.fotos.length} de ${alojamiento.nombre}`;
        foto.loading = indice === 0 ? 'eager' : 'lazy';
        item.appendChild(foto);
        galeria.appendChild(item);
    });

    if (alojamiento.caracteristicas) {
        document.getElementById('caracteristicas').textContent = alojamiento.caracteristicas;
    } else {
        document.getElementById('seccion-descripcion').remove();
    }

    const { politica } = alojamiento;
    document.getElementById('explicacion-politica').textContent =
        `Si cancelás la reserva, el propietario retiene un porcentaje del total, según cuántos días antes del cobro del saldo cancelás (el saldo se cobra ${politica.dias_cobro_saldo} días antes del ingreso).`;
    for (const [tramo, id] of [['retencion_mas_de_30', 'retencion-mas-de-30'], ['retencion_de_15_a_30', 'retencion-de-15-a-30'], ['retencion_menos_de_15', 'retencion-menos-de-15']]) {
        document.getElementById(id).textContent = `Se retiene el ${Number(politica[tramo]).toLocaleString('es-AR')} % del total`;
    }

    document.getElementById('deposito').textContent = alojamiento.deposito_garantia === null
        ? 'Este alojamiento no pide depósito de garantía.'
        : `${formatearPrecio(alojamiento.deposito_garantia)}. Es informativo: el depósito se cobra y se devuelve por fuera de la aplicación.`;
}

// ---------- arranque ----------

// Arma la página: el encabezado, los datos del alojamiento, el calendario (en el mes del ingreso, si vino)
// y, si vinieron las fechas en la URL, el precio de esa estadía
async function cargarPagina() {
    estado.usuario = await armarEncabezadoPublico();   // unidades-comun.js; null sin sesión

    const parametros = new URLSearchParams(window.location.search);
    estado.id = idUnidadDeLaUrl();
    if (estado.id === null) {
        document.getElementById('mensaje-error').textContent = 'No encontramos ese alojamiento.';
        return;
    }
    if (parametros.get('personas')) {
        document.getElementById('personas').value = parametros.get('personas');
    }

    const hoy = new Date();
    const manana = sumarDias(fechaATexto(hoy), 1);
    const ingreso = parametros.get('ingreso');
    const egreso = parametros.get('egreso');
    estado.mes = ingreso && ingreso >= manana ? textoAFecha(`${ingreso.slice(0, 7)}-01`) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    try {
        const { respuesta, resultado } = await pedirAlBack(`/alojamiento?id=${encodeURIComponent(estado.id)}`);
        if (!respuesta.ok) {   // 404: no existe o no está publicado
            document.getElementById('mensaje-error').textContent = resultado.error;
            return;
        }
        estado.alojamiento = resultado.alojamiento;
        await cargarMes(fechaATexto(estado.mes).slice(0, 7));
    } catch (error) {
        console.error('No se pudo cargar el alojamiento:', error);
        document.getElementById('mensaje-error').textContent = MENSAJE_SIN_CONEXION;
        return;
    }

    mostrarAlojamiento(estado.alojamiento);
    document.getElementById('alojamiento').hidden = false;

    // las fechas de la búsqueda: se usan si siguen siendo válidas (si no, el usuario las elige en el calendario)
    if (ingreso && egreso && ingreso >= manana && egreso > ingreso) {
        estado.ingreso = ingreso;
        estado.egreso = egreso;
        estado.foco = ingreso;
        actualizarEnlaceVolver();
        await calcularEstadia();
    }
    dibujarCalendario();

    document.getElementById('mes-anterior').addEventListener('click', () => cambiarMes(-1));
    document.getElementById('mes-siguiente').addEventListener('click', () => cambiarMes(1));
    document.getElementById('dias-del-mes').addEventListener('keydown', moverConTeclado);
    document.getElementById('form-reservar').addEventListener('submit', reservar);
    document.getElementById('personas').addEventListener('change', () => {
        if (estado.ingreso && estado.egreso) {
            calcularEstadia();
        }
    });
}

cargarPagina();
