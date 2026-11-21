// Page Object de vistas/administrador/grupales.html: las reservas grupales del administrador (US4.4).
class PaginaGrupalesAdministrador {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.grupales = page.getByTestId('grupal-administrador');
    this.mensaje = page.getByTestId('grupales-mensaje');
  }

  // Abre la pantalla (la sesión del administrador ya tiene que estar iniciada) y espera la lista
  async abrir() {
    await this.page.goto('/vistas/administrador/grupales.html');
    await this.grupales.first().waitFor();
  }

  // La tarjeta de una grupal, por su título
  grupal(titulo) {
    return this.grupales.filter({ has: this.page.getByRole('heading', { name: titulo, exact: true }) });
  }

  // Activa o desactiva una grupal con su botón
  async cambiarEstado(titulo, accion) {
    await this.grupal(titulo).getByRole('button', { name: `${accion} ${titulo}` }).click();
  }
}

module.exports = { PaginaGrupalesAdministrador };
