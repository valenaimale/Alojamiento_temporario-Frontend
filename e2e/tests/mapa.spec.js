// Búsqueda en el mapa desde una pantalla de celular, con el seeder del back del mapa.
const { test, expect } = require('../soporte/fixtures');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaUbicacionUnidad } = require('../paginas/PaginaUbicacionUnidad');
const { URL_BACK } = require('../soporte/entorno');
const { diasDesdeHoy } = require('../soporte/datos');

// Las unidades sin ubicación siguen disponibles en la lista común.
test('el mapa móvil muestra el precio del barrio y conserva el listado completo', async ({page}) => {
  // Arrange
  // Las teselas son externas; los puntos, filtros, importes y enlaces sí se prueban contra el back.
  await page.route('https://tile.openstreetmap.org/**', ruta => ruta.fulfill({status: 204}));
  await page.setViewportSize({width: 375, height: 740});
  const listado = new PaginaListado(page);
  await listado.abrir({ingreso: diasDesdeHoy(10), egreso: diasDesdeHoy(13)});

  // Act
  await listado.filtrarMapaPorBarrio('Bosque');

  // Assert
  await expect(listado.enlacesMapa).toHaveCount(1);
  await expect(listado.enlacesMapa).toHaveText(/Casa del Bosque.*240.000/);
  await expect(listado.enlacesMapa).toHaveAttribute('href', /detalle.html.*ingreso=/);
  await expect(listado.tarjetas).toHaveCount(3);
});

// El punto de una unidad en borrador se puede guardar y volver a abrir sin afectar las búsquedas.
test('la propietaria marca un punto y su barrio persiste al reabrir la unidad', async ({page}) => {
  // Arrange
  await page.route('https://tile.openstreetmap.org/**', ruta => ruta.fulfill({status: 204}));
  await new PaginaInicioSesion(page).ingresarComo('propietaria');
  const datos = await (await page.request.get(URL_BACK + '/unidades/mias')).json();
  const unidad = datos.unidades.find(u => u.estado_publicacion === 'borrador');
  const editor = new PaginaUbicacionUnidad(page);
  await editor.abrir(unidad.id);

  // Act
  await editor.guardarPunto('Costanera');

  // Assert
  await expect(editor.guardado).toBeVisible();
  const punto = [await editor.latitud.inputValue(), await editor.longitud.inputValue()];
  expect(punto.every(v => v !== '')).toBe(true);
  await editor.abrir(unidad.id);
  await expect(editor.barrio).toHaveValue('Costanera');
  await expect(editor.latitud).toHaveValue(punto[0]);
  await expect(editor.longitud).toHaveValue(punto[1]);
});
