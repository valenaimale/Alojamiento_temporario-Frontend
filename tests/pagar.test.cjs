const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PagosModelo = require('../funcionalidades/pagos-modelo.js');

const HASH = `0x${'a'.repeat(64)}`;
const HASH_NUEVO = `0x${'b'.repeat(64)}`;
const CUENTA = `0x${'1'.repeat(40)}`;
const CLAVE = 'haylugar:pago:7:42:sena';
const cotizacion = (cambios = {}) => ({
  reserva_id: 42, tipo: 'sena', monto_pesos: '100000.00',
  monto_wei: '1000000000000000', pesos_por_eth: '100000000',
  red: 31337, pago: {contrato:null,funcion:'pagarSena',simulado:true}, ...cambios,
});
const reserva = (cambios = {}) => ({
  id:42,estado:'pendiente',puede_pagar:true,ingreso:'2099-02-10',egreso:'2099-02-17',noches:7,personas:2,
  importe_total:'500000.00',importe_sena:'100000.00',
  alojamiento:{nombre:'Casa del río',localidad:'Tigre',provincia:'Buenos Aires'},...cambios,
});
const respuesta = (resultado, status = 200) => ({respuesta:{ok:status >= 200 && status < 300,status},resultado});

// El controlador usa DOM, sesión, transporte y billetera sustituidos; las reglas de importes son reales.
function pagina(opciones = {}) {
  const elementos = new Map();
  const get = id => {
    if (!elementos.has(id)) elementos.set(id, {
      hidden:false,disabled:false,textContent:'',value:'',attributes:{},
      classList:{toggle(){}},addEventListener(){},focus(){this.enfocado=true;},
      setAttribute(nombre,valor){this.attributes[nombre]=valor;},
      removeAttribute(nombre){delete this.attributes[nombre];},
    });
    return elementos.get(id);
  };
  const datos = opciones.almacenamiento || new Map();
  const solicitudes = [];
  const llamadas = {conectar:0,enviar:0,esperar:[]};
  const configuracion = {
    reservas:[reserva()],cotizacion:cotizacion(),confirmacion:{ok:'Pagaste la seña',reserva:{id:42,estado:'confirmada'},pago:{tx_hash:HASH,red:31337}},
    ...opciones,
  };
  const eventos={}; const timers=new Map(); let timerId=0;
  let reloj=Date.now();class Fecha extends Date {static now(){return reloj;}}
  const window = {addEventListener:(nombre,fn)=>eventos[nombre]=fn,location:{search:opciones.search || '?reserva_id=42&tipo=sena',href:''}};
  const contexto = vm.createContext({
    document:{getElementById:get,body:{hidden:true}},window,URLSearchParams,Intl,Date:Fecha,
    PagosModelo,encodeURIComponent,crypto:require('node:crypto').webcrypto,
    setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),navigator:{locks:opciones.locks},
    sessionStorage:{getItem:clave=>datos.get(clave) ?? null,setItem:(clave,valor)=>{
      if(configuracion.fallarGuardado?.(clave,valor))throw new Error('QuotaExceededError');
      datos.set(clave,valor);
    },removeItem:clave=>datos.delete(clave)},
    obtenerSesion:async()=>configuracion.usuario === undefined ? {id:7,rol:'huesped'} : configuracion.usuario,
    tienePermiso:rol=>rol==='huesped',armarMenu(){},formatearPrecio:String,
    pedirAlBack:async(ruta,envio)=>{
      solicitudes.push({ruta,envio});
      if (configuracion.pedir) {
        const resultado = await configuracion.pedir(ruta,envio);
        if (resultado !== undefined) return resultado;
      }
      if(ruta==='/reservas/mias')return respuesta({reservas:configuracion.reservas});
      if(ruta.startsWith('/pagos/sena?')||ruta.startsWith('/pagos/saldo?'))return respuesta(configuracion.cotizacion);
      if(ruta==='/pagos/confirmar')return respuesta(configuracion.confirmacion);
      throw new Error(`Ruta no prevista: ${ruta}`);
    },
  });
  const fuente = fs.readFileSync(path.join(__dirname,'../funcionalidades/pagar.js'),'utf8')
    .replace(/\ncargarPaginaPago\(\);\s*$/,'');
  vm.runInContext(fuente,contexto);
  const api = vm.runInContext('({estadoDelPago,cargarPaginaPago,pagarReserva,recuperarTransaccionPago})',contexto);
  api.estadoDelPago.billetera = {
    async conectar(){llamadas.conectar++;return CUENTA;},
    async enviarPago(pago){llamadas.enviar++;return configuracion.enviar ? configuracion.enviar(pago) : HASH;},
    async esperarPago(hash,ajustes){
      llamadas.esperar.push(hash);
      return configuracion.esperar ? configuracion.esperar(hash,ajustes) : {status:'success',transactionHash:hash};
    },
  };
  return {...api,get,datos,solicitudes,llamadas,configuracion,window,contexto,timers,eventos,
    async avanzar(){const [id,{fn,ms}]=timers.entries().next().value;timers.delete(id);assert.ok(ms>0 && ms<=3500);reloj+=ms;await fn();}
  };
}

function diferida(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
const confirmaciones = p => p.solicitudes.filter(s=>s.ruta==='/pagos/confirmar');
const cotizaciones = p => p.solicitudes.filter(s=>/^\/pagos\/(sena|saldo)\?/.test(s.ruta));


const real = () => cotizacion({red:84532,pago:{contrato:CUENTA,funcion:'pagarSena',simulado:false}});

test('simulado registra sin MetaMask, red ni consulta RPC y envía siempre tipo',async()=>{
  const p=pagina();await p.cargarPaginaPago();
  assert.equal(p.get('boton-pagar').textContent,'Pagar (simulado)');
  assert.match(p.get('ayuda-modalidad').textContent,/sin mover dinero/);
  await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(p.llamadas.conectar,0);assert.equal(p.llamadas.enviar,0);assert.equal(p.llamadas.esperar.length,0);
  const body=JSON.parse(confirmaciones(p)[0].envio.body);
  assert.equal(body.tipo,'sena');assert.equal(body.reserva_id,'42');
  assert.match(body.tx_hash,/^0x[0-9a-f]{60}0001$/);
  assert.equal(p.get('enlace-transaccion').hidden,true);
  assert.equal(p.datos.has(CLAVE),false);
});

test('pago real entrega contrato, función y wei exacto a billetera',async()=>{
  let enviada;
  const p=pagina({cotizacion:real(),enviar:pago=>{enviada=pago;return HASH;}});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(enviada.contrato,CUENTA);assert.equal(enviada.funcion,'pagarSena');
  assert.equal(enviada.monto_wei,1000000000000000n);
  assert.equal(p.llamadas.enviar,1);assert.equal(p.llamadas.conectar,1);
  assert.equal(p.estadoDelPago.completo,true);
});

test('doble clic no genera dos pagos ni dos confirmaciones',async()=>{
  const inicio=diferida(),fin=diferida();
  const p=pagina({pedir:ruta=>{if(ruta==='/pagos/confirmar'){inicio.resolve();return fin.promise;}}});
  await p.cargarPaginaPago();const primero=p.pagarReserva();await inicio.promise;
  await p.pagarReserva();assert.equal(confirmaciones(p).length,1);
  assert.equal(p.get('boton-pagar').disabled,true);
  fin.resolve(respuesta({ok:'Pago registrado'}));await primero;
  assert.equal(p.estadoDelPago.completo,true);
});

test('202 consulta cada 3500 ms con mismo hash y tipo hasta recibir 200',async()=>{
  let intento=0;
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar'?respuesta(++intento<3?{pendiente:true}:{ok:'Listo'},intento<3?202:200):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,false);assert.equal(p.get('boton-pagar').disabled,true);
  const hash=JSON.parse(p.datos.get(CLAVE)).hash;
  await p.pagarReserva();assert.equal(intento,1);
  await p.avanzar();assert.equal(intento,2);assert.equal(p.timers.size,1);
  await p.avanzar();assert.equal(p.estadoDelPago.completo,true);assert.equal(p.timers.size,0);
  assert.deepEqual(confirmaciones(p).map(x=>JSON.parse(x.envio.body).tx_hash),[hash,hash,hash]);
  assert.ok(confirmaciones(p).every(x=>JSON.parse(x.envio.body).tipo==='sena'));
});

test('402 limpia intento fallido y Pagar de nuevo genera otro hash',async()=>{
  let intento=0;
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar'&&++intento===1?respuesta({error:'Pago rechazado'},402):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.get('boton-pagar').textContent,'Pagar de nuevo');assert.match(p.get('error-pago').textContent,/Pago rechazado/);
  assert.equal(p.datos.has(CLAVE),false);assert.equal(p.timers.size,0);
  await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,true);
  assert.notEqual(JSON.parse(confirmaciones(p)[0].envio.body).tx_hash,JSON.parse(confirmaciones(p)[1].envio.body).tx_hash);
  const vencida=pagina({pedir:ruta=>ruta==='/pagos/confirmar'?respuesta({error:'Pago rechazado'},402):undefined});
  await vencida.cargarPaginaPago();await vencida.pagarReserva();
  vencida.configuracion.reservas=[reserva({estado:'expirada',puede_pagar:false})];
  await vencida.cargarPaginaPago();
  assert.equal(vencida.get('boton-pagar').disabled,true);
});

test('409 conserva hash, muestra conflicto y no ofrece otro cobro',async()=>{
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar'?respuesta({error:'La reserva ya venció'},409):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();await p.pagarReserva();
  assert.equal(confirmaciones(p).length,1);assert.equal(p.timers.size,0);
  assert.match(p.get('error-pago').textContent,/ya venció/);assert.equal(p.get('boton-pagar').hidden,true);
  assert.ok(p.datos.get(CLAVE));assert.equal(p.estadoDelPago.completo,false);
});

test('recarga recupera sessionStorage y confirma sin cotizar ni generar pago',async()=>{
  const almacenamiento=new Map([[CLAVE,JSON.stringify({hash:HASH,red:31337,simulado:true})]]);
  const p=pagina({almacenamiento});await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(cotizaciones(p).length,0);assert.equal(p.llamadas.conectar,0);
  assert.equal(JSON.parse(confirmaciones(p)[0].envio.body).tx_hash,HASH);assert.equal(p.estadoDelPago.completo,true);
});

test('fallo de red después de enviar conserva hash para reintentar confirmación',async()=>{
  let intento=0;
  const p=pagina({cotizacion:real(),pedir:ruta=>{if(ruta==='/pagos/confirmar'&&++intento===1)throw Error('offline');}});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.get('boton-pagar').textContent,'Retomar confirmación');
  await p.pagarReserva();assert.equal(p.llamadas.enviar,1);assert.equal(p.estadoDelPago.completo,true);
});

test('cambio de monto o modalidad exige revisar antes de enviar',async()=>{
  const p=pagina();await p.cargarPaginaPago();p.configuracion.cotizacion=real();
  await p.pagarReserva();assert.equal(p.llamadas.enviar,0);assert.equal(confirmaciones(p).length,0);
  assert.match(p.get('error-pago').textContent,/datos del pago cambiaron/);
  await p.pagarReserva();assert.equal(p.llamadas.enviar,1);
});

test('saldo usa endpoint y tipo saldo; fecha sin hora conserva día argentino',async()=>{
  const p=pagina({search:'?reserva_id=42&tipo=saldo',reservas:[reserva({estado:'confirmada',saldo:'100000.00',puede_pagar_saldo:true,fecha_cobro:'2099-02-05'})],cotizacion:cotizacion({tipo:'saldo',pago:{simulado:true,contrato:null,funcion:'pagarSaldo'}})});
  await p.cargarPaginaPago();assert.match(p.get('plazo-pago').textContent,/5 feb/);
  await p.pagarReserva();assert.equal(JSON.parse(confirmaciones(p)[0].envio.body).tipo,'saldo');
  assert.equal(cotizaciones(p)[0].ruta,'/pagos/saldo?reserva_id=42');
});

test('permisos falsos, reservas ajenas y terminales no cotizan',async()=>{
  for(const cambios of [{id:43},{puede_pagar:false},{estado:'expirada'},{estado:'cancelada'}]){
    const p=pagina({reservas:[reserva(cambios)]});await p.cargarPaginaPago();
    assert.equal(cotizaciones(p).length,0);assert.equal(p.get('boton-pagar').disabled,true);
  }
});

test('401 conserva transacción y ofrece volver al pago tras iniciar sesión',async()=>{
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar'?respuesta({error:'Tu sesión venció'},401):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.ok(p.datos.get(CLAVE));assert.equal(p.get('sesion-pago').hidden,false);assert.equal(p.timers.size,0);
  assert.match(decodeURIComponent(p.get('sesion-pago').href),/reserva_id=42&tipo=sena/);
});

test('API ausente o enlace inválido nunca habilitan pago',async()=>{
  const p=pagina({pedir:ruta=>ruta.startsWith('/pagos/sena?')?respuesta({error:'No existe'},404):undefined});
  await p.cargarPaginaPago();assert.equal(p.get('boton-pagar').disabled,true);
  for(const search of ['?reserva_id=0','?reserva_id=abc','?reserva_id=42&tipo=devolucion']){
    const q=pagina({search});await q.cargarPaginaPago();assert.equal(q.solicitudes.length,0);
  }
});

test('envío real incierto persiste y permite recuperar hash sin firmar otra vez',async()=>{
  const p=pagina({cotizacion:real(),enviar:()=>{throw Object.assign(Error('RPC perdido'),{envioIncierto:true});}});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(JSON.parse(p.datos.get(CLAVE)).estado,'envio_incierto');assert.equal(p.get('boton-pagar').hidden,true);
  const q=pagina({almacenamiento:p.datos});await q.cargarPaginaPago();
  q.get('hash-recuperar').value=HASH;await q.recuperarTransaccionPago({preventDefault(){}});
  assert.equal(q.llamadas.enviar,0);assert.equal(q.llamadas.conectar,0);assert.equal(q.estadoDelPago.completo,true);
});

test('almacenamiento falla después de enviar: hash queda visible y no se repite cobro',async()=>{
  const p=pagina({cotizacion:real(),fallarGuardado:clave=>clave===CLAVE});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.get('hash-pago').textContent,HASH);assert.equal(p.llamadas.enviar,1);
  await p.pagarReserva();assert.equal(p.llamadas.enviar,1);assert.equal(p.estadoDelPago.completo,true);
});

test('salir de página detiene reintentos automáticos conservando hash',async()=>{
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar'?respuesta({pendiente:true},202):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();p.eventos.pagehide();
  assert.equal(p.timers.size,0);assert.ok(p.datos.get(CLAVE));
});

test('saldo vencido se cotiza y paga; fecha y aviso vienen de la cotización actual',async()=>{
  const p=pagina({search:'?reserva_id=42&tipo=saldo',reservas:[reserva({estado:'confirmada',saldo:'100000.00',puede_pagar_saldo:true,fecha_cobro:'2020-01-01'})],cotizacion:cotizacion({tipo:'saldo',fecha_cobro:'2020-01-02',vencido:true,pago:{simulado:true,contrato:null,funcion:'pagarSaldo'}})});
  await p.cargarPaginaPago();assert.match(p.get('plazo-pago').textContent,/Saldo vencido.*2 ene.*pagalo antes de ingresar/);
  assert.equal(p.get('boton-pagar').disabled,false);await p.pagarReserva();assert.equal(p.estadoDelPago.completo,true);
});
test('202 se pausa a los dos minutos y Volver a verificar conserva el hash',async()=>{
  let estado=202;
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar'?respuesta(estado===202?{mensaje:'Esperá la verificación del backend'}:{ok:'Pagaste el saldo: reserva paga'},estado):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.get('estado-pago').textContent,'Esperá la verificación del backend');
  const hash=JSON.parse(p.datos.get(CLAVE)).hash;
  let veces=0;while(p.timers.size && veces++<40)await p.avanzar();
  assert.equal(p.timers.size,0);assert.equal(p.get('boton-pagar').textContent,'Volver a verificar');
  assert.equal(p.get('boton-pagar').disabled,false);assert.equal(p.estadoDelPago.completo,false);
  assert.equal(JSON.parse(p.datos.get(CLAVE)).hash,hash);estado=200;await p.pagarReserva();
  assert.equal(p.get('aviso-pago').textContent,'Pagaste el saldo: reserva paga');
  assert.ok(confirmaciones(p).every(x=>JSON.parse(x.envio.body).tx_hash===hash));
});
test('404 conserva mensaje del servidor y no habilita cobro',async()=>{
  const p=pagina({pedir:ruta=>ruta.startsWith('/pagos/sena?')?respuesta({error:'No encontramos esa reserva'},404):undefined});
  await p.cargarPaginaPago();assert.equal(p.get('error-pago').textContent,'No encontramos esa reserva');assert.equal(p.get('boton-pagar').disabled,true);
});

test('seña vencida ofrece volver al alojamiento, sin enlazar otra reserva ni ofrecer pagar',async()=>{
  const p=pagina({reservas:[reserva({estado:'expirada',puede_pagar:false,alojamiento:{id:5,nombre:'Casa'}})]});
  await p.cargarPaginaPago();
  assert.equal(p.get('volver-alojamiento').hidden,false);
  assert.equal(p.get('volver-alojamiento').href,'../alojamientos/detalle.html?id=5');
  assert.equal(p.get('boton-pagar').disabled,true);
  assert.equal(cotizaciones(p).length,0);
});

test('una extensión se presenta como extensión: sin seña, con su propio plazo y sin esperar el ingreso',async()=>{
  const p=pagina({
    reservas:[reserva({extiende_reserva_id:41,importe_total:'60000.00',importe_sena:'60000.00',noches:1})],
    cotizacion:{...real(),vence_en:'2099-01-01T15:00:00Z'},
  });
  await p.cargarPaginaPago();
  assert.equal(p.get('concepto-pago').textContent,'Extensión a pagar');
  assert.equal(p.get('etiqueta-total-reserva').textContent,'Total de la extensión');
  assert.equal(p.get('fila-sena-reserva').hidden,true);
  assert.match(p.get('destino-pago-guia').textContent,/ya registraron tu ingreso/);
  assert.match(p.get('plazo-pago').textContent,/^Pagá la extensión antes del/);
  assert.equal(p.get('boton-pagar').textContent,'Pagar la extensión');
});

test('una reserva común sigue mostrando la seña',async()=>{
  const p=pagina({cotizacion:{...real(),vence_en:'2099-01-01T15:00:00Z'}});
  await p.cargarPaginaPago();
  assert.equal(p.get('concepto-pago').textContent,'Seña a pagar');
  assert.equal(p.get('etiqueta-total-reserva').textContent,'Total de la estadía');
  assert.equal(p.get('fila-sena-reserva').hidden,false);
  assert.match(p.get('plazo-pago').textContent,/^Pagá la seña antes del/);
});
