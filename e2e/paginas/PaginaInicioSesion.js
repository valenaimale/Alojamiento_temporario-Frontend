// Page Object de vistas/sesion/inicio-sesion.html: iniciar sesión con mail y contraseña.
const { CONTRASENIA, USUARIOS } = require('../soporte/datos');

class PaginaInicioSesion {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.mail = page.getByLabel('Mail');
    this.contrasenia = page.getByLabel('Contraseña', { exact: true });   // exacto: también está el botón "Mostrar contraseña"
    this.botonIngresar = page.getByRole('button', { name: 'Iniciar sesión' });
    this.error = page.getByTestId('inicio-sesion-error');
  }

  // Abre la pantalla de inicio de sesión
  async abrir() {
    await this.page.goto('/vistas/sesion/inicio-sesion.html');
  }

  // Completa el formulario y lo envía
  async ingresar(mail, contrasenia) {
    await this.mail.fill(mail);
    await this.contrasenia.fill(contrasenia);
    await this.botonIngresar.click();
  }

  // Abre la pantalla e inicia sesión con un usuario de ejemplo (soporte/datos.js), y espera a salir de la pantalla
  async ingresarComo(clave) {
    await this.abrir();
    await this.ingresar(USUARIOS[clave].mail, CONTRASENIA);
    await this.page.waitForURL((url) => !url.pathname.endsWith('/inicio-sesion.html'));
  }
}

module.exports = { PaginaInicioSesion };
