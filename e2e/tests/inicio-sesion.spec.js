// Iniciar sesión: cada rol llega a su inicio, y una contraseña equivocada muestra el error sin entrar.
const { test, expect } = require('../soporte/fixtures');
const { PaginaInicioSesion } = require('../paginas/PaginaInicioSesion');
const { USUARIOS } = require('../soporte/datos');

// A qué inicio va cada rol después de iniciar sesión (irAlHome de funcionalidades/sesion.js)
const INICIOS = [
  ['huesped', '/vistas/homes/index-huesped.html'],
  ['propietaria', '/vistas/homes/index-huesped.html'],
  ['administrador', '/vistas/homes/index-administrador.html'],
  ['operadora', '/vistas/homes/index-operador.html'],
];

for (const [clave, inicio] of INICIOS) {
  // Un test por rol: si se rompe uno, el nombre dice cuál
  test(`${clave} inicia sesión y llega a su inicio`, async ({ page }) => {
    // Arrange
    const inicioSesion = new PaginaInicioSesion(page);

    // Act
    await inicioSesion.ingresarComo(clave);

    // Assert
    await expect(page).toHaveURL(new RegExp(`${inicio}$`));
  });
}

// Con la contraseña mal, se queda en la pantalla y muestra el error del back
test('una contraseña equivocada muestra el error y no inicia sesión', async ({ page }) => {
  // Arrange
  const inicioSesion = new PaginaInicioSesion(page);
  await inicioSesion.abrir();

  // Act
  await inicioSesion.ingresar(USUARIOS.huesped.mail, 'una-clave-equivocada');

  // Assert
  await expect(inicioSesion.error).not.toBeEmpty();
  await expect(page).toHaveURL(/\/inicio-sesion\.html$/);
});
