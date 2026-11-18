// Page Object de vistas/homes/index-operador.html: la agenda de ingresos y egresos del operador.
class PaginaAgenda {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.dias = page.getByTestId('agenda-dias');
    this.vacia = page.getByTestId('agenda-vacia');
    this.movimientos = page.getByTestId('movimiento-agenda');
  }

  // Abre la agenda (la sesión del operador ya tiene que estar iniciada)
  async abrir() {
    await this.page.goto('/vistas/homes/index-operador.html');
  }

  // La tarjeta de un movimiento ("ingreso" o "egreso") de ese huésped
  movimiento(huesped, tipo) {
    return this.page
      .locator(`[data-testid="movimiento-agenda"][data-tipo="${tipo}"]`)
      .filter({ has: this.page.getByRole('heading', { name: huesped, exact: true }) });
  }
}

module.exports = { PaginaAgenda };
