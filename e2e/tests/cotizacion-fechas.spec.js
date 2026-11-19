// Prueba de interfaz con respuestas simuladas del contrato propuesto para RF-27.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { URL_BACK } = require('../soporte/entorno');
const { diasDesdeHoy } = require('../soporte/datos');

// La reducción muestra lo retenido y lo devuelto antes de enviar la cotización aceptada.
test('al reducir noches se revisa la retención antes de confirmar', async ({page}) => {
  // Arrange
  const reservas = new PaginaMisReservas(page);
  await new PaginaInicioSesion(page).ingresarComo('otraHuesped');
  let id, confirmacion;
  await page.route('**/reservas/mias', async ruta => {
    const respuesta = await ruta.fetch({url: URL_BACK + '/reservas/mias'});
    const datos = await respuesta.json();
    const reserva = datos.reservas.find(r => r.estado === 'confirmada');
    id = reserva.id;
    reserva.puede_modificar_fechas = true;
    await ruta.fulfill({response: respuesta, json: datos});
  });
  await page.route('**/cambio-fechas/cotizar', ruta => ruta.fulfill({
    json: {...ruta.request().postDataJSON(), cotizacion_id: 'prueba', a_pagar: 0, retencion: 8000, a_devolver: 12000},
  }));
  await page.route('**/cambio-fechas/confirmar', ruta => {
    confirmacion = ruta.request().postDataJSON();
    return ruta.fulfill({json: {confirmado: true}});
  });
  await reservas.abrir();
  await expect(reservas.tarjetas.first()).toBeVisible();

  // Act
  await reservas.cotizarFechas(id, diasDesdeHoy(3), diasDesdeHoy(7));
  await expect(reservas.resumenCambio(id)).toContainText(/Retención:.*8.000.*A devolver:.*12.000/);
  await reservas.confirmarCambioSinPago(id);

  // Assert
  await expect.poll(() => confirmacion).toEqual({reserva_id: id, cotizacion_id: 'prueba'});
});
