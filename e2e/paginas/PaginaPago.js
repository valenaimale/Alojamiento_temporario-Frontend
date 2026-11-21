// Page Object de vistas/reservas/pagar.html: el pago de la seña, el saldo o una extensión.
// En los E2E el back corre con el pago simulado: el botón dice "Pagar (simulado)" y no abre MetaMask.
class PaginaPago {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.numeroReserva = page.getByTestId('pago-numero-reserva');
    this.montoPesos = page.getByTestId('pago-monto-pesos');
    this.boton = page.getByTestId('pago-boton');
    this.estado = page.getByTestId('pago-estado');
    this.error = page.getByTestId('pago-error');
    this.verMisReservas = page.getByTestId('pago-ver-mis-reservas');
  }

  // Abre el pago de una reserva ("sena" o "saldo")
  async abrir(reservaId, tipo = 'sena') {
    await this.page.goto(`/vistas/reservas/pagar.html?reserva_id=${reservaId}&tipo=${tipo}`);
  }

  // El id de la reserva que se está pagando, leído de la URL
  reservaId() {
    return new URL(this.page.url()).searchParams.get('reserva_id');
  }

  // El id del grupo que se está pagando (reserva grupal, US4.4), leído de la URL
  grupoId() {
    return new URL(this.page.url()).searchParams.get('grupo_id');
  }

  // Paga con el pago simulado y espera a que el back lo confirme
  async pagarSimulado() {
    await this.page.getByRole('button', { name: 'Pagar (simulado)' }).click();
    await this.verMisReservas.waitFor({ state: 'visible' });
  }
}

module.exports = { PaginaPago };
