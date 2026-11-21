// Edición del punto público y del barrio de una unidad existente.
class PaginaUbicacionUnidad {
  constructor(page) {
    this.page = page;
    this.barrio = page.getByLabel('Barrio', {exact: true});
    this.latitud = page.getByLabel('Latitud', {exact: true});
    this.longitud = page.getByLabel('Longitud', {exact: true});
    this.guardado = page.getByText('Guardamos los cambios.', {exact: true});
  }

  // Abre el formulario del propietario en la unidad elegida.
  async abrir(id) {
    await this.page.goto('/vistas/unidades/datos-unidad.html?id=' + id);
    await this.page.getByText('Ubicación en el mapa (opcional)', {exact: true}).click();
  }

  // Marca el punto, completa el barrio y guarda los datos básicos.
  async guardarPunto(barrio) {
    await this.page.getByLabel('Elegir ubicación pública').click({position: {x: 160, y: 120}});
    await this.barrio.fill(barrio);
    await this.page.getByRole('button', {name: 'Guardar los cambios'}).click();
  }
}

module.exports = { PaginaUbicacionUnidad };
