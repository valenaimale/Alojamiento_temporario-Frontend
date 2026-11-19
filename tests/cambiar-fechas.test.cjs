// Validación de la cotización que se muestra antes de confirmar el cambio.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarVistaCambio } = require('../funcionalidades/cambiar-fechas');

const pedido = { reserva_id: 2, ingreso: '2026-12-04', egreso: '2026-12-09' };

// Un precio cero explícito permite continuar sin pago.
test('acepta una reducción con retención informada y sin pago', () => {
  // Arrange
  const vista = {...pedido, a_pagar: 0, retencion: '30.50', a_devolver: 40, cotizacion_id: 'abc'};
  // Act
  const resultado = validarVistaCambio(vista, pedido);
  // Assert
  assert.equal(resultado.retencion, '30.50');
});

// Una cotización incompleta o de otras fechas nunca habilita el envío.
test('rechaza importes ausentes o fechas distintas a las elegidas', () => {
  // Arrange
  const vista = {...pedido, a_pagar: '', retencion: 0, a_devolver: 0, cotizacion_id: 'abc'};
  // Act
  const validar = cambios => validarVistaCambio({...vista, ...cambios}, pedido);
  // Assert
  assert.throws(() => validar({}));
  assert.throws(() => validar({a_pagar: 1, ingreso: '2026-12-05'}));
});
