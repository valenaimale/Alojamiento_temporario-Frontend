// Page Object de vistas/alojamientos/grupal.html: el detalle de una reserva grupal (US4.4), donde se eligen las
// unidades y se reservan juntas.
class PaginaGrupal {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.titulo = page.getByTestId('grupal-titulo');
    this.unidades = page.getByTestId('unidad-grupal');
    this.eleccion = page.getByTestId('grupal-eleccion');
    this.total = page.getByTestId('grupal-total');
    this.sena = page.getByTestId('grupal-sena');
    this.botonReservar = page.getByTestId('grupal-reservar');
    this.error = page.getByTestId('grupal-error');
  }

  // La casilla para elegir una unidad, por su nombre
  casilla(nombre) {
    return this.page.getByRole('checkbox', { name: nombre });
  }

  // Acepta la política de cancelación de cada unidad y reserva las elegidas (lleva a pagar la seña del grupo)
  async reservar() {
    await this.page.getByLabel('Leí y acepto la política de cancelación de cada unidad').check();
    await this.botonReservar.click();
  }
}

module.exports = { PaginaGrupal };
