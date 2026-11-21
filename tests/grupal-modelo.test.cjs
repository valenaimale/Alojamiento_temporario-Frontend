// Las reglas de la reserva grupal en el front (funcionalidades/grupal-modelo.js): qué unidades se pueden elegir,
// cómo se juntan en Mis reservas y el resumen del grupo para pagarlo junto.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../funcionalidades/grupal-modelo.js');

// Las unidades que ofrece una grupal, como las devuelve GET /grupal
function unidades() {
  return [
    { id: 4, capacidad: 6, estadia: { precio_total: '400000.00', sena: '80000.00' } },
    { id: 5, capacidad: 4, estadia: { precio_total: '350000.00', sena: '70000.00' } },
    { id: 6, capacidad: 4, estadia: { precio_total: '350000.00', sena: '70000.00' } },
  ];
}

// Una reserva de GET /reservas/mias, con los cambios de cada test
function reserva(cambios = {}) {
  return {
    id: 1, estado: 'confirmada', ingreso: '2027-01-02', egreso: '2027-01-07', noches: 5, personas: 4,
    importe_total: '350000.00', importe_sena: '70000.00', saldo: '280000.00', fecha_cobro: '2026-12-28',
    puede_pagar: false, puede_pagar_saldo: true, vence_en: null, grupo: { id: 7, titulo: 'Complejo del Bosque' },
    alojamiento: { nombre: 'Cabaña', localidad: 'Mar de las Pampas', provincia: 'Buenos Aires' },
    ...cambios,
  };
}

test('una elección válida suma la capacidad, el total y la seña de las unidades elegidas', () => {
  // Arrange y Act
  const resultado = M.eleccion(unidades(), [4, 5], 9);

  // Assert
  assert.equal(resultado.ok, true);
  assert.equal(resultado.capacidad, 10);
  assert.equal(resultado.total, '750000.00');
  assert.equal(resultado.sena, '150000.00');
});

test('no se puede elegir una sola unidad, ni unidades sin lugar para todos, ni más unidades que personas', () => {
  assert.match(M.eleccion(unidades(), [4], 5).mensaje, /al menos 2 unidades/);
  assert.match(M.eleccion(unidades(), [5, 6], 9).mensaje, /tienen lugar para 8 personas y son 9/);
  assert.equal(M.eleccion(unidades(), [4, 5, 6], 2).mensaje, 'Elegiste más unidades que personas.');
});

test('agrupar junta las reservas del mismo grupo en el lugar de la primera y deja las demás como están', () => {
  // Arrange
  const comun = reserva({ id: 9, grupo: null });
  const lista = [reserva({ id: 1 }), comun, reserva({ id: 2 })];

  // Act
  const resultado = M.agrupar(lista);

  // Assert
  assert.equal(resultado.length, 2);
  assert.equal(M.esGrupo(resultado[0]), true);
  assert.deepEqual(resultado[0].reservas.map(r => r.id), [1, 2]);
  assert.equal(resultado[1], comun);
});

test('el resumen de un grupo pendiente toma el vencimiento de la seña y suma las señas', () => {
  // Arrange
  const reservas = [
    reserva({ id: 1, estado: 'pendiente', puede_pagar: true, vence_en: '2026-11-21T15:00:00Z', saldo: null }),
    reserva({ id: 2, estado: 'pendiente', puede_pagar: true, vence_en: '2026-11-21T15:00:00Z', saldo: null, importe_sena: '80000.00' }),
  ];

  // Act
  const resumen = M.resumen({ id: 7, titulo: 'Complejo del Bosque' }, reservas);

  // Assert
  assert.equal(resumen.estado, 'pendiente');
  assert.equal(resumen.vence_en, '2026-11-21T15:00:00Z');
  assert.equal(resumen.puede_pagar, true);
  assert.equal(resumen.importe_sena, '150000.00');
  assert.equal(resumen.personas, 8);
  assert.equal(resumen.alojamiento.nombre, 'Complejo del Bosque');
});

test('el resumen de un grupo confirmado no cuenta la unidad cancelada y vence en la fecha de cobro más temprana', () => {
  // Arrange
  const reservas = [
    reserva({ id: 1, estado: 'cancelada', saldo: '280000.00', fecha_cobro: '2026-12-20' }),
    reserva({ id: 2, fecha_cobro: '2026-12-28' }),
    reserva({ id: 3, fecha_cobro: '2026-12-26', saldo: '320000.00' }),
  ];

  // Act
  const resumen = M.resumen({ id: 7, titulo: null }, reservas);

  // Assert
  assert.equal(resumen.estado, 'confirmada');
  assert.equal(resumen.saldo, '600000.00');
  assert.equal(resumen.fecha_cobro, '2026-12-26');
  assert.equal(resumen.puede_pagar_saldo, true);
  assert.equal(resumen.alojamiento.nombre, 'Reserva grupal');
});

test('sumar no pierde centavos', () => {
  assert.equal(M.sumar(['0.10', '0.20', '1']), '1.30');
});
