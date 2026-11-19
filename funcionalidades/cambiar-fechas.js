// Adaptador propuesto para el contrato de Fede. Solo se ofrece el flujo a reservas habilitadas por el back.
async function pedirCambioFechas(accion, datos) {
  const { respuesta, resultado } = await pedirAlBack('/reservas/cambio-fechas/' + accion, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  });
  if (!respuesta.ok) throw new Error(resultado?.error || 'No se pudo procesar el cambio de fechas.');
  return resultado;
}

// La vista previa solo permite confirmar importes explícitos para la misma reserva y las mismas fechas.
function validarVistaCambio(vista, pedido) {
  const monto = valor => (typeof valor === 'string' || typeof valor === 'number') &&
    /^\d+(?:\.\d{1,2})?$/.test(String(valor)) && Number.isFinite(Number(valor));
  if (!vista || String(vista.reserva_id) !== String(pedido.reserva_id) ||
      vista.ingreso !== pedido.ingreso || vista.egreso !== pedido.egreso ||
      typeof vista.cotizacion_id !== 'string' || !vista.cotizacion_id.trim() ||
      ![vista.a_pagar, vista.retencion, vista.a_devolver].every(monto)) {
    throw new Error('No pudimos verificar la cotización para esas fechas.');
  }
  return vista;
}

function formularioCambioFechas(reserva) {
  const panel = document.getElementById('formulario-cambio-fechas').content.firstElementChild.cloneNode(true);
  const form = panel.querySelector('form');
  const estado = panel.querySelector('[role=status]');
  const confirmar = panel.querySelector('button[type=button]');
  const { ingreso, egreso } = form.elements;
  ingreso.value = reserva.ingreso;
  egreso.value = reserva.egreso;
  let vista, ocupado = false;
  function invalidar() {
    vista = null;
    confirmar.hidden = true;
    estado.textContent = '';
  }
  function bloquear(valor) {
    ocupado = valor;
    for (const control of form.elements) control.disabled = valor;
    confirmar.disabled = valor;
  }
  form.addEventListener('input', invalidar);
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (ocupado) return;
    invalidar();
    if (ingreso.value >= egreso.value || (ingreso.value === reserva.ingreso && egreso.value === reserva.egreso)) {
      estado.textContent = 'Elegí fechas nuevas con el egreso posterior al ingreso.';
      return;
    }
    const pedido = { reserva_id: reserva.id, ingreso: ingreso.value, egreso: egreso.value };
    bloquear(true);
    try {
      vista = validarVistaCambio(await pedirCambioFechas('cotizar', pedido), pedido);
      estado.textContent = 'A pagar ahora: ' + formatearPrecio(vista.a_pagar) +
        ' · Retención: ' + formatearPrecio(vista.retencion) + ' · A devolver: ' + formatearPrecio(vista.a_devolver);
      confirmar.textContent = Number(vista.a_pagar) > 0 ? 'Confirmar y pasar al pago' : 'Confirmar cambio';
      confirmar.hidden = false;
    } catch (error) {
      estado.textContent = error.message;
    } finally {
      bloquear(false);
    }
  });
  confirmar.addEventListener('click', async () => {
    if (ocupado || !vista) return;
    bloquear(true);
    try {
      const cambio = await pedirCambioFechas('confirmar', { reserva_id: reserva.id, cotizacion_id: vista.cotizacion_id });
      if (Number(vista.a_pagar) > 0) {
        const id = PagosModelo.identificador(cambio.reserva_pago_id);
        if (!id || id === String(reserva.id)) throw new Error('Falta identificar la reserva de pago.');
        window.location.assign('pagar.html?tipo=sena&reserva_id=' + encodeURIComponent(id));
      } else if (cambio.confirmado === true) {
        window.location.reload();
      } else {
        throw new Error('No se recibió la confirmación.');
      }
    } catch (error) {
      estado.textContent = error.message + ' Actualizá Mis reservas para revisar el estado antes de volver a intentar.';
    }
  });
  return panel;
}

if (typeof module !== 'undefined') module.exports = { validarVistaCambio };
