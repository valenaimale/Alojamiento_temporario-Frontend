// La agenda del operador (vistas/homes/index-operador.html), RF-10.
// Pide GET /operador/agenda (las reservas en curso y próximas de sus unidades) y arma, para cada día,
// los egresos y los ingresos. Los egresos van primero: la unidad se libera a la mañana y se recibe a la tarde.
// Nunca muestra montos (RN-19): el backend ni siquiera los manda.
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).

const fechaDelDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

// "AAAA-MM-DD" de hoy más esa cantidad de días, con la fecha local (la del usuario, en Argentina)
function diaDesdeHoy(dias) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// El título de un día: "Hoy, sábado 31 de octubre", "Mañana, …" o "Lunes 2 de noviembre"
function tituloDelDia(texto) {
    const [anio, mes, dia] = texto.split('-').map(Number);
    const enPalabras = fechaDelDia.format(new Date(anio, mes - 1, dia));
    if (texto === diaDesdeHoy(0)) return `Hoy, ${enPalabras}`;
    if (texto === diaDesdeHoy(1)) return `Mañana, ${enPalabras}`;
    return enPalabras.charAt(0).toUpperCase() + enPalabras.slice(1);
}

// Los movimientos de cada día a partir de las reservas: Map("AAAA-MM-DD" → [{tipo, reserva}]), ordenado por fecha.
// Una reserva en curso ya ingresó: solo se agenda su egreso.
function movimientosPorDia(reservas) {
    const hoy = diaDesdeHoy(0);
    const movimientos = [];
    for (const reserva of reservas) {
        if (reserva.ingreso >= hoy) {   // AAAA-MM-DD se compara como texto
            movimientos.push({ fecha: reserva.ingreso, tipo: 'ingreso', reserva });
        }
        movimientos.push({ fecha: reserva.egreso, tipo: 'egreso', reserva });
    }
    // por fecha; en el mismo día, los egresos antes que los ingresos
    movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === 'egreso' ? -1 : 1) - (b.tipo === 'egreso' ? -1 : 1));

    const dias = new Map();
    for (const movimiento of movimientos) {
        if (!dias.has(movimiento.fecha)) {
            dias.set(movimiento.fecha, []);
        }
        dias.get(movimiento.fecha).push(movimiento);
    }
    return dias;
}

// La tarjeta de un ingreso o egreso: el tipo, la unidad con su dirección, el huésped, las personas y las fechas
function tarjetaDeMovimiento({ tipo, reserva }) {
    const item = document.createElement('li');
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta';

    const badge = document.createElement('p');
    badge.className = `badge badge-${tipo}`;
    badge.textContent = tipo === 'ingreso' ? 'Ingreso' : 'Egreso';

    const huesped = document.createElement('h3');
    huesped.textContent = reserva.huesped;

    const unidad = document.createElement('p');
    unidad.className = 'unidad';
    unidad.textContent = reserva.unidad.nombre;
    const direccion = document.createElement('p');
    direccion.textContent = `${reserva.unidad.direccion}, ${reserva.unidad.localidad}`;

    const estadia = document.createElement('p');
    estadia.className = 'estadia';
    const personas = reserva.personas === 1 ? '1 persona' : `${reserva.personas} personas`;
    const noches = reserva.noches === 1 ? '1 noche' : `${reserva.noches} noches`;
    estadia.textContent = `${personas} · ${noches}, del ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)}`;

    tarjeta.append(badge, huesped, unidad, direccion, estadia);
    if (reserva.estado === 'pendiente') {
        const aviso = document.createElement('p');
        aviso.className = 'pendiente';
        aviso.textContent = 'Reserva pendiente de pago';
        tarjeta.appendChild(aviso);
    }
    item.appendChild(tarjeta);
    return item;
}

// Pide la agenda y la dibuja: un elemento por día, con su título y sus movimientos
async function cargarAgenda() {
    const { respuesta, resultado } = await pedirAlBack('/operador/agenda');
    if (!respuesta.ok) {   // 401 o 403: proteger-pagina.js ya está redirigiendo
        return;
    }
    document.getElementById('cargando').hidden = true;
    const dias = movimientosPorDia(resultado.reservas);
    document.getElementById('agenda-vacia').hidden = dias.size > 0;

    const listaDeDias = document.getElementById('dias');
    listaDeDias.replaceChildren();
    for (const [fecha, movimientos] of dias) {
        const dia = document.createElement('li');
        const titulo = document.createElement('h2');
        const tiempo = document.createElement('time');
        tiempo.dateTime = fecha;
        tiempo.textContent = tituloDelDia(fecha);
        titulo.appendChild(tiempo);
        const listaDeMovimientos = document.createElement('ul');
        listaDeMovimientos.className = 'movimientos';
        listaDeMovimientos.append(...movimientos.map(tarjetaDeMovimiento));
        dia.append(titulo, listaDeMovimientos);
        listaDeDias.appendChild(dia);
    }
}

// Arma la página; si el backend no responde, lo dice
async function cargarPagina() {
    try {
        await cargarAgenda();
    } catch (error) {
        console.error('No se pudo cargar la agenda:', error);
        document.getElementById('cargando').hidden = true;
        document.getElementById('mensaje-error').textContent = MENSAJE_SIN_CONEXION;
    }
}

cargarPagina();
