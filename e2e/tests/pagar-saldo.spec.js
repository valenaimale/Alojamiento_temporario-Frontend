// El huésped paga el saldo de su reserva desde Mis reservas (con el pago simulado) y la reserva queda paga.
// Arma su propia reserva (en el Loft, que ningún otro test reserva) en vez de usar la de Lucía, que mira la agenda.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaDetalle } = require('../paginas/PaginaDetalle');
const { PaginaPago } = require('../paginas/PaginaPago');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { UNIDADES, diasDesdeHoy } = require('../soporte/datos');

// Reservar deja las noches ocupadas: si el CI reintenta el test, usa otras fechas (testInfo.retry).
// Con más de 5 días hasta el ingreso, se paga seña y saldo por separado (con 5 o menos sería pago total, #75 del back).
test('el huésped paga el saldo desde Mis reservas y la reserva queda paga', async ({ page }, testInfo) => {
  // Arrange: una reserva confirmada con la seña paga y el saldo pendiente
  const desde = 50 + testInfo.retry * 5;
  await new PaginaInicioSesion(page).ingresarComo('huesped');
  const listado = new PaginaListado(page);
  const detalle = new PaginaDetalle(page);
  const pago = new PaginaPago(page);
  const misReservas = new PaginaMisReservas(page);
  await listado.abrir({ ingreso: diasDesdeHoy(desde), egreso: diasDesdeHoy(desde + 3), personas: 2 });
  await listado.abrirAlojamiento(UNIDADES.loft.nombre);
  await detalle.reservar();
  await expect(pago.montoPesos).toBeVisible();
  const reservaId = pago.reservaId();
  await pago.pagarSimulado();
  await misReservas.abrir();
  await expect(misReservas.estadoPago(reservaId)).toContainText('Saldo pendiente');

  // Act
  await misReservas.irAPagar(reservaId);
  await expect(pago.montoPesos).toBeVisible();
  await pago.pagarSimulado();
  await misReservas.abrir();

  // Assert
  await expect(misReservas.estado(reservaId)).toHaveText('Confirmada');
  await expect(misReservas.estadoPago(reservaId)).toContainText('Pago completo');
});
