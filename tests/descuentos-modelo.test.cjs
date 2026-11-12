// Tests de las reglas de los descuentos por estadía larga (funcionalidades/descuentos-modelo.js)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const modelo = require('../funcionalidades/descuentos-modelo.js');

test('valida y ordena los escalones, ignora las filas vacías y acepta coma decimal', () => {
  const { escalones, error } = modelo.validarEscalones([
    { noches_minimas: '14', porcentaje: '15' },
    { noches_minimas: '', porcentaje: '' },
    { noches_minimas: ' 10 ', porcentaje: '12,5' },
  ]);
  assert.equal(error, undefined);
  assert.deepEqual(escalones, [{ noches_minimas: 10, porcentaje: '12.5' }, { noches_minimas: 14, porcentaje: '15' }]);
  assert.deepEqual(modelo.validarEscalones([]), { escalones: [] });
});

test('rechaza noches y porcentajes fuera de rango, repetidos o de más', () => {
  const noches = 'Las noches tienen que ser un número de 2 a 60';
  const porcentaje = 'El descuento tiene que ser un porcentaje mayor que 0 y menor que 100, con hasta 2 decimales';
  for (const [filas, mensaje] of [
    [[{ noches_minimas: '1', porcentaje: '10' }], noches],
    [[{ noches_minimas: '61', porcentaje: '10' }], noches],
    [[{ noches_minimas: '7.5', porcentaje: '10' }], noches],
    [[{ noches_minimas: '', porcentaje: '10' }], noches],
    [[{ noches_minimas: '7', porcentaje: '0' }], porcentaje],
    [[{ noches_minimas: '7', porcentaje: '100' }], porcentaje],
    [[{ noches_minimas: '7', porcentaje: '10.555' }], porcentaje],
    [[{ noches_minimas: '7', porcentaje: '-5' }], porcentaje],
    [[{ noches_minimas: '7', porcentaje: '' }], porcentaje],
    [[{ noches_minimas: '7', porcentaje: '10' }, { noches_minimas: '7', porcentaje: '20' }], 'Hay dos descuentos desde la misma cantidad de noches'],
    [Array.from({ length: 11 }, (_, i) => ({ noches_minimas: String(i + 2), porcentaje: '5' })), 'Podés cargar hasta 10 descuentos por unidad'],
  ]) {
    assert.equal(modelo.validarEscalones(filas).error, mensaje, JSON.stringify(filas));
  }
});

test('a cada estadía le toca el escalón más alto que alcanza', () => {
  const escalones = [{ noches_minimas: 14, porcentaje: '15.00' }, { noches_minimas: 10, porcentaje: '10.00' }];
  assert.equal(modelo.escalonPara(escalones, 9), null);
  assert.equal(modelo.escalonPara(escalones, 10).porcentaje, '10.00');
  assert.equal(modelo.escalonPara(escalones, 13).porcentaje, '10.00');
  assert.equal(modelo.escalonPara(escalones, 30).porcentaje, '15.00');
  assert.equal(modelo.escalonPara([], 30), null);
});

test('solo muestra un descuento cuando el back lo informa bien', () => {
  assert.equal(modelo.tieneDescuento({ porcentaje_descuento: '10.00', importe_sin_descuento: '700000.00' }), true);
  for (const precio of [{ porcentaje_descuento: '0.00', importe_sin_descuento: '700000.00' }, {}, null,
    { porcentaje_descuento: 'abc', importe_sin_descuento: '700000.00' }, { porcentaje_descuento: '10.00' }]) {
    assert.equal(modelo.tieneDescuento(precio), false, JSON.stringify(precio));
  }
  assert.equal(modelo.textoPorcentaje('12.50'), '12,5 %');
});
