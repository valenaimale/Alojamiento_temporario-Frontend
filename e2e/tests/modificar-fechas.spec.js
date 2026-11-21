// Extensión previa al ingreso con pago de la diferencia. Requiere el backend de RF-27.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaDetalle } = require('../paginas/PaginaDetalle');
const { PaginaPago } = require('../paginas/PaginaPago');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { diasDesdeHoy, UNIDADES } = require('../soporte/datos');

// Una noche adicional en temporada baja genera una reserva de pago por $60.000.
test('el huésped extiende antes del ingreso y paga una noche adicional', async ({page}, info) => {
  // Arrange
  const inicio = 48 + info.retry * 5;
  const ingreso = diasDesdeHoy(inicio);
  const listado = new PaginaListado(page);
  const detalle = new PaginaDetalle(page);
  const pago = new PaginaPago(page);
  const reservas = new PaginaMisReservas(page);
  await new PaginaInicioSesion(page).ingresarComo('huesped');
  await listado.abrir({ingreso, egreso: diasDesdeHoy(inicio + 2)});
  await listado.abrirAlojamiento(UNIDADES.cabania.nombre);
  await detalle.reservar();
  await expect(pago.montoPesos).toBeVisible();
  const original = pago.reservaId();
  await pago.pagarSimulado();
  await reservas.abrir();

  // Act
  await reservas.cotizarFechas(original, ingreso, diasDesdeHoy(inicio + 3));
  await reservas.confirmarCambioConPago(original);
  await expect(pago.montoPesos).toContainText('60.000');
  const vinculada = pago.reservaId();
  await pago.pagarSimulado();
  await reservas.abrir();

  // Assert
  expect(vinculada).not.toBe(original);
  await expect(reservas.estado(original)).toHaveText('Confirmada');
  await expect(reservas.estado(vinculada)).toHaveText('Confirmada');
});
