// Page Object de vistas/reservas/mis-reservas.html: las reservas del huésped, con su estado y sus pagos.
class PaginaMisReservas {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.tarjetas = page.getByTestId('tarjeta-reserva');
    this.botonHistorial = page.getByRole('button', { name: /Historial/ });
  }

  // Abre Mis reservas (la sesión ya tiene que estar iniciada)
  async abrir() {
    await this.page.goto('/vistas/reservas/mis-reservas.html');
  }

  // Cambia al filtro Historial (las reservas terminadas, canceladas o vencidas)
  async verHistorial() {
    await this.botonHistorial.click();
  }

  // Las tarjetas que se ven con ese estado ("Finalizada", "Confirmada", ...)
  tarjetasConEstado(texto) {
    return this.tarjetas.filter({ has: this.page.getByTestId('estado-reserva').getByText(texto, { exact: true }) });
  }

  // La tarjeta de una reserva, por su id
  tarjeta(reservaId) {
    return this.page.locator(`[data-testid="tarjeta-reserva"][data-reserva-id="${reservaId}"]`);
  }

  // El estado de la reserva ("Confirmada", "Pendiente de pago", ...)
  estado(reservaId) {
    return this.tarjeta(reservaId).getByTestId('estado-reserva');
  }

  // El estado de sus pagos ("Pago: Saldo pendiente", ...)
  estadoPago(reservaId) {
    return this.tarjeta(reservaId).getByTestId('estado-pago-reserva');
  }

  // Toca el botón de pago de la tarjeta ("Pagar la seña", "Pagar el saldo", ...): lleva a la pantalla de pago
  async irAPagar(reservaId) {
    await this.tarjeta(reservaId).getByTestId('accion-pago-reserva').click();
  }
}

module.exports = { PaginaMisReservas };
