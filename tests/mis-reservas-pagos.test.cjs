const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PagosModelo = require('../funcionalidades/pagos-modelo.js');
const EstadiasModelo = require('../funcionalidades/estadias-modelo.js');

// DOM mínimo para comprobar el contenido y los destinos que recibe el huésped.
function elemento(tag = 'div') {
  return {
    tag, textContent: '', children: [], attributes: {}, hidden: false, eventos: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
    addEventListener(nombre, callback) { this.eventos[nombre] = callback; }, focus() {},
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
    MENSAJE_SIN_CONEXION:'Sin conexión', console, window: { location: { href: '' } },
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
  return { ...vm.runInContext('({tarjetaDeReserva, cancelarReserva, fechaDePagoVisible, mostrarReservas, agruparReservas, normalizarCotizacionExtension})', contexto),
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

const enCurso = cambios => reserva({estado:'confirmada', saldo:'0.00', puede_extender:true, ...cambios});
const cotizacionExtension = cambios => ({reserva_id:42, noches:2, ingreso:'2099-02-17', egreso:'2099-02-19', importe_total:'30000.00', porcentaje_descuento:'10.00', ...cambios});
const controlesExtension = tarjeta => ({
  abrir:nodos(tarjeta).find(n => n.textContent === 'Extender estadía'),
  formulario:nodos(tarjeta).find(n => n.tag === 'form'),
  noches:nodos(tarjeta).find(n => n.tag === 'input'),
  confirmar:nodos(tarjeta).find(n => n.textContent === 'Confirmar extensión y pagar'),
});
const enviarFormulario = controles => controles.formulario.eventos.submit({preventDefault(){}});

test('Extender estadía requiere puede_extender true del servidor, sin campo estadia',()=>{
  assert.ok(controlesExtension(pagina().tarjetaDeReserva(enCurso())).abrir);
  for(const cambios of [
    {estado:'pendiente'}, {estado:'finalizada'}, {estado:'no_show'}, {estado:'cancelada'},
    {puede_extender:false}, {puede_extender:undefined}, {puede_extender:null},
    {puede_extender:'true'}, {puede_extender:1}, {extiende_reserva_id:21}, {id:'42&noches=4'},
    {extensiones:[{id:43,estado:'pendiente',vence_en:'2099-01-01T00:00:00Z'}]},
    {extensiones:[{id:43,estado:'pendiente',vence_en:null}]},
  ]) assert.equal(controlesExtension(pagina().tarjetaDeReserva(enCurso(cambios))).abrir,undefined,JSON.stringify(cambios));
  assert.ok(controlesExtension(pagina().tarjetaDeReserva(enCurso({extensiones:[{id:43,estado:'pendiente',vence_en:'2020-01-01T00:00:00Z'}]}))).abrir);
});

test('próximas conserva estadía extensible con salida pasada y respeta permiso del servidor',()=>{
  const p=pagina();
  p.contexto.listaDePrueba=[
    enCurso({id:42,ingreso:'2020-01-01',egreso:'2020-01-03'}),
    enCurso({id:43,ingreso:'2020-01-01',egreso:'2020-01-03',puede_extender:false}),
    enCurso({id:44,ingreso:'2020-01-01',egreso:'2020-01-03',puede_extender:undefined}),
    enCurso({id:45,ingreso:'2020-01-01',egreso:'2020-01-03',puede_extender:'true'}),
    reserva({id:46,puede_extender:false}),
    enCurso({id:47,estado:'finalizada',ingreso:'2020-01-01',egreso:'2020-01-03'}),
  ];
  vm.runInContext('reservasActuales = listaDePrueba',p.contexto);
  p.mostrarReservas();
  assert.equal(p.get('cantidad-proximas').textContent,2);
  assert.equal(p.get('cantidad-historial').textContent,4);
  assert.deepEqual(nodos(p.get('lista-reservas')).filter(n=>n.tag==='h2').map(n=>n.id),['reserva-42','reserva-46']);
});

test('no-show informa retención y no permite pagar, cancelar ni extender',()=>{
  const tarjeta=pagina().tarjetaDeReserva(enCurso({estado:'no_show',puede_cancelar:true,puede_pagar:true}));
  assert.match(textos(tarjeta),/No te presentaste: se retuvo lo pagado/);
  assert.equal(cobros(tarjeta).length,0);
  assert.equal(nodos(tarjeta).some(n=>n.textContent==='Cancelar reserva'),false);
  assert.equal(controlesExtension(tarjeta).abrir,undefined);
});

test('agrupa extensiones, actualiza salida confirmada y cuenta una sola reserva',()=>{
  const p=pagina();
  const original=enCurso({ingreso:'2020-01-01',egreso:'2020-01-03'});
  const pagada=reserva({id:43,extiende_reserva_id:42,estado:'confirmada',ingreso:'2020-01-03',egreso:'2099-02-19'});
  const pendiente=reserva({id:44,extiende_reserva_id:42,ingreso:'2099-02-19',egreso:'2099-02-21'});
  p.contexto.listaDePrueba=[original,pagada,pendiente];
  vm.runInContext('reservasActuales = listaDePrueba',p.contexto);
  p.mostrarReservas();
  assert.equal(p.get('cantidad-proximas').textContent,1);
  assert.equal(p.get('lista-reservas').children.length,1);
  const tarjeta=p.get('lista-reservas').children[0];
  assert.match(textos(tarjeta),/Extensión pagada. No se puede cancelar/);
  assert.equal(cobros(tarjeta)[0].href,'pagar.html?reserva_id=44&tipo=sena');
  assert.equal(cobros(tarjeta)[0].textContent,'Pagar la extensión');
  const fechas=nodos(tarjeta).find(n=>n.className==='fechas-reserva');
  assert.match(textos(fechas),/19/);
  assert.doesNotMatch(textos(fechas),/21/);
  assert.equal(p.agruparReservas([{...original,extensiones:[pagada]},pagada])[0].extensiones.length,1);
});

test('cotiza noches extra, confirma una sola vez y redirige al pago de la extensión',async()=>{
  const p=pagina({confirmar:true,pedir:ruta=>({respuesta:{ok:true,status:200},resultado:ruta.startsWith('/reservas/extension?')?cotizacionExtension():{reserva:{id:43}}})});
  const tarjeta=p.tarjetaDeReserva(enCurso());
  const controles=controlesExtension(tarjeta);
  controles.abrir.eventos.click();
  assert.equal(controles.formulario.hidden,false);
  assert.equal(controles.abrir.attributes['aria-expanded'],'true');
  controles.noches.value='2';
  await enviarFormulario(controles);
  assert.equal(p.solicitudes[0].ruta,'/reservas/extension?reserva_id=42&noches=2');
  assert.match(textos(tarjeta),/30000.00.*10 % de descuento/);
  assert.equal(controles.confirmar.hidden,false);
  const primero=controles.confirmar.eventos.click();
  await controles.confirmar.eventos.click();
  await primero;
  assert.equal(p.solicitudes.filter(s=>s.ruta==='/reservas/extender').length,1);
  assert.deepEqual(JSON.parse(p.solicitudes[1].envio.body),{reserva_id:42,noches:2});
  assert.equal(p.contexto.window.location.href,'pagar.html?reserva_id=43&tipo=sena');
});

test('cambiar noches invalida cotización y no se crea extensión sin confirmar',async()=>{
  const p=pagina({pedir:()=>({respuesta:{ok:true,status:200},resultado:cotizacionExtension()})});
  const controles=controlesExtension(p.tarjetaDeReserva(enCurso()));
  controles.noches.value='2';
  await enviarFormulario(controles);
  await controles.confirmar.eventos.click();
  assert.equal(p.solicitudes.length,1);
  controles.noches.value='3';
  controles.noches.eventos.input();
  assert.equal(controles.confirmar.hidden,true);
  await controles.confirmar.eventos.click();
  assert.equal(p.solicitudes.length,1);
});

test('rechaza cotización ajena, importes inválidos y fechas o noches inconsistentes',()=>{
  const p=pagina();
  for(const cambios of [
    {reserva_id:99},{noches:3},{ingreso:'2099-02-18'},{egreso:'2099-02-20'},
    {egreso:'2099-02-30'},{egreso:'2099-99-99'},{importe_total:'-1'},{importe_total:'NaN'},{importe_total:'9'.repeat(400)},
    {porcentaje_descuento:'<script>'},{porcentaje_descuento:101},
  ]) assert.throws(()=>p.normalizarCotizacionExtension(cotizacionExtension(cambios),enCurso(),2));
});

test('noches inválidas y falta de disponibilidad no habilitan confirmación',async()=>{
  const p=pagina({pedir:()=>({respuesta:{ok:false,status:409},resultado:{error:'No hay lugar para esas noches'}})});
  const tarjeta=p.tarjetaDeReserva(enCurso());
  const controles=controlesExtension(tarjeta);
  for(const valor of ['0','-1','1.5','31','NaN','9007199254740992']){
    controles.noches.value=valor;
    await enviarFormulario(controles);
  }
  assert.equal(p.solicitudes.length,0);
  controles.noches.value='2';
  await enviarFormulario(controles);
  assert.match(textos(tarjeta),/No hay lugar/);
  assert.equal(controles.confirmar.hidden,true);
  assert.equal(controles.noches.disabled,false);
});

test('POST incierto pide actualizar y no repite creación ni redirige al cobro',async()=>{
  const p=pagina({confirmar:true,pedir:ruta=>{
    if(ruta==='/reservas/extender')throw new Error('Sin conexión');
    return {respuesta:{ok:true,status:200},resultado:cotizacionExtension()};
  }});
  const tarjeta=p.tarjetaDeReserva(enCurso());
  const controles=controlesExtension(tarjeta);
  controles.noches.value='2';
  await enviarFormulario(controles);
  await controles.confirmar.eventos.click();
  await controles.confirmar.eventos.click();
  assert.equal(p.solicitudes.length,2);
  assert.match(textos(tarjeta),/Actualizá Mis reservas/);
  assert.equal(p.contexto.window.location.href,'');
});

test('agenda muestra límite argentino y lo cierra exactamente a las 24 horas',()=>{
  const r={limite_ingreso:'2026-11-15T17:00:00Z'};
  assert.equal(EstadiasModelo.textoLimiteIngreso(r),'Registrá el ingreso antes de las 14:00 del 15/11.');
  assert.equal(EstadiasModelo.plazoIngresoVencido(r,new Date('2026-11-15T16:59:59Z')),false);
  assert.equal(EstadiasModelo.plazoIngresoVencido(r,new Date('2026-11-15T17:00:00Z')),true);
  for(const limite_ingreso of [null,'','invalido','2026-11-15T14:00:00','2026-11-15 14:00:00','2026-11-15',123]){
    assert.equal(EstadiasModelo.textoLimiteIngreso({limite_ingreso}),'');
    assert.equal(EstadiasModelo.plazoIngresoVencido({limite_ingreso}),false);
  }
});

test('agenda usa salida extendida y evita movimientos duplicados o no-show',()=>{
  const original=enCurso({ingreso:'2026-11-14',egreso_original:'2026-11-16',egreso:'2026-11-19',estadia:{ingreso_en:'2026-11-14T17:00:00Z',egreso_en:null}});
  const movimientos=EstadiasModelo.movimientos([original],'2026-11-15');
  assert.equal(movimientos.length,1);
  assert.equal(movimientos[0].tipo,'egreso');
  assert.equal(movimientos[0].fecha,'2026-11-19');
  assert.deepEqual(EstadiasModelo.movimientos([enCurso({estado:'no_show'}),enCurso({extiende_reserva_id:1})],'2026-11-15'),[]);
});

test('pago encuentra extensión anidada, usa seña completa y bloquea enlace de saldo',async()=>{
  for(const tipo of ['sena','saldo']){
    const elementos=new Map();
    const get=id=>{
      if(!elementos.has(id))elementos.set(id,{...elemento(),classList:{toggle(){}},removeAttribute(){}});
      return elementos.get(id);
    };
    const rutas=[];
    const contexto=vm.createContext({
      document:{getElementById:get,body:{hidden:true}},
      window:{location:{search:`?reserva_id=43&tipo=${tipo}`},addEventListener(){}},
      PagosModelo,Intl,Date,URLSearchParams,encodeURIComponent,
      sessionStorage:{getItem:()=>null},clearTimeout(){},
      obtenerSesion:async()=>({id:7,rol:'huesped'}),tienePermiso:()=>true,armarMenu(){},formatearPrecio:String,
      pedirAlBack:async ruta=>{
        rutas.push(ruta);
        return {respuesta:{ok:true,status:200},resultado:ruta==='/reservas/mias'
          ? {reservas:[enCurso({extensiones:[reserva({id:43,importe_total:'30000.00',importe_sena:'30000.00'})]})]}
          : {reserva_id:43,tipo:'sena',monto_pesos:'30000.00',monto_wei:'300000000000000',pesos_por_eth:'100000000',red:31337,pago:{contrato:null,funcion:'pagarSena',simulado:true}}};
      },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../funcionalidades/pagar.js'),'utf8').replace(/\ncargarPaginaPago\(\);\s*$/,''),contexto);
    await vm.runInContext('cargarPaginaPago()',contexto);
    if(tipo==='sena'){
      assert.equal(get('titulo-pago').textContent,'Pagar la extensión');
      assert.equal(get('error-pago').textContent,'');
      assert.deepEqual(rutas,['/reservas/mias','/pagos/sena?reserva_id=43']);
      assert.equal(get('total-reserva').textContent,get('sena-reserva').textContent);
    }else{
      assert.match(get('error-pago').textContent,/se paga entera/);
      assert.deepEqual(rutas,['/reservas/mias']);
    }
  }
});

test('pendiente con plazo vigente muestra la cuenta regresiva para pagar la seña', () => {
  const vence = new Date(Date.now() + 5 * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  const tarjeta = pagina().tarjetaDeReserva(reserva({ vence_en: vence }));
  const cuenta = nodos(tarjeta).find(n => n.className === 'cuenta-regresiva');
  assert.ok(cuenta);
  assert.match(cuenta.textContent, /^Te quedan 0[45]:\d\d para pagar la seña$/);
  assert.equal(cuenta.attributes['data-vence'], vence);
});

test('expirada: avisa que no se pagó la seña y ofrece volver a reservar con las mismas fechas', () => {
  const tarjeta = pagina().tarjetaDeReserva(reserva({ estado: 'expirada', puede_pagar: false, puede_cancelar: false }));
  assert.match(textos(tarjeta), /Esta reserva expiró: no pagaste la seña a tiempo para confirmarla/);
  const volver = nodos(tarjeta).find(n => n.tag === 'a' && n.textContent === 'Volver a reservar');
  assert.equal(volver.href, '../alojamientos/detalle.html?id=3&ingreso=2099-02-10&egreso=2099-02-17&personas=2');
  assert.equal(cobros(tarjeta).length, 0);
  assert.equal(nodos(tarjeta).some(n => n.textContent === 'Datos de huéspedes'), false);
  assert.equal(nodos(tarjeta).some(n => n.className === 'cuenta-regresiva'), false);
});

test('expirada con fechas pasadas vuelve al alojamiento sin fechas', () => {
  const tarjeta = pagina().tarjetaDeReserva(reserva({ estado: 'expirada', ingreso: '2020-02-10', egreso: '2020-02-12' }));
  const volver = nodos(tarjeta).find(n => n.tag === 'a' && n.textContent === 'Volver a reservar');
  assert.equal(volver.href, '../alojamientos/detalle.html?id=3');
});
