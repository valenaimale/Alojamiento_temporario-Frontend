// Mis reservas: el historial muestra las estadías que ya terminaron.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');

// Juan tiene dos estadías finalizadas en los datos de ejemplo (Cabaña del Mar y Casa del Bosque)
test('el historial muestra las estadías finalizadas del huésped', async ({ page }) => {
  // Arrange
  await new PaginaInicioSesion(page).ingresarComo('huesped');
  const misReservas = new PaginaMisReservas(page);
  await misReservas.abrir();

  // Act
  await misReservas.verHistorial();

  // Assert
  await expect(misReservas.tarjetasConEstado('Finalizada')).toHaveCount(2);
});
