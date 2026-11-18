// Buscar alojamiento sin sesión (US3.2): el buscador lleva a los resultados y el detalle muestra el precio de las fechas.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicio } = require('../paginas/PaginaInicio');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaDetalle } = require('../paginas/PaginaDetalle');
const { UNIDADES, diasDesdeHoy } = require('../soporte/datos');

// 3 noches dentro de 10 días: libres en las tres unidades publicadas y en temporada con precio
const BUSQUEDA = { ingreso: diasDesdeHoy(10), egreso: diasDesdeHoy(13), personas: 2 };

// El buscador del inicio muestra las unidades publicadas y nunca la que está en borrador
test('el buscador muestra los alojamientos publicados disponibles', async ({ page }) => {
  // Arrange
  const inicio = new PaginaInicio(page);
  const listado = new PaginaListado(page);
  await inicio.abrir();

  // Act
  await inicio.buscar(BUSQUEDA);

  // Assert
  await expect(listado.tarjeta(UNIDADES.cabania.nombre)).toBeVisible();
  await expect(listado.tarjeta(UNIDADES.casa.nombre)).toBeVisible();
  await expect(listado.tarjeta(UNIDADES.loft.nombre)).toBeVisible();
  await expect(listado.tarjeta(UNIDADES.borrador.nombre)).toHaveCount(0);
});

// Desde los resultados, el detalle llega con las mismas fechas y el precio final de las 3 noches
test('el detalle muestra el precio total de las fechas buscadas', async ({ page }) => {
  // Arrange
  const listado = new PaginaListado(page);
  const detalle = new PaginaDetalle(page);
  await listado.abrir(BUSQUEDA);

  // Act
  await listado.abrirAlojamiento(UNIDADES.cabania.nombre);

  // Assert
  await expect(detalle.nombre).toHaveText(UNIDADES.cabania.nombre);
  await expect(detalle.precioTotal).toContainText('180.000');   // 3 noches de $60.000
});

// Sin sesión no aparece el formulario para reservar: el detalle explica qué hacer
test('sin sesión el detalle no deja reservar', async ({ page }) => {
  // Arrange
  const detalle = new PaginaDetalle(page);
  const listado = new PaginaListado(page);
  await listado.abrir(BUSQUEDA);

  // Act
  await listado.abrirAlojamiento(UNIDADES.loft.nombre);

  // Assert
  await expect(detalle.avisoReservar).toBeVisible();
  await expect(detalle.formReservar).toBeHidden();
});
