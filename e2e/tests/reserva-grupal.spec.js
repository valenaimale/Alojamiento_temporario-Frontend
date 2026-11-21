// La reserva grupal (US4.4 y US8.5), con la unidad grupal de Cacho de los datos de ejemplo: la Casa del Bosque (6) y la
// Cabaña de los Pinos (4). El huésped la encuentra buscando para 8 personas, elige las unidades, paga la seña de todas
// juntas (pago simulado) y después cancela una sola. El administrador la ve y la puede desactivar.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaGrupal } = require('../paginas/PaginaGrupal');
const { PaginaPago } = require('../paginas/PaginaPago');
const { PaginaMisReservas } = require('../paginas/PaginaMisReservas');
const { PaginaGrupalesAdministrador } = require('../paginas/PaginaGrupalesAdministrador');
const { GRUPAL, UNIDADES, diasDesdeHoy } = require('../soporte/datos');

// 5 noches para 8 personas. Reservar ocupa las noches: si el CI reintenta el test, usa otras fechas (testInfo.retry)
function busqueda(testInfo) {
  const desde = 60 + testInfo.retry * 7;
  return { ingreso: diasDesdeHoy(desde), egreso: diasDesdeHoy(desde + 5), personas: 8 };
}

test('el huésped reserva la grupal, paga la seña de todas las unidades juntas y cancela una sola', async ({ page }, testInfo) => {
  // Arrange: busca para 8 personas, donde ninguna unidad alcanza sola
  await new PaginaInicioSesion(page).ingresarComo('huesped');
  const listado = new PaginaListado(page);
  const grupal = new PaginaGrupal(page);
  const pago = new PaginaPago(page);
  const misReservas = new PaginaMisReservas(page);
  await listado.abrir(busqueda(testInfo));
  await expect(listado.tarjetaGrupal(GRUPAL.titulo)).toBeVisible();
  await listado.abrirGrupal(GRUPAL.titulo);
  await expect(grupal.unidades).toHaveCount(2);

  // Act 1: sin una de las unidades no alcanza para todos; con las dos, sí
  await grupal.casilla(UNIDADES.pinos.nombre).uncheck();
  await expect(grupal.eleccion).toContainText('Elegí al menos 2 unidades');
  await expect(grupal.botonReservar).toBeDisabled();
  await grupal.casilla(UNIDADES.pinos.nombre).check();
  await expect(grupal.eleccion).toContainText('2 unidades elegidas, con lugar para 10 personas');
  await expect(grupal.total).toContainText('750.000');

  // Act 2: reserva y paga la seña de las dos juntas
  await grupal.reservar();
  await expect(pago.montoPesos).toContainText('150.000'); // el 20 % de $750.000
  const grupoId = pago.grupoId();
  await pago.pagarSimulado();
  await misReservas.abrir();

  // Assert: el grupo y sus dos unidades quedaron confirmados, con el saldo por pagar juntas
  await expect(misReservas.grupo(grupoId).getByTestId('estado-grupo')).toHaveText('Confirmada');
  await expect(misReservas.grupo(grupoId).getByTestId('estado-pago-grupo')).toContainText('Saldo pendiente');
  for (const nombre of GRUPAL.unidades) {
    await expect(misReservas.unidadDelGrupo(grupoId, nombre).getByTestId('estado-reserva')).toHaveText('Confirmada');
  }

  // Act 3: cancela solo la Cabaña de los Pinos
  await misReservas.cancelarUnidadDelGrupo(grupoId, UNIDADES.pinos.nombre);

  // Assert: esa unidad quedó cancelada y la otra sigue confirmada
  await expect(misReservas.unidadDelGrupo(grupoId, UNIDADES.pinos.nombre).getByTestId('estado-reserva')).toHaveText('Cancelada');
  await expect(misReservas.unidadDelGrupo(grupoId, 'Casa del Bosque').getByTestId('estado-reserva')).toHaveText('Confirmada');
  await expect(misReservas.grupo(grupoId).getByTestId('estado-grupo')).toHaveText('Confirmada');
});

test('el administrador ve su reserva grupal con las dos unidades y la puede desactivar', async ({ page }) => {
  // Arrange
  await new PaginaInicioSesion(page).ingresarComo('administrador');
  const grupales = new PaginaGrupalesAdministrador(page);
  await grupales.abrir();
  const tarjeta = grupales.grupal(GRUPAL.titulo);

  // Assert: sus dos unidades, de dos propietarias, y activa
  await expect(tarjeta).toContainText(`hasta ${GRUPAL.capacidad} personas`);
  for (const nombre of GRUPAL.unidades) await expect(tarjeta).toContainText(nombre);
  await expect(tarjeta.locator('.estado')).toHaveText('Activa');

  // Act y Assert: la desactiva y la vuelve a activar (así no cambia lo que ven los demás tests)
  await grupales.cambiarEstado(GRUPAL.titulo, 'Desactivar');
  await expect(grupales.mensaje).toHaveText('La reserva grupal ya no aparece en la búsqueda');
  await expect(tarjeta.locator('.estado')).toHaveText('Desactivada');
  await grupales.cambiarEstado(GRUPAL.titulo, 'Activar');
  await expect(tarjeta.locator('.estado')).toHaveText('Activa');
});
