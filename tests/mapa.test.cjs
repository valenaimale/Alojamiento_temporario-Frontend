// Visibilidad y orden del mapa a partir de los resultados que el back ya filtró.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unidadesEnMapa } = require('../funcionalidades/mapa');

// Conserva el listado común y ordena las distancias desconocidas al final.
test('filtra el barrio y ordena por cercanía solo las unidades ubicadas', () => {
  // Arrange
  const unidades = [null, {barrio: 'Sur'}, {barrio: 'Norte', metros_playa: 1},
    {barrio: 'Sur', metros_playa: 25}, {barrio: 'Sur', metros_playa: 0}]
    .map((ubicacion, id) => ({id, ubicacion}));
  // Act
  const visibles = unidadesEnMapa(unidades, 'Sur', 'metros_playa');
  // Assert
  assert.deepEqual(visibles.map(u => u.id), [4, 3, 1]);
  assert.equal(unidades.length, 5);
});
