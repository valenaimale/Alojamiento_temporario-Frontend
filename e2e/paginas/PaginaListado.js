// Page Object de vistas/alojamientos/listado.html: los resultados de una búsqueda.
class PaginaListado {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.resumen = page.getByTestId('resumen-busqueda');
    this.tarjetas = page.getByTestId('tarjeta-alojamiento');
  }

  // Abre los resultados de una búsqueda directamente por la URL, como si viniera del buscador
  async abrir({ ingreso, egreso, personas = 2 }) {
    const busqueda = new URLSearchParams({ ingreso, egreso, personas: String(personas), localidad_id: '' });
    await this.page.goto(`/vistas/alojamientos/listado.html?${busqueda}`);
  }

  // La tarjeta del alojamiento con ese nombre
  tarjeta(nombre) {
    return this.tarjetas.filter({ has: this.page.getByRole('link', { name: nombre, exact: true }) });
  }

  // Abre el detalle del alojamiento con ese nombre (lleva las mismas fechas y personas)
  async abrirAlojamiento(nombre) {
    await this.tarjeta(nombre).getByRole('link', { name: nombre, exact: true }).click();
  }
}

module.exports = { PaginaListado };
