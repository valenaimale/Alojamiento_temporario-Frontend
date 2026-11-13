// Tests de la validación del formulario de búsqueda (funcionalidades/busqueda.js): los mensajes propios que
// reemplazan al globo del navegador
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { problemaDeBusqueda, sumarDias } = require('../funcionalidades/busqueda.js');

const MANANA = '2026-11-14';
const valida = { ingreso: '2026-11-14', egreso: '2026-11-15', personas: '2' };

test('una búsqueda completa y con fechas de mañana en adelante no tiene problemas', () => {
  assert.equal(problemaDeBusqueda(valida, MANANA), null);
  assert.equal(problemaDeBusqueda({ ...valida, personas: '50' }, MANANA), null);
});

test('el ingreso de hoy o anterior se rechaza con la fecha mínima en el mensaje', () => {
  for (const ingreso of ['2026-11-13', '2025-01-01']) {
    assert.deepEqual(problemaDeBusqueda({ ...valida, ingreso }, MANANA), {
      campo: 'ingreso',
      mensaje: 'El ingreso tiene que ser desde el 14/11/2026: para hoy ya no se puede reservar.',
    });
  }
});

test('marca el campo que falta o está mal', () => {
  assert.equal(problemaDeBusqueda({ ...valida, ingreso: '' }, MANANA).campo, 'ingreso');
  assert.equal(problemaDeBusqueda({ ...valida, egreso: '' }, MANANA).campo, 'egreso');
  assert.deepEqual(problemaDeBusqueda({ ...valida, egreso: '2026-11-14' }, MANANA), {
    campo: 'egreso', mensaje: 'El egreso tiene que ser posterior al ingreso.',
  });
  for (const personas of ['0', '51', '2.5', '', 'dos']) {
    assert.equal(problemaDeBusqueda({ ...valida, personas }, MANANA).campo, 'personas', personas);
  }
});

test('sumarDias pasa de mes y de año', () => {
  assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
});
