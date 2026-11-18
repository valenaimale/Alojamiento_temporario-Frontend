// El flujo principal del huésped: busca, reserva y paga la seña (con el pago simulado), y la reserva queda confirmada.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaDetalle } = require('../paginas/PaginaDetalle');
const { PaginaPago } = require('../paginas/PaginaPago');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { UNIDADES, diasDesdeHoy } = require('../soporte/datos');

// Reservar deja las noches ocupadas: si el CI reintenta el test, usa otras fechas (testInfo.retry)
test('el huésped reserva, paga la seña y la reserva queda confirmada', async ({ page }, testInfo) => {
  // Arrange
  const desde = 30 + testInfo.retry * 5;   // temporada baja de la Cabaña, sin bloqueos ni otras reservas
  await new PaginaInicioSesion(page).ingresarComo('huesped');
  const listado = new PaginaListado(page);
  const detalle = new PaginaDetalle(page);
  const pago = new PaginaPago(page);
  const misReservas = new PaginaMisReservas(page);
  await listado.abrir({ ingreso: diasDesdeHoy(desde), egreso: diasDesdeHoy(desde + 3), personas: 2 });
  await listado.abrirAlojamiento(UNIDADES.cabania.nombre);
  await expect(detalle.precioTotal).toContainText('180.000');

  // Act
  await detalle.reservar();
  await expect(pago.montoPesos).toBeVisible();
  const reservaId = pago.reservaId();
  await pago.pagarSimulado();
  await misReservas.abrir();

  // Assert
  await expect(misReservas.estado(reservaId)).toHaveText('Confirmada');
  await expect(misReservas.estadoPago(reservaId)).toContainText('Saldo pendiente');
});
