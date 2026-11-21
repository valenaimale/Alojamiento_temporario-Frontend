// Page Object de los formularios de registro (vistas/registros/registro-<rol>.html) y de la página que sigue
// (post-registro.html, "Revisá tu mail"). La cuenta se crea recién al abrir el enlace del mail.
class PaginaRegistro {
  // Guarda la página del navegador y ubica los elementos de las dos pantallas
  constructor(page) {
    this.page = page;
    this.nombre = page.getByLabel('Nombre completo');
    this.dni = page.getByLabel('DNI');
    this.mail = page.getByLabel('Mail', { exact: true });
    this.mailConfirmacion = page.getByLabel('Repetí tu mail');
    this.contrasenia = page.getByLabel('Contraseña', { exact: true });   // exacto: también está "Repetí tu contraseña"
    this.contraseniaConfirmacion = page.getByLabel('Repetí tu contraseña', { exact: true });   // exacto: su botón "Mostrar"
    this.botonRegistrarme = page.getByRole('button', { name: 'Registrarme' });
    // post-registro.html
    this.mensaje = page.getByTestId('post-registro-mensaje');
    this.botonReenviar = page.getByRole('button', { name: 'Reenviar el mail' });
    this.estadoReenvio = page.getByTestId('post-registro-reenvio');
  }

  // Abre el formulario de registro de un rol ("huesped", "propietario", "administrador" u "operador")
  async abrir(rol = 'huesped') {
    await this.page.goto(`/vistas/registros/registro-${rol}.html`);
  }

  // Completa el formulario (nombre, dni, mail y contrasenia) y lo envía
  async registrarse({ nombre, dni, mail, contrasenia }) {
    await this.nombre.fill(nombre);
    await this.dni.fill(dni);
    await this.mail.fill(mail);
    await this.mailConfirmacion.fill(mail);
    await this.contrasenia.fill(contrasenia);
    await this.contraseniaConfirmacion.fill(contrasenia);
    await this.botonRegistrarme.click();
  }
}

module.exports = { PaginaRegistro };
