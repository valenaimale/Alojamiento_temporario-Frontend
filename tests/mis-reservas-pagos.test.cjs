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

function pagina(opciones = {}) {
  const elementos = new Map();
  const get = id => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
  };
  let confirmacion;
  const solicitudes=[];
  const previa={reserva_id:42,estado:'confirmada',tramo:'mas_de_30',dias_hasta_cobro:45,porcentaje_retencion:'30.00',pagado:{sena:'42000.00',saldo:'168000.00'},retencion:'12600.00',devolucion:'197400.00',devolucion_wei:'1974000000000000',...opciones.previa};
  const contexto = vm.createContext({
    document: { createElement: elemento, getElementById: get, querySelectorAll: () => [] },
    PagosModelo, Intl, Date, URLSearchParams, encodeURIComponent,
    MENSAJE_SIN_CONEXION:'Sin conexión', console,
    formatearPrecio: valor => `$ ${valor}`, formatearFecha: String, formatearPorcentaje: valor => `${valor} %`,
    pedirAlBack:async(ruta,envio)=>{
      solicitudes.push({ruta,envio});
      if(opciones.pedir){const r=await opciones.pedir(ruta,envio);if(r!==undefined)return r;}
      return {respuesta:{ok:true,status:200},resultado:ruta.startsWith('/reservas/cancelacion?')?previa:ruta==='/reservas/mias'?{reservas:[]}:{ok:'Cancelación registrada',...opciones.resultado}};
    },
    fotoConAncho: valor => valor,
    confirmar: async datos => { confirmacion = datos; return opciones.confirmar === true; },
  });
  const fuente = fs.readFileSync(path.join(__dirname, '../funcionalidades/mis-reservas.js'), 'utf8')
    .replace(/\ncargarPagina\(\);\s*$/, '');
  vm.runInContext(fuente, contexto);
  return { ...vm.runInContext('({tarjetaDeReserva, cancelarReserva, fechaDePagoVisible, mostrarReservas})', contexto),
    get, contexto, solicitudes, confirmacion: () => confirmacion };
}

const reserva = cambios => ({
  id: 42, estado: 'pendiente', ingreso: '2099-02-10', egreso: '2099-02-17',
  noches: 7, personas: 2, importe_total: '500000.00', importe_sena: '100000.00',
  puede_cancelar: true, puede_pagar:true,
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
  const tarjeta = pagina().tarjetaDeReserva(reserva({estado:'confirmada', puede_pagar_saldo:true, saldo:'400000.00'}));
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
    {vence_en:'2020-01-01T12:00:00Z'},
    {estado:'confirmada',saldo:'0.00'},
  ]) assert.equal(cobros(pagina().tarjetaDeReserva(reserva(cambios))).length, 0, JSON.stringify(cambios));
});

test('muestra plazos válidos sin exponer valores inválidos ni enlaces manipulados', () => {
  const p = pagina();
  const tarjeta = p.tarjetaDeReserva(reserva({
    vence_en:'2099-02-01T18:00:00Z',fecha_cobro:'2099-02-05',
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
  const p = pagina({previa:{estado:'pendiente'}});
  await p.cancelarReserva(reserva());
  assert.doesNotMatch(p.confirmacion().detalle, /no pagaste nada|nada que devolver/);
  assert.match(p.confirmacion().detalle, /revisá primero su confirmación/);
  assert.equal(p.solicitudes.length,1);
});

test('reserva pendiente_pago permanece en próximas', () => {
  const p = pagina();
  p.contexto.reservaDePrueba = reserva({estado:'pendiente_pago'});
  vm.runInContext('reservasActuales = [reservaDePrueba]', p.contexto);
  p.mostrarReservas();
  assert.equal(p.get('cantidad-proximas').textContent, 1);
  assert.equal(p.get('lista-reservas').children.length, 1);
});

test('respeta permisos y permite saldar una reserva vencida cuando backend lo habilita',()=>{
  const p=pagina();
  assert.equal(cobros(p.tarjetaDeReserva(reserva({puede_pagar:false}))).length,0);
  const vencida=p.tarjetaDeReserva(reserva({estado:'confirmada',saldo:'400.00',fecha_cobro:'2020-01-01',puede_pagar_saldo:true}));
  assert.equal(cobros(vencida).length,1);
  assert.match(textos(vencida),/Saldo vencido/);
});

test('cancelación muestra desglose antes de POST y conserva resultado pendiente de devolución',async()=>{
  const p=pagina({confirmar:true,resultado:{ok:'Reserva cancelada. La devolución está en proceso: te avisamos por mail',devolucion:{estado:'pendiente',tx_hash:null}}});
  await p.cancelarReserva(reserva({estado:'confirmada'}));
  assert.match(p.confirmacion().detalle,/se retiene todo lo que pagaste/);//con el saldo pago (decisión #62 del back)
  assert.equal(p.confirmacion().datos.at(-1)[1],'$ 197400.00');
  assert.equal(p.solicitudes[0].ruta,'/reservas/cancelacion?reserva_id=42');
  assert.equal(p.solicitudes[1].ruta,'/reservas/cancelar');
  assert.deepEqual(JSON.parse(p.solicitudes[1].envio.body),{reserva_id:42});
  assert.match(p.get('mensaje-ok').textContent,/en proceso/);
  assert.equal(p.get('comprobante-devolucion').hidden,true);
});
test('rechazar diálogo o fallar vista previa nunca cancela',async()=>{
  for(const p of [pagina(),pagina({confirmar:true,previa:{reserva_id:99}}),pagina({confirmar:true,pedir:()=>({respuesta:{ok:false,status:409},resultado:{error:'La estadía ya empezó'}})})]){
    await p.cancelarReserva(reserva({estado:'confirmada'}));
    assert.equal(p.solicitudes.filter(x=>x.ruta==='/reservas/cancelar').length,0);
  }
});
test('conflicto al cancelar muestra el error y no afirma devolución',async()=>{
  const p=pagina({confirmar:true,pedir:ruta=>ruta==='/reservas/cancelar'?{respuesta:{ok:false,status:409},resultado:{error:'La reserva cambió mientras la cancelabas: actualizá la página'}}:undefined});
  await p.cancelarReserva(reserva({estado:'confirmada'}));
  assert.match(p.get('mensaje-error').textContent,/La reserva cambió/);assert.equal(p.get('mensaje-ok').textContent,'');
});
test('identificador de devolución no enlaza al explorador sin red real explícita',async()=>{
  for(const meta of [{},{red:31337,simulado:true},{red:84532,simulado:false}]){
    const hash='0x'+'a'.repeat(64);
    const p=pagina({confirmar:true,resultado:{ok:'Devolución registrada',devolucion:{estado:'confirmado',tx_hash:hash,...meta}}});
    await p.cancelarReserva(reserva({estado:'confirmada'}));
    assert.equal(p.get('hash-devolucion').textContent,hash);
    assert.equal(p.get('enlace-devolucion').hidden,meta.red!==84532);
  }
});
test('doble clic durante consulta no abre dos diálogos ni cancela dos veces',async()=>{
  let resolver;const espera=new Promise(r=>resolver=r);
  const p=pagina({pedir:async ruta=>{if(ruta.startsWith('/reservas/cancelacion?'))await espera;}});
  const primero=p.cancelarReserva(reserva());await p.cancelarReserva(reserva());
  assert.equal(p.solicitudes.length,1);resolver();await primero;
});
