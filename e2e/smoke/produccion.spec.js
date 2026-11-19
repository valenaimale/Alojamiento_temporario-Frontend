// Smoke de producción: después de cada deploy, comprueba que la app desplegada responde. SOLO LECTURA: ningún test
// reserva, paga, registra ni modifica nada en producción. Cada test mira una pieza distinta de la cadena
// navegador → Vercel → /api (redirección de vercel.json) → back en Railway → base en Aiven.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicio } = require('../paginas/PaginaInicio');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { PaginaListado } = require('../paginas/PaginaListado');
const { PaginaDetalle } = require('../paginas/PaginaDetalle');
const { diasDesdeHoy } = require('../soporte/datos');

// Una búsqueda de 3 noches dentro de un mes, en todos los destinos
const BUSQUEDA = { ingreso: diasDesdeHoy(30), egreso: diasDesdeHoy(33), personas: 2 };

// El back responde por la redirección de Vercel y llega a la base de datos
test('el back responde por /api y la base de datos está bien', async ({ request }) => {
  // Arrange
  const ruta = '/api/estado';

  // Act
  const respuesta = await request.get(ruta);

  // Assert
  expect(respuesta.status()).toBe(200);
  const estado = await respuesta.json();
  expect(estado.estado).toBe('ok');
  expect(estado.chequeos.base_de_datos).toBe('ok');
});

// El inicio carga y muestra los destinos, que llegan del back
test('el inicio carga con los destinos', async ({ page }) => {
  // Arrange
  const inicio = new PaginaInicio(page);

  // Act
  await inicio.abrir();

  // Assert
  await expect(inicio.titulo).toBeVisible();
  await expect(inicio.destinos.first()).toBeVisible();
});

// La búsqueda termina sin error y, si hay resultados, el primero abre su detalle
test('la búsqueda responde y el detalle de un resultado abre', async ({ page }) => {
  // Arrange
  const listado = new PaginaListado(page);
  const detalle = new PaginaDetalle(page);

  // Act
  await listado.abrir(BUSQUEDA);

  // Assert
  await expect(listado.busquedaTerminada()).toBeVisible();
  await expect(listado.botonReintentar).toBeHidden();
  if (await listado.tarjetas.count() > 0) {
    const nombre = await listado.abrirPrimerAlojamiento();
    await expect(detalle.nombre).toHaveText(nombre);
  }
});

// El inicio de sesión llega al back: con un mail que no existe, responde el error (no "sin conexión")
test('el inicio de sesión responde', async ({ page }) => {
  // Arrange
  const inicioSesion = new PaginaInicioSesion(page);
  await inicioSesion.abrir();

  // Act
  await inicioSesion.ingresar('smoke-no-existe@ejemplo.invalid', 'no-es-una-clave');

  // Assert
  await expect(inicioSesion.error).not.toBeEmpty();
  await expect(inicioSesion.error).not.toContainText(/conect|conexión/i);
  await expect(page).toHaveURL(/\/inicio-sesion\.html$/);
});
