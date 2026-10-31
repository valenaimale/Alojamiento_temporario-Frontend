const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const M=require('../funcionalidades/estadias-modelo.js');
async function pagina(){
 const nodos=new Map(), datos=new Map();
 const nodo=()=>({textContent:'',hidden:false,disabled:false,addEventListener(){},append(){},replaceChildren(){}});
 const estado={sesion:null,respuesta:null,envios:[]};
 const c=vm.createContext({Intl,Date,Map,URLSearchParams,location:{},console,EstadiasModelo:M,
  document:{getElementById:id=>{if(!nodos.has(id))nodos.set(id,nodo());return nodos.get(id)},createElement:nodo},
  window:{addEventListener(){}},obtenerSesion:async()=>estado.sesion,
  localStorage:{getItem:k=>datos.get(k)||null,setItem:(k,v)=>datos.set(k,v)},
  URL_BACK:'http://localhost',fetch:async(url,opts)=>{estado.envios.push(JSON.parse(opts.body)); if(estado.respuesta instanceof Error)throw estado.respuesta;return estado.respuesta},
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../funcionalidades/agenda-operador.js'),'utf8'),c);
 await new Promise(resolve=>setImmediate(resolve));
 estado.sesion={id:1,rol:'operador'};
 vm.runInContext("usuarioAgenda = {id:1,rol:'operador'}; almacenAgenda = EstadiasModelo.almacen(localStorage,1); cargarAgenda = async()=>{};",c);
 const api=vm.runInContext('({enviarPendientes,almacenAgenda})',c);
 api.almacenAgenda.agregar({reserva_id:1,tipo:'ingreso',evento_id:'igual-en-reintentos',ocurrido_en:'2026-10-31T14:00:00Z',notas:'Llaves',alojamiento:'Prueba'});
 return {...api,estado};
}
test('falla de red conserva evento; reconexión envía exactamente el mismo',async()=>{
 const p=await pagina();p.estado.respuesta=new Error('sin conexión');await p.enviarPendientes();
 assert.equal(p.almacenAgenda.leer().pendientes.length,1);
 p.estado.respuesta={ok:true,json:async()=>({ok:'Ingreso registrado'})};await p.enviarPendientes();
 assert.deepEqual(p.estado.envios[0],p.estado.envios[1]);assert.equal(p.almacenAgenda.leer().pendientes.length,0);
 assert.equal('alojamiento' in p.estado.envios[1],false);
});
test('otro usuario o sesión vencida no envía los movimientos guardados',async()=>{
 for(const sesion of [null,{id:2,rol:'operador'},{id:1,rol:'huesped'}]){
  const p=await pagina();p.estado.sesion=sesion;await p.enviarPendientes();
  assert.equal(p.estado.envios.length,0);assert.equal(p.almacenAgenda.leer().pendientes.length,1);
 }
});
test('409 queda para revisión y no entra en bucle automático',async()=>{
 const p=await pagina();p.estado.respuesta={ok:false,status:409,json:async()=>({error:'Ya registrado'})};
 await p.enviarPendientes();await p.enviarPendientes();
 assert.equal(p.estado.envios.length,1);assert.equal(p.almacenAgenda.leer().pendientes[0].error,'Ya registrado');
 await p.enviarPendientes(true);assert.equal(p.estado.envios.length,2);
});
test('dos intentos simultáneos usan un solo envío',async()=>{
 const p=await pagina();p.estado.respuesta={ok:true,json:async()=>({ok:'Ingreso registrado'})};
 await Promise.all([p.enviarPendientes(),p.enviarPendientes()]);assert.equal(p.estado.envios.length,1);
});
