const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../funcionalidades/datos-unidad.js'), 'utf8').replace(/\ncargarPagina\(\);\s*$/, '');

function formulario(cantidad) {
  const avisos = {textContent:''};
  const errores = [];
  const subidas = [];
  let cambio;
  const archivos = {files:[],value:'seleccion',addEventListener:(_,fn)=>{cambio=fn;}};
  const contexto = vm.createContext({
    document:{getElementById:()=>archivos,querySelector:()=>avisos},
    errores, cantidad,
    subirFotos:async(id,files)=>{subidas.push({id,files}); return {fotos:[],errores:[]};},
  });
  vm.runInContext(source,contexto);
  vm.runInContext(`
    unidad = {id:4,fotos:Array.from({length:cantidad},(_,i)=>({id:i}))};
    dibujarFotos = fotos => { fotosActuales = fotos; };
    ocuparFotos = valor => { fotosOcupadas = valor; };
    mostrarErroresDeFotos = lista => { errores.push(...lista); };
    prepararFotos();
  `,contexto);
  return {archivos,errores,subidas,avisos,cambio:()=>cambio()};
}

test('rechaza el lote completo antes de subir si excede los espacios disponibles', async () => {
  const p=formulario(9);
  p.archivos.files=[{name:'a.jpg'},{name:'b.jpg'}];
  await p.cambio();
  assert.equal(p.subidas.length,0);
  assert.match(p.errores[0],/hasta 1 foto más/);
  assert.equal(p.archivos.value,'');
});

test('sin espacios disponibles no intenta una subida externa', async () => {
  const p=formulario(10);
  p.archivos.files=[{name:'a.jpg'}];
  await p.cambio();
  assert.equal(p.subidas.length,0);
  assert.match(p.errores[0],/hasta 0 fotos más/);
});

test('un lote que entra conserva el flujo de subida y su confirmación', async () => {
  const p=formulario(8);
  p.archivos.files=[{name:'a.jpg'},{name:'b.jpg'}];
  await p.cambio();
  assert.equal(p.subidas.length,1);
  assert.equal(p.subidas[0].id,4);
  assert.equal(p.subidas[0].files.length,2);
  assert.equal(p.errores.length,0);
  assert.equal(p.avisos.textContent,'Agregamos 2 fotos.');
});

function ordenador() {
  const originales=[{id:1,orden:0},{id:2,orden:1},{id:3,orden:2}];
  const avisos={textContent:''};
  const errores=[];
  const pedidos=[];
  const foco={veces:0,focus(){this.veces++;}};
  const contexto=vm.createContext({
    originales,errores,document:{getElementById:()=>foco,querySelector:selector=>selector.startsWith('[data-aviso')?avisos:foco},
    pedirAlBack:(ruta,opciones)=>new Promise(resolve=>pedidos.push({ruta,opciones,resolve})),
  });
  vm.runInContext(source,contexto);
  vm.runInContext(`
    unidad = {id:4}; fotosActuales = originales;
    dibujarFotos = fotos => { fotosActuales = fotos; };
    mostrarErroresDeFotos = lista => { errores.push(...lista); };
  `,contexto);
  return {originales,avisos,errores,pedidos,foco,contexto,mover:vm.runInContext('moverFoto',contexto)};
}

test('elegir posición envía un solo pedido y mantiene el foco al terminar', {timeout:2000}, async () => {
  const p=ordenador();
  const guardar=p.mover(p.originales[2],1);
  await p.mover(p.originales[1],3);
  assert.equal(p.pedidos.length,1);
  assert.deepEqual(JSON.parse(p.pedidos[0].opciones.body),{unidad_id:4,foto_id:3,posicion:1});
  const nuevas=[{id:3,orden:0},{id:1,orden:1},{id:2,orden:2}];
  p.pedidos[0].resolve({respuesta:{ok:true},resultado:{fotos:nuevas}});
  await guardar;
  assert.equal(vm.runInContext('fotosActuales',p.contexto),nuevas);
  assert.equal(p.foco.veces,1);
  assert.match(p.avisos.textContent,/ahora la foto principal/);
});

test('si falla el guardado restaura el orden previo y permite reintentar', {timeout:2000}, async () => {
  const p=ordenador();
  const guardar=p.mover(p.originales[0],3);
  p.pedidos[0].resolve({respuesta:{ok:false},resultado:{error:'No se pudo guardar'}});
  await guardar;
  assert.equal(vm.runInContext('fotosActuales',p.contexto),p.originales);
  assert.equal(vm.runInContext('fotosOcupadas',p.contexto),false);
  assert.equal(p.foco.veces,1);
  assert.deepEqual(p.errores,['No se pudo guardar']);
  assert.equal(p.avisos.textContent,'');
});
