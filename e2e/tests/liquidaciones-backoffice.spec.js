// Las liquidaciones del backoffice: generarlas y pagarlas a mano, sin esperar al cron de cada 10 minutos.
// Los datos de ejemplo traen tres estadías terminadas sin liquidar (una por cada caso de la cuenta); el firmador
// del back de prueba es el simulado, así que "pagar" no manda nada a ninguna red.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaLiquidacionesBackoffice } = require('../paginas/PaginaLiquidacionesBackoffice');
const { USUARIOS, UNIDADES } = require('../soporte/datos');

// Juan se alojó en la Cabaña del Mar (autogestión de Marisa, con su billetera cargada): es la que se paga acá
const CABANIA = [UNIDADES.cabania.nombre, USUARIOS.huesped.nombre];

test('el backoffice genera las liquidaciones y paga una en el momento', async ({ page }) => {
  // Arrange
  await new PaginaInicioSesion(page).ingresarComo('backoffice');
  const liquidaciones = new PaginaLiquidacionesBackoffice(page);
  await liquidaciones.abrir();

  // Act: generar
  await liquidaciones.botonGenerar.click();

  // Assert: se generaron y ya no queda ninguna reserva esperando
  await expect(liquidaciones.mensaje).toContainText(/Se liquidaron \d+ estadías|No había estadías sin liquidar/);
  await expect(liquidaciones.sinLiquidar).toHaveText('No hay reservas esperando su liquidación.');
  const fila = liquidaciones.fila(...CABANIA);
  await expect(liquidaciones.situacion(fila)).toHaveText(/Para pagar|Pagada/);

  // Act: pagar (si un reintento del test ya la pagó, el paso se saltea)
  if (await liquidaciones.botonPagar(fila).count() > 0) {
    await liquidaciones.botonPagar(fila).click();
    await expect(liquidaciones.mensaje).toContainText('Liquidación pagada');
  }

  // Assert: quedó pagada y ya no tiene el botón
  await expect(liquidaciones.situacion(fila)).toHaveText('Pagada');
  await expect(liquidaciones.botonPagar(fila)).toHaveCount(0);
});

test('desde una liquidación se abre el comprobante y "Volver" regresa al backoffice', async ({ page }) => {
  // Arrange
  await new PaginaInicioSesion(page).ingresarComo('backoffice');
  const liquidaciones = new PaginaLiquidacionesBackoffice(page);
  await liquidaciones.abrir();
  await liquidaciones.botonGenerar.click();   // es idempotente: si ya estaban generadas no cambia nada
  const fila = liquidaciones.fila(...CABANIA);
  await expect(fila).toBeVisible();

  // Act
  await fila.getByRole('link', { name: /^Ver el comprobante/ }).click();
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible();   // aparece cuando el comprobante cargó
  await page.getByRole('link', { name: 'Volver', exact: true }).click();

  // Assert
  await expect(page).toHaveURL(/\/vistas\/backoffice\/liquidaciones\.html$/);
});
