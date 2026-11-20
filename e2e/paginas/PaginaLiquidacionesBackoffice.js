// Page Object de vistas/backoffice/liquidaciones.html: generar y pagar las liquidaciones a mano.
class PaginaLiquidacionesBackoffice {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.sinLiquidar = page.getByTestId('liquidaciones-sin-liquidar');
    this.botonGenerar = page.getByTestId('liquidaciones-generar');
    this.mensaje = page.getByTestId('liquidaciones-mensaje');
    this.filas = page.getByTestId('fila-liquidacion');
  }

  // Abre la pantalla (la sesión del backoffice ya tiene que estar iniciada) y espera a que cuente las reservas
  async abrir() {
    await this.page.goto('/vistas/backoffice/liquidaciones.html');
    await this.page.getByText(/reservas? (esperando|listas?)/).waitFor();
  }

  // La fila de la liquidación de esa unidad y ese huésped
  fila(unidad, huesped) {
    return this.filas.filter({ hasText: unidad }).filter({ hasText: huesped });
  }

  // La situación ("Para pagar", "Pagada"…) de una fila
  situacion(fila) {
    return fila.getByTestId('situacion-liquidacion');
  }

  // El botón "Pagar" de una fila
  botonPagar(fila) {
    return fila.getByRole('button', { name: /^Pagar la liquidación/ });
  }
}

module.exports = { PaginaLiquidacionesBackoffice };
