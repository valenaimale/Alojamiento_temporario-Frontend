const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../funcionalidades/estadias-modelo.js');
function storage(){const datos=new Map();return {getItem:k=>datos.get(k)||null,setItem:(k,v)=>datos.set(k,v)}}
const evento={reserva_id:1,tipo:'ingreso',evento_id:'uuid-estable',ocurrido_en:'2026-10-31T14:00:00Z',notas:'Llaves'};
test('fecha Argentina aun cuando UTC ya cambió de día',()=>{
 assert.equal(M.dia(new Date('2026-11-01T01:00:00Z')),'2026-10-31');
});
test('no supone un ingreso por haber pasado la fecha prevista',()=>{
 const lista=M.movimientos([{id:1,ingreso:'2026-10-30',egreso:'2026-11-03',estadia:null}],'2026-10-31');
 assert.equal(lista[0].tipo,'ingreso');assert.equal(lista[0].fecha,'2026-10-31');
});
test('egreso atrasado sigue hoy; finalizadas solo muestran hecho de hoy',()=>{
 const abierta={id:1,ingreso:'2026-10-25',egreso:'2026-10-30',estadia:{ingreso_en:'2026-10-25T14:00:00Z'}};
 assert.deepEqual(M.movimientos([abierta],'2026-10-31').map(m=>[m.tipo,m.fecha]),[['egreso','2026-10-31']]);
 const cerrada={...abierta,estadia:{...abierta.estadia,egreso_en:'2026-10-31T14:00:00Z'}};
 assert.equal(M.movimientos([cerrada],'2026-10-31').length,1);
 assert.equal(M.movimientos([cerrada],'2026-11-01').length,0);
});
test('cola sobrevive recarga sin cambiar identificador, hora ni notas',()=>{
 const s=storage(), a=M.almacen(s,2);a.borrador('1.ingreso',{notas:'Llaves'});a.agregar(evento);
 const b=M.almacen(s,2);assert.deepEqual(b.leer().pendientes,[evento]);assert.deepEqual(b.leer().borradores,{});
 assert.throws(()=>b.agregar({...evento,evento_id:'otro'}));
 b.quitar(evento.evento_id);assert.equal(a.leer().pendientes.length,0);
});
test('movimientos y borradores de otro operador nunca se mezclan',()=>{
 const s=storage();M.almacen(s,1).agregar(evento);assert.equal(M.almacen(s,2).leer().pendientes.length,0);
});
test('conflicto conserva todos los datos para revisión y reintento',()=>{
 const a=M.almacen(storage(),1);a.agregar(evento);a.error(evento.evento_id,'Ya registrado');
 assert.deepEqual(a.leer().pendientes[0],{...evento,error:'Ya registrado'});
});
test('fallo de almacenamiento se propaga; nunca simula guardado',()=>{
 const a=M.almacen({getItem:()=>null,setItem:()=>{throw new Error('quota')}},1);
 assert.throws(()=>a.agregar(evento),/quota/);
 const roto=M.almacen({getItem:()=>'{roto'},1);assert.throws(()=>roto.leer());
});
