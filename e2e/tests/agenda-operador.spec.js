// La agenda de la operadora: muestra los ingresos próximos y no deja registrar uno con el saldo sin pagar.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaAgenda } = require('../paginas/PaginaAgenda');
const { USUARIOS } = require('../soporte/datos');

// Lucía tiene una reserva confirmada en la Casa del Bosque que ingresa en 3 días, con el saldo pendiente
test('la agenda muestra el ingreso próximo y pide el saldo antes de registrarlo', async ({ page }) => {
  // Arrange
  await new PaginaInicioSesion(page).ingresarComo('operadora');
  const agenda = new PaginaAgenda(page);

  // Act
  await agenda.abrir();

  // Assert
  const ingreso = agenda.movimiento(USUARIOS.otraHuesped.nombre, 'ingreso');
  await expect(ingreso).toBeVisible();
  await expect(ingreso).toContainText('El huésped debe pagar el saldo antes de registrar el ingreso.');
  await expect(ingreso.getByRole('button', { name: 'Registrar ingreso' })).toHaveCount(0);
});
