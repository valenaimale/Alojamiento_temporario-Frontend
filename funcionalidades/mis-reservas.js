// "Mis reservas" del huésped (vistas/reservas/mis-reservas.html), Épica 4.
// Pide GET /reservas/mias y arma una tarjeta por reserva. Las pendientes se cancelan con POST /reservas/cancelar.
// La sesión y el rol los controla proteger-pagina.js (sin sesión o con otro rol, redirige).
// Si viene ?nueva=1 (recién reservó desde el detalle), muestra el aviso de que la reserva quedó guardada.

// El estado de la reserva como se le muestra al huésped, y la clase de su badge
const ESTADOS_DE_RESERVA = {
    pendiente:  { texto: 'Pendiente de pago', clase: 'estado-pendiente' },
    confirmada: { texto: 'Confirmada', clase: 'estado-publicada' },
    finalizada: { texto: 'Finalizada', clase: 'estado-no-publicada' },
    cancelada:  { texto: 'Cancelada', clase: 'estado-no-publicada' },
    expirada:   { texto: 'Vencida sin pagar', clase: 'estado-no-publicada' },
};

// Agrega a la lista <dl> un dato: <dt>nombre</dt><dd>valor</dd>
function agregarDato(lista, nombre, valor) {
    const termino = document.createElement('dt');
    termino.textContent = nombre;
    const definicion = document.createElement('dd');
    definicion.textContent = valor;
    lista.append(termino, definicion);
}

// La tarjeta de una reserva: foto, alojamiento (con enlace al detalle), estado, fechas e importes.
// Si está pendiente, la aclaración del pago y "Cancelar reserva".
function tarjetaDeReserva(reserva) {
    const { alojamiento } = reserva;
    const item = document.createElement('li');
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta reserva';
    tarjeta.setAttribute('aria-labelledby', `reserva-${reserva.id}`);

    if (alojamiento.foto_principal) {
        const foto = document.createElement('img');
        foto.src = fotoConAncho(alojamiento.foto_principal, 600);
        foto.alt = '';   // decorativa: el nombre del alojamiento está en el título
        foto.loading = 'lazy';
        tarjeta.appendChild(foto);
    }

    const titulo = document.createElement('h2');
    titulo.id = `reserva-${reserva.id}`;
    const enlace = document.createElement('a');
    enlace.href = `../alojamientos/detalle.html?id=${alojamiento.id}`;
    enlace.textContent = alojamiento.nombre;
    titulo.appendChild(enlace);

    const ubicacion = document.createElement('p');
    ubicacion.className = 'ubicacion';
    ubicacion.textContent = `${alojamiento.localidad}, ${alojamiento.provincia}`;

    const estado = ESTADOS_DE_RESERVA[reserva.estado] ?? { texto: reserva.estado, clase: 'estado-no-publicada' };
    const parrafoEstado = document.createElement('p');
    const badge = document.createElement('span');
    badge.className = `estado ${estado.clase}`;
    badge.textContent = estado.texto;
    parrafoEstado.appendChild(badge);

    const datos = document.createElement('dl');
    datos.className = 'datos';
    agregarDato(datos, 'Fechas', `Del ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)} (${reserva.noches} ${reserva.noches === 1 ? 'noche' : 'noches'})`);
    agregarDato(datos, 'Personas', reserva.personas);
    agregarDato(datos, 'Total', formatearPrecio(reserva.importe_total));
    agregarDato(datos, 'Seña', formatearPrecio(reserva.importe_sena));

    tarjeta.append(titulo, ubicacion, parrafoEstado, datos);

    if (reserva.puede_cancelar) {
        const aclaracion = document.createElement('p');
        aclaracion.className = 'ayuda';
        aclaracion.textContent = 'El pago de la seña llega en la próxima versión de la plataforma. Mientras tanto, la reserva te guarda las fechas.';

        // el nombre oculto hace que el botón se entienda solo: "Cancelar reserva en Cabaña del Mar"
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'boton boton-outline';
        boton.textContent = 'Cancelar reserva';
        const nombreOculto = document.createElement('span');
        nombreOculto.className = 'visualmente-oculto';
        nombreOculto.textContent = ` en ${alojamiento.nombre}`;
        boton.appendChild(nombreOculto);
        boton.addEventListener('click', () => cancelarReserva(reserva));

        tarjeta.append(aclaracion, boton);
    }

    item.appendChild(tarjeta);
    return item;
}

// Pide las reservas y las muestra (o el aviso de que no tiene ninguna). Lanza el error si el backend no responde.
async function cargarReservas() {
    const { respuesta, resultado } = await pedirAlBack('/reservas/mias');
    if (!respuesta.ok) {   // 401 o 403: proteger-pagina.js ya está redirigiendo
        return;
    }
    document.getElementById('cargando').hidden = true;
    document.getElementById('sin-reservas').hidden = resultado.reservas.length > 0;
    document.getElementById('lista-reservas').replaceChildren(...resultado.reservas.map(tarjetaDeReserva));
}

// Cancela una reserva pendiente, después de confirmarlo. Muestra el resultado, actualiza la lista
// y lleva el foco al título (el botón tocado desaparece)
async function cancelarReserva(reserva) {
    const confirmo = await confirmar({
        titulo: `¿Cancelar tu reserva en ${reserva.alojamiento.nombre}?`,
        detalle: `Del ${formatearFecha(reserva.ingreso)} al ${formatearFecha(reserva.egreso)}. Las fechas quedan libres para otros huéspedes. Como todavía no pagaste nada, no hay nada que devolver.`,
        textoConfirmar: 'Cancelar reserva',
        textoCancelar: 'Volver',
    });
    if (!confirmo) {
        return;
    }
    const mensajeOk = document.getElementById('mensaje-ok');
    const mensajeError = document.getElementById('mensaje-error');
    mensajeOk.textContent = '';
    mensajeError.textContent = '';

    try {
        const { respuesta, resultado } = await pedirAlBack('/reservas/cancelar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserva_id: reserva.id }),
        });
        if (respuesta.ok) {
            mensajeOk.textContent = resultado.ok;
        } else {
            mensajeError.textContent = resultado.error;
        }
        await cargarReservas();
    } catch (error) {
        console.error('No se pudo conectar con el back:', error);
        mensajeError.textContent = MENSAJE_SIN_CONEXION;
    }
    document.getElementById('titulo').focus();
}

// Arma la página: el aviso si recién reservó, y la lista de reservas
async function cargarPagina() {
    if (new URLSearchParams(window.location.search).get('nueva') === '1') {
        document.getElementById('mensaje-ok').textContent = '¡Listo, reservaste! Tu reserva quedó pendiente de pago y ya te guarda las fechas.';
        history.replaceState(null, '', window.location.pathname);   // al recargar, el aviso no vuelve a aparecer
    }
    try {
        await cargarReservas();
    } catch (error) {
        console.error('No se pudieron cargar las reservas:', error);
        document.getElementById('cargando').hidden = true;
        document.getElementById('mensaje-error').textContent = MENSAJE_SIN_CONEXION;
    }
}

cargarPagina();
