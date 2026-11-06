const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PagosModelo = require('../funcionalidades/pagos-modelo.js');

// DOM mínimo para comprobar el contenido y los destinos que recibe el huésped.
function elemento(tag = 'div') {
  return {
    tag, textContent: '', children: [], attributes: {}, hidden: false,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
    addEventListener() {}, focus() {},
  };
}

function pagina() {
  const elementos = new Map();
  const get = id => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
  };
  let confirmacion;
  const contexto = vm.createContext({
    document: { createElement: elemento, getElementById: get, querySelectorAll: () => [] },
    PagosModelo, Intl, Date, URLSearchParams, encodeURIComponent,
    formatearPrecio: valor => `$ ${valor}`, formatearFecha: String,
    fotoConAncho: valor => valor,
    confirmar: async opciones => { confirmacion = opciones; return false; },
  });
  const fuente = fs.readFileSync(path.join(__dirname, '../funcionalidades/mis-reservas.js'), 'utf8')
    .replace(/\ncargarPagina\(\);\s*$/, '');
  vm.runInContext(fuente, contexto);
  return { ...vm.runInContext('({tarjetaDeReserva, cancelarReserva, fechaDePagoVisible, mostrarReservas})', contexto),
    get, contexto, confirmacion: () => confirmacion };
}

const reserva = cambios => ({
  id: 42, estado: 'pendiente', ingreso: '2099-02-10', egreso: '2099-02-17',
  noches: 7, personas: 2, importe_total: '500000.00', importe_sena: '100000.00',
  puede_cancelar: true,
  alojamiento: { id: 3, nombre: 'Casa del río', localidad: 'Tigre', provincia: 'Buenos Aires' },
  ...cambios,
});

const nodos = nodo => typeof nodo === 'object' ? [nodo, ...nodo.children.flatMap(nodos)] : [];
const textos = nodo => nodos(nodo).map(item => item.textContent).join(' ');
const cobros = nodo => nodos(nodo).filter(item => item.tag === 'a' && item.href?.startsWith('pagar.html'));

test('pendiente conserva estado y presenta seña fuera del detalle plegado', () => {
  const p = pagina();
  const tarjeta = p.tarjetaDeReserva(reserva());
  assert.match(textos(tarjeta), /Pago:/);
  assert.equal(cobros(tarjeta).length, 1);
  assert.equal(cobros(tarjeta)[0].href, 'pagar.html?reserva_id=42&tipo=sena');
  assert.equal(cobros(tarjeta)[0].textContent, 'Pagar la seña');
  assert.match(cobros(tarjeta)[0].attributes['aria-label'], /Casa del río/);
  assert.equal(nodos(tarjeta).filter(n => n.tag === 'details').flatMap(cobros).length, 0);
  assert.doesNotMatch(textos(tarjeta), /todavía no está habilitado/);
});

test('confirmada con saldo explícito ofrece saldo y muestra importe del servidor', () => {
  const tarjeta = pagina().tarjetaDeReserva(reserva({estado:'confirmada', monto_faltante:'400000.00'}));
  assert.equal(cobros(tarjeta)[0].href, 'pagar.html?reserva_id=42&tipo=saldo');
  assert.match(textos(tarjeta), /Saldo pendiente \$ 400000.00/);
});

test('confirmada sin información de cobro no inventa pago ni habilita envío', () => {
  const tarjeta = pagina().tarjetaDeReserva(reserva({estado:'confirmada'}));
  assert.equal(cobros(tarjeta).length, 0);
  assert.match(textos(tarjeta), /Estado de pago no informado/);
  assert.doesNotMatch(textos(tarjeta), /Seña pagada|Pago completo/);
});

test('terminales, plazo agotado y saldo cero no ofrecen otro pago', () => {
  for (const cambios of [
    {estado:'cancelada'}, {estado:'finalizada'}, {estado:'expirada'}, {estado:'vencida'},
    {bloqueo_expira_en:'2020-01-01T12:00:00Z'},
    {estado:'confirmada',monto_faltante:'0.00'},
  ]) assert.equal(cobros(pagina().tarjetaDeReserva(reserva(cambios))).length, 0, JSON.stringify(cambios));
});

test('muestra plazos válidos sin exponer valores inválidos ni enlaces manipulados', () => {
  const p = pagina();
  const tarjeta = p.tarjetaDeReserva(reserva({
    bloqueo_expira_en:'2099-02-01T18:00:00Z',fecha_cobro:'2099-02-05',
  }));
  assert.match(textos(tarjeta), /Plazo para la seña:/);
  assert.match(textos(tarjeta), /Vencimiento del saldo:/);
  assert.match(textos(tarjeta), /15:00/);
  const invalida = p.tarjetaDeReserva(reserva({id:'42&tipo=saldo',fecha_cobro:'<script>'}));
  assert.equal(cobros(invalida).length, 0);
  assert.doesNotMatch(textos(invalida), /Invalid Date|<script>|Vencimiento del saldo/);
  assert.equal(p.fechaDePagoVisible('2099-02-01 18:00:00'), '');
});

test('cancelar nunca afirma que no hubo pagos cuando el cobro puede estar en proceso', async () => {
  const p = pagina();
  await p.cancelarReserva(reserva());
  assert.doesNotMatch(p.confirmacion().detalle, /no pagaste nada|nada que devolver/);
  assert.match(p.confirmacion().detalle, /política de cancelación/);
});

test('reserva pendiente_pago permanece en próximas', () => {
  const p = pagina();
  p.contexto.reservaDePrueba = reserva({estado:'pendiente_pago'});
  vm.runInContext('reservasActuales = [reservaDePrueba]', p.contexto);
  p.mostrarReservas();
  assert.equal(p.get('cantidad-proximas').textContent, 1);
  assert.equal(p.get('lista-reservas').children.length, 1);
});
