// Page Object de vistas/alojamientos/detalle.html: el detalle de un alojamiento, el calendario y el botón Reservar.
class PaginaDetalle {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.nombre = page.getByTestId('detalle-nombre');
    this.seleccion = page.getByTestId('detalle-seleccion');
    this.precioTotal = page.getByTestId('detalle-precio-total');
    this.sena = page.getByTestId('detalle-sena');
    this.formReservar = page.getByTestId('detalle-form-reservar');
    this.avisoReservar = page.getByTestId('detalle-aviso-reservar');
    this.errorReserva = page.getByTestId('detalle-error-reserva');
    this.aceptaPolitica = page.getByLabel('Leí y acepto la política de cancelación');
    this.botonReservar = page.getByRole('button', { name: 'Reservar' });
  }

  // El botón del calendario de esa fecha ("AAAA-MM-DD")
  dia(fecha) {
    return this.page.getByTestId(`dia-${fecha}`);
  }

  // Elige las fechas en el calendario: primero la noche de ingreso y después el día de egreso (del mes que se ve)
  async elegirFechas(ingreso, egreso) {
    await this.dia(ingreso).click();
    await this.dia(egreso).click();
  }

  // Acepta la política de cancelación y reserva. Si sale bien, el front lleva a la pantalla de pago
  async reservar() {
    await this.aceptaPolitica.check();
    await this.botonReservar.click();
  }
}

module.exports = { PaginaDetalle };
