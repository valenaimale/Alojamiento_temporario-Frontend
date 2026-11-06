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
const cotizacion = (cambios = {}) => ({ pago: {
  reserva_id: 42, tipo: 'sena', monto_pesos: '100000.00',
  monto_wei: '1000000000000000', pesos_por_eth: '100000000',
  red: 84532, contrato_direccion: `0x${'2'.repeat(40)}`, ...cambios,
} });
const reserva = (cambios = {}) => ({
  id:42,estado:'pendiente',ingreso:'2099-02-10',egreso:'2099-02-17',noches:7,personas:2,
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
    reservas:[reserva()],cotizacion:cotizacion(),confirmacion:{pago:{estado:'confirmado'}},
    ...opciones,
  };
  const window = {location:{search:opciones.search || '?reserva_id=42&tipo=sena',href:''}};
  const contexto = vm.createContext({
    document:{getElementById:get,body:{hidden:true}},window,URLSearchParams,Intl,Date,
    PagosModelo,encodeURIComponent,navigator:{locks:opciones.locks},
    localStorage:{getItem:clave=>datos.get(clave) ?? null,setItem:(clave,valor)=>{
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
  return {...api,get,datos,solicitudes,llamadas,configuracion,window,contexto};
}

function diferida(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
const confirmaciones = p => p.solicitudes.filter(s=>s.ruta==='/pagos/confirmar');
const cotizaciones = p => p.solicitudes.filter(s=>/^\/pagos\/(sena|saldo)\?/.test(s.ruta));

test('solo confirma éxito luego de que el backend registra el pago',async()=>{
  const respuestaBack=diferida(),solicitudBack=diferida();
  const p=pagina({pedir:async ruta=>{
    if(ruta==='/pagos/confirmar'){solicitudBack.resolve();return respuestaBack.promise;}
  }});
  await p.cargarPaginaPago();
  const pagar=p.pagarReserva();
  await solicitudBack.promise;
  assert.equal(p.estadoDelPago.completo,false);
  assert.match(p.get('estado-pago').textContent,/Registrando/);
  respuestaBack.resolve(respuesta({pago:{estado:'confirmado'}}));
  await pagar;
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(p.get('boton-pagar').hidden,true);
  assert.equal(p.llamadas.enviar,1);
  assert.equal(JSON.parse(confirmaciones(p)[0].envio.body).tx_hash,HASH);
});

test('doble clic mientras MetaMask responde produce un solo envío',async()=>{
  const envio=diferida(),inicio=diferida();
  const p=pagina({enviar:()=>{inicio.resolve();return envio.promise;}});
  await p.cargarPaginaPago();
  const primero=p.pagarReserva();
  await inicio.promise;
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);
  assert.equal(p.get('boton-pagar').disabled,true);
  envio.resolve(HASH);await primero;
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);
});

test('fallo del backend conserva hash y reintenta registro sin firmar ni pagar otra vez',async()=>{
  let intento=0;
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar' && ++intento===1 ? respuesta({error:'Servicio ocupado'},503):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,false);
  assert.equal(JSON.parse(p.datos.get(CLAVE)).hash,HASH);
  assert.equal(p.get('boton-pagar').textContent,'Retomar confirmación');
  await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(p.llamadas.enviar,1);
  assert.equal(p.llamadas.conectar,1);
  assert.equal(confirmaciones(p).length,2);
});

test('recargar después de un envío recupera el hash persistido sin nueva cotización ni firma',async()=>{
  const almacenamiento=new Map([[CLAVE,JSON.stringify({hash:HASH,red:84532})]]);
  const p=pagina({almacenamiento});
  await p.cargarPaginaPago();
  assert.equal(p.estadoDelPago.pendiente.hash,HASH);
  assert.equal(cotizaciones(p).length,0);
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,0);
  assert.equal(p.llamadas.conectar,0);
  assert.equal(p.estadoDelPago.completo,true);
});

test('timeout conserva transacción y repetir acción consulta el mismo hash sin cobrar',async()=>{
  const p=pagina({esperar:async()=>{throw Object.assign(new Error('timeout'),{codigo:'ESPERA_AGOTADA'});}});
  await p.cargarPaginaPago();await p.pagarReserva();await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);
  assert.deepEqual(p.llamadas.esperar,[HASH,HASH]);
  assert.equal(confirmaciones(p).length,0);
  assert.equal(p.estadoDelPago.completo,false);
  assert.equal(JSON.parse(p.datos.get(CLAVE)).hash,HASH);
  assert.match(p.get('error-pago').textContent,/sin volver a pagar/);
});

test('202 o respuesta pendiente nunca se presentan como pago completo',async()=>{
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar' ? respuesta({pago:{estado:'pendiente'}},202):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,false);
  assert.equal(p.get('boton-pagar').textContent,'Retomar confirmación');
  assert.equal(JSON.parse(p.datos.get(CLAVE)).hash,HASH);
  assert.match(p.get('error-pago').textContent,/pendiente de verificación/);
});

test('cambio de cotización exige revisar importe antes de abrir MetaMask',async()=>{
  const p=pagina();await p.cargarPaginaPago();
  p.configuracion.cotizacion=cotizacion({monto_pesos:'200000.00',monto_wei:'2000000000000000'});
  await p.pagarReserva();
  assert.equal(p.llamadas.conectar,0);
  assert.equal(p.llamadas.enviar,0);
  assert.match(p.get('error-pago').textContent,/datos del pago cambiaron/);
  assert.equal(p.get('monto-pesos').textContent,'200000.00');
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);
  assert.equal(p.estadoDelPago.completo,true);
});

test('enlace inválido no consulta reservas ni habilita pago',async()=>{
  for(const search of ['?reserva_id=0','?reserva_id=abc','?reserva_id=42&tipo=devolucion',`?reserva_id=${'9'.repeat(79)}`]){
    const p=pagina({search});await p.cargarPaginaPago();
    assert.equal(p.solicitudes.length,0,search);
    assert.equal(p.get('boton-pagar').disabled,true);
    assert.match(p.get('error-pago').textContent,/enlace de pago no es válido/);
  }
});

test('reserva ajena y reserva terminal no piden cotización ni habilitan cobro',async()=>{
  for(const reservas of [[reserva({id:43})],[reserva({estado:'cancelada'})],[reserva({estado:'finalizada'})]]){
    const p=pagina({reservas});await p.cargarPaginaPago();
    assert.equal(cotizaciones(p).length,0);
    assert.equal(p.get('boton-pagar').disabled,true);
    assert.equal(p.llamadas.enviar,0);
  }
});

test('404 del endpoint muestra indisponibilidad y deja cobro deshabilitado',async()=>{
  const p=pagina({pedir:ruta=>ruta.startsWith('/pagos/sena?') ? respuesta({error:'No existe'},404):undefined});
  await p.cargarPaginaPago();
  assert.equal(p.get('boton-pagar').disabled,true);
  assert.equal(p.estadoDelPago.cotizacion,null);
  assert.match(p.get('error-pago').textContent,/todavía no está disponible/);
  assert.equal(p.get('recargar-pago').hidden,false);
});

test('pago pendiente informado por el servidor se recupera desde otro dispositivo',async()=>{
  const p=pagina({reservas:[reserva({pagos:[{tipo:'sena',estado:'pendiente',tx_hash:HASH}]})]});
  await p.cargarPaginaPago();
  assert.equal(p.estadoDelPago.pendiente.hash,HASH);
  assert.equal(cotizaciones(p).length,0);
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,0);
  assert.equal(p.estadoDelPago.completo,true);
});

test('acelerar transacción guarda y confirma el hash reemplazado',async()=>{
  const p=pagina({confirmacion:{pago:{estado:'pendiente'}},esperar:async(hash,{onReplaced})=>{
    onReplaced({reason:'repriced',transaction:{hash:HASH_NUEVO}});
    return{status:'success',transactionHash:HASH_NUEVO};
  }});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(JSON.parse(p.datos.get(CLAVE)).hash,HASH_NUEVO);
  assert.equal(JSON.parse(confirmaciones(p)[0].envio.body).tx_hash,HASH_NUEVO);
  assert.equal(p.llamadas.enviar,1);
  p.configuracion.confirmacion={pago:{estado:'confirmado'}};
  await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(p.datos.has(CLAVE),false);
});

test('revertido definitivo permite recargar datos sin afirmar pago',async()=>{
  const p=pagina({esperar:async()=>{throw Object.assign(new Error('revertido'),{codigo:'TRANSACCION_FALLIDA',definitivo:true});}});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,false);
  assert.equal(p.estadoDelPago.pendiente,null);
  assert.equal(p.estadoDelPago.cotizacion,null);
  assert.equal(p.datos.has(CLAVE),false);
  assert.equal(p.get('boton-pagar').disabled,true);
  assert.equal(p.get('recargar-pago').hidden,false);
});

test('bloqueo de otra pestaña impide una segunda firma',async()=>{
  const p=pagina({locks:{request:async(clave,opciones,callback)=>callback(null)}});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.llamadas.enviar,0);
  assert.equal(p.llamadas.conectar,0);
  assert.match(p.get('error-pago').textContent,/otra pestaña/);
});

test('fallo de almacenamiento después del envío conserva hash en memoria y permite confirmar sin otro cobro',async()=>{
  const p=pagina({fallarGuardado:clave=>clave===CLAVE});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.estadoDelPago.pendiente.hash,HASH);
  assert.equal(p.datos.has(CLAVE),false);
  assert.equal(p.get('hash-pago').textContent,HASH);
  assert.equal(p.get('transaccion-pago').hidden,false);
  assert.match(p.get('error-pago').textContent,/Copialo antes de cerrar/);
  assert.equal(p.get('boton-pagar').textContent,'Retomar confirmación');
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(confirmaciones(p).length,1);
});

test('sesión vencida al registrar conserva transacción y enlace para volver al mismo pago',async()=>{
  const p=pagina({pedir:ruta=>ruta==='/pagos/confirmar' ? respuesta({error:'Tu sesión venció'},401):undefined});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.equal(p.estadoDelPago.completo,false);
  assert.equal(JSON.parse(p.datos.get(CLAVE)).hash,HASH);
  assert.equal(p.get('sesion-pago').hidden,false);
  assert.match(decodeURIComponent(p.get('sesion-pago').href),/volver=\.\.\/reservas\/pagar\.html\?reserva_id=42&tipo=sena/);
  assert.match(p.get('error-pago').textContent,/sesión venció/);
  p.configuracion.pedir=undefined;
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);
  assert.equal(p.estadoDelPago.completo,true);
});

test('envío incierto persiste bloqueo y oculta pagar incluso después de recargar',async()=>{
  const almacenamiento=new Map();
  const p=pagina({almacenamiento,enviar:async()=>{
    throw Object.assign(new Error('Respuesta perdida de MetaMask'),{codigo:'ENVIO_INCIERTO',envioIncierto:true});
  }});
  await p.cargarPaginaPago();await p.pagarReserva();
  assert.deepEqual(JSON.parse(almacenamiento.get(CLAVE)),{estado:'envio_incierto',red:84532});
  assert.equal(p.get('boton-pagar').hidden,true);
  assert.equal(p.get('recuperar-transaccion').hidden,false);
  assert.equal(p.llamadas.enviar,1);
  assert.equal(confirmaciones(p).length,0);
  await p.pagarReserva();
  assert.equal(p.llamadas.enviar,1);

  const recargada=pagina({almacenamiento});
  await recargada.cargarPaginaPago();
  assert.equal(recargada.estadoDelPago.pendiente.estado,'envio_incierto');
  assert.equal(recargada.get('boton-pagar').hidden,true);
  assert.equal(recargada.get('recuperar-transaccion').hidden,false);
  assert.equal(cotizaciones(recargada).length,0);
  await recargada.pagarReserva();
  assert.equal(recargada.llamadas.enviar,0);
  assert.equal(recargada.llamadas.conectar,0);
  assert.equal(recargada.llamadas.esperar.length,0);
  assert.equal(confirmaciones(recargada).length,0);
});

test('recuperar hash manual consulta red y registra pago sin enviar otra transacción',async()=>{
  const almacenamiento=new Map([[CLAVE,JSON.stringify({estado:'envio_incierto',red:84532})]]);
  const p=pagina({almacenamiento});
  await p.cargarPaginaPago();
  p.get('hash-recuperar').value='incompleto';
  await p.recuperarTransaccionPago({preventDefault(){}});
  assert.equal(p.estadoDelPago.pendiente.estado,'envio_incierto');
  assert.equal(p.llamadas.esperar.length,0);
  assert.match(p.get('error-pago').textContent,/identificador completo/);

  p.get('hash-recuperar').value=` ${HASH} `;
  await p.recuperarTransaccionPago({preventDefault(){}});
  assert.deepEqual(p.llamadas.esperar,[HASH]);
  assert.equal(p.llamadas.enviar,0);
  assert.equal(p.llamadas.conectar,0);
  assert.equal(cotizaciones(p).length,0);
  assert.equal(confirmaciones(p).length,1);
  assert.deepEqual(JSON.parse(confirmaciones(p)[0].envio.body),{reserva_id:'42',tx_hash:HASH});
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(p.get('recuperar-transaccion').hidden,true);
  assert.equal(p.get('boton-pagar').hidden,true);
  assert.equal(almacenamiento.has(CLAVE),false);
});

test('hash pendiente del backend reemplaza envío incierto al recargar y permite confirmar',async()=>{
  const almacenamiento=new Map([[CLAVE,JSON.stringify({estado:'envio_incierto',red:84532})]]);
  const p=pagina({almacenamiento,reservas:[reserva({pagos:[{tipo:'sena',estado:'pendiente',tx_hash:HASH_NUEVO}]})]});
  await p.cargarPaginaPago();
  assert.deepEqual(JSON.parse(almacenamiento.get(CLAVE)),{hash:HASH_NUEVO,red:84532});
  assert.equal(p.estadoDelPago.pendiente.hash,HASH_NUEVO);
  assert.equal(p.get('recuperar-transaccion').hidden,true);
  assert.equal(p.get('boton-pagar').hidden,false);
  assert.equal(p.get('boton-pagar').textContent,'Retomar confirmación');
  assert.equal(cotizaciones(p).length,0);
  await p.pagarReserva();
  assert.deepEqual(p.llamadas.esperar,[HASH_NUEVO]);
  assert.equal(p.llamadas.enviar,0);
  assert.equal(p.llamadas.conectar,0);
  assert.equal(JSON.parse(confirmaciones(p)[0].envio.body).tx_hash,HASH_NUEVO);
  assert.equal(p.estadoDelPago.completo,true);
  assert.equal(almacenamiento.has(CLAVE),false);
});
