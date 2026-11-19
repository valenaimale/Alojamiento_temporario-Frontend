// Page Object de vistas/alojamientos/listado.html: los resultados de una búsqueda.
class PaginaListado {
  // Guarda la página del navegador y ubica los elementos de la pantalla
  constructor(page) {
    this.page = page;
    this.enlacesMapa = page.getByRole('list', { name: 'Alojamientos en el mapa' }).getByRole('link');
    this.resumen = page.getByTestId('resumen-busqueda');
    this.tarjetas = page.getByTestId('tarjeta-alojamiento');
    // El título cambia al terminar: "N alojamientos disponibles", "Busquemos otras fechas" o, si el back falló, "Alojamientos"
    this.titulo = page.getByRole('heading', { level: 1 });
    this.botonReintentar = page.getByRole('button', { name: 'Reintentar' });
  }

  // Si la búsqueda terminó bien, con o sin resultados (un error del back deja el título "Alojamientos")
  busquedaTerminada() {
    return this.page.getByRole('heading', { level: 1, name: /alojamientos? disponibles?$|^Busquemos otras fechas$/ });
  }

  // Abre el detalle del primer resultado y devuelve su nombre
  async abrirPrimerAlojamiento() {
    const enlace = this.tarjetas.first().getByRole('link');
    const nombre = (await enlace.textContent()).trim();
    await enlace.click();
    return nombre;
  }

  // Abre los resultados de una búsqueda directamente por la URL, como si viniera del buscador
  async abrir({ ingreso, egreso, personas = 2 }) {
    const busqueda = new URLSearchParams({ ingreso, egreso, personas: String(personas), localidad_id: '' });
    await this.page.goto(`/vistas/alojamientos/listado.html?${busqueda}`);
  }

  // Abre el mapa público y elige uno de los barrios de los resultados disponibles.
  async filtrarMapaPorBarrio(barrio) {
    await this.page.getByText('Ver alojamientos en el mapa', {exact: true}).click();
    await this.page.getByLabel('Barrio', {exact: true}).selectOption(barrio);
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
