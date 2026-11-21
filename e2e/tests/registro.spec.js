// Registrarse: la cuenta NO se crea al enviar el formulario, sino al abrir el enlace del mail (desde el 19/11).
// El camino completo (abrir el enlace y que se cree la cuenta con la sesión iniciada) lo cubre RegistroTest del back:
// acá el navegador no puede leer el token, que solo viaja en el mail.
const { test, expect } = require('../soporte/fixtures');
const { PaginaRegistro } = require('../paginas/PaginaRegistro');
const { PaginaVerificarMail } = require('../paginas/PaginaVerificarMail');

// Un mail y un DNI que no usa nadie: cada ejecución (y cada reintento) se registra con datos nuevos
function personaNueva() {
  const numero = String(Date.now()).slice(-7);
  return { nombre: 'Persona de Prueba', dni: `9${numero}`, mail: `e2e-${numero}@ejemplo.local`, contrasenia: 'clave-segura-1' };
}

// Al registrarse, el front avisa a qué mail mandó el enlace y deja reenviarlo
test('registrarse lleva a "Revisá tu mail" con el mail y el reenvío', async ({ page }) => {
  // Arrange
  const registro = new PaginaRegistro(page);
  const persona = personaNueva();
  await registro.abrir('huesped');

  // Act
  await registro.registrarse(persona);

  // Assert
  await expect(page).toHaveURL(/\/post-registro\.html$/);
  await expect(registro.mensaje).toHaveText(`Te enviamos un mail a ${persona.mail}. Abrí el enlace para crear tu cuenta.`);
  await expect(registro.botonReenviar).toBeVisible();
});

// Reenviar responde siempre lo mismo (el back no revela si hay un registro pendiente)
test('reenviar el mail responde sin revelar nada', async ({ page }) => {
  // Arrange
  const registro = new PaginaRegistro(page);
  const persona = personaNueva();
  await registro.abrir('huesped');
  await registro.registrarse(persona);

  // Act
  await registro.botonReenviar.click();

  // Assert
  await expect(registro.estadoReenvio).toContainText(`Si hay un registro pendiente para ${persona.mail}`);
  await expect(registro.botonReenviar).toBeDisabled();
});

// Un enlace que no existe (o ya se usó, o venció) no crea nada y lo explica
test('un enlace inválido muestra el error', async ({ page }) => {
  // Arrange
  const verificar = new PaginaVerificarMail(page);

  // Act
  await verificar.abrir('0'.repeat(64));

  // Assert
  await expect(verificar.mensaje).toContainText('El enlace no es válido o venció');
});
