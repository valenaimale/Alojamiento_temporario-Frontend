// Page Object de vistas/homes/index-sin-sesion.html: el inicio público, con el buscador.
class PaginaInicio {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.titulo = page.getByRole('heading', { level: 1, name: '¿Dónde querés quedarte?' });
    this.ingreso = page.getByLabel('Ingreso');
    this.egreso = page.getByLabel('Egreso');
    this.personas = page.getByLabel('Cantidad de huéspedes');
    this.botonBuscar = page.getByRole('button', { name: 'Buscar' });
  }

  // Abre el inicio sin sesión
  async abrir() {
    await this.page.goto('/vistas/homes/index-sin-sesion.html');
  }

  // Busca en todos los destinos para esas fechas ("AAAA-MM-DD") y esa cantidad de personas
  async buscar({ ingreso, egreso, personas = 2 }) {
    await this.ingreso.fill(ingreso);
    await this.egreso.fill(egreso);
    await this.personas.fill(String(personas));
    await this.botonBuscar.click();
  }
}

module.exports = { PaginaInicio };
