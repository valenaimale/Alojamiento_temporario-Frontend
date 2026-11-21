// Prueba de interfaz con respuestas simuladas del contrato propuesto para RF-27.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { URL_BACK } = require('../soporte/entorno');
const { diasDesdeHoy } = require('../soporte/datos');

// Prepara una estadía de seis noches para probar las variantes del contrato propuesto.
// El inicio de sesión y la lectura de reservas pasan por el back de prueba.
async function prepararCambio(page, importes, alConfirmar, grupo = null) {
  const reservas = new PaginaMisReservas(page);
  await new PaginaInicioSesion(page).ingresarComo('otraHuesped');
  let id;
  await page.route('**/reservas/mias', async ruta => {
    const respuesta = await ruta.fetch({url: URL_BACK + '/reservas/mias'});
    const datos = await respuesta.json();
    const reserva = datos.reservas.find(r => r.estado === 'confirmada');
    id = reserva.id;
    Object.assign(reserva, {
      puede_modificar_fechas: true, ingreso: diasDesdeHoy(10), egreso: diasDesdeHoy(16), noches: 6,
    });
    if (grupo) {
      reserva.grupo = grupo;
      datos.reservas.push({...reserva, id: 849, alojamiento: {...reserva.alojamiento, nombre: 'Segunda unidad'}});
    }
    await ruta.fulfill({response: respuesta, json: datos});
  });
  await page.route('**/cambio-fechas/cotizar', ruta => ruta.fulfill({
    json: {...ruta.request().postDataJSON(), cotizacion_id: 'prueba', ...importes},
  }));
  await page.route('**/cambio-fechas/confirmar', alConfirmar);
  await reservas.abrir();
  await expect(reservas.tarjetas.first()).toBeVisible();
  return {reservas, id};
}

// La reducción muestra lo retenido y lo devuelto antes de enviar la cotización aceptada.
test('al reducir noches se revisa la retención antes de confirmar', async ({page}) => {
  // Arrange
  let confirmacion;
  const {reservas, id} = await prepararCambio(page, {a_pagar: 0, retencion: 8000, a_devolver: 12000}, ruta => {
    confirmacion = ruta.request().postDataJSON();
    return ruta.fulfill({json: {confirmado: true}});
  });

  // Act
  await reservas.cotizarFechas(id, diasDesdeHoy(10), diasDesdeHoy(14));
  await expect(reservas.resumenCambio(id)).toContainText(/Retención:.*8.000.*A devolver:.*12.000/);
  await reservas.confirmarCambioSinPago(id);

  // Assert
  await expect.poll(() => confirmacion).toEqual({reserva_id: id, cotizacion_id: 'prueba'});
});

// Un traslado con diferencia positiva abre el pago de la reserva vinculada.
test('al mover una unidad del grupo la diferencia se paga en su reserva vinculada', async ({page}) => {
  // Arrange
  const grupo = {id: 300, titulo: 'Complejo de prueba'};
  let pedido;
  const {reservas, id} = await prepararCambio(page, {a_pagar: 35000, retencion: 0, a_devolver: 0}, ruta => {
    pedido = ruta.request().postDataJSON();
    return ruta.fulfill({json: {reserva_pago_id: 850}});
  }, grupo);
  await expect(reservas.controlesCambioDelGrupo(grupo.id)).toHaveCount(2);
  // Intercepta el destino: se verifica la navegación; el pago real se prueba en modificar-fechas.spec.js.
  await page.route('**/pagar.html?*', ruta => ruta.fulfill({contentType: 'text/html', body: '<title>Pago</title>'}));

  // Act
  await reservas.cotizarFechas(id, diasDesdeHoy(15), diasDesdeHoy(21));
  await expect(reservas.resumenCambio(id)).toContainText(/A pagar ahora:.*35.000/);
  await reservas.confirmarCambioConPago(id);

  // Assert
  expect(pedido).toEqual({reserva_id: id, cotizacion_id: 'prueba'});
  await expect(page).toHaveURL(/pagar\.html\?tipo=sena&reserva_id=850$/);
});
