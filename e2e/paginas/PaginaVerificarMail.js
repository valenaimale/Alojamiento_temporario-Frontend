// Page Object de vistas/sesion/verificar-mail.html: adonde lleva el enlace del mail (crea la cuenta del registro).
class PaginaVerificarMail {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.mensaje = page.getByTestId('verificar-mail-mensaje');
    this.botonIrAlInicio = page.getByRole('button', { name: 'Ir al inicio' });
  }

  // Abre el enlace del mail con ese token, como si la persona lo tocara desde su casilla
  async abrir(token) {
    await this.page.goto(`/vistas/sesion/verificar-mail.html?token=${encodeURIComponent(token)}`);
  }
}

module.exports = { PaginaVerificarMail };
