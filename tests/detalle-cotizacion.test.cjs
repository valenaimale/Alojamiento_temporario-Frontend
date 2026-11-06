const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../funcionalidades/detalle-alojamiento.js'), 'utf8').replace(/\ncargarPagina\(\);\s*$/, '');

function pagina() {
  const elementos = new Map();
  const get = id => {
    if (!elementos.has(id)) elementos.set(id, {
      hidden: false, textContent: '', value: '2', disabled: false,
      elements: { acepta_politica: { checked: false } },
      querySelector: () => get('boton-reservar'), focus() {}, setAttribute() {}, removeAttribute() {},
      children: [], replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
    });
    return elementos.get(id);
  };
  const pedidos = [];
  const window = { location: { search: '?id=1', href: '', pathname: '/vistas/alojamientos/detalle.html' } };
  const contexto = vm.createContext({
    document: { getElementById: get, querySelector: () => null, createElement: tag => ({tag,href:'',textContent:''}) },
    window, history: { replaceState: (_, __, url) => { window.location.search = url; } },
    URLSearchParams, Intl, Date, Map, console: {error(){}},
    MENSAJE_SIN_CONEXION: 'Sin conexión', formatearPrecio: String, formatearFecha: String,
    pedirAlBack: (ruta, opciones) => new Promise((resolve, reject) => pedidos.push({ruta, opciones, resolve, reject})),
  });
  const comunes = fs.readFileSync(path.join(__dirname, '../funcionalidades/unidades-comun.js'), 'utf8');
  const transporte = contexto.pedirAlBack;
  vm.runInContext(comunes, contexto);
  contexto.pedirAlBack = transporte;
  contexto.formatearPrecio = String;
  contexto.formatearFecha = String;
  vm.runInContext(source, contexto);
  const api = vm.runInContext('({estado, calcularEstadia, reservar, elegir, mostrarEstadia, actualizarPersonas})', contexto);
  Object.assign(api.estado, {
    id: 1, ingreso: '2027-02-10', egreso: '2027-02-17', mes: new Date(2027, 1, 1),
    usuario: {id: 2, rol:'huesped', mail_verificado:true, dni:'99000002'},
    alojamiento: {capacidad:4, porcentaje_sena:20, politica:{dias_cobro_saldo:5}},
  });
  vm.runInContext('dibujarCalendario = () => {}; enfocar = () => {};', contexto);
  return { ...api, get, pedidos, window, contexto };
}
const disponible = precio => ({respuesta:{ok:true,status:200}, resultado:{estadia:{disponible:true,noches:7,precio_total:precio,sena:precio/5}}});

test('una respuesta antigua no reemplaza el precio ni las fechas más recientes', {timeout:2000}, async () => {
  const p = pagina();
  const primero = p.calcularEstadia();
  p.estado.ingreso = '2027-03-10'; p.estado.egreso = '2027-03-17';
  const segundo = p.calcularEstadia();
  p.pedidos[1].resolve(disponible(900)); await segundo;
  p.pedidos[0].resolve(disponible(700)); await primero;
  assert.equal(p.get('precio-total').textContent, '900');
  assert.match(p.window.location.search, /ingreso=2027-03-10/);
});

test('se ocultan precio y reserva durante el recálculo y si falla la conexión', {timeout:2000}, async () => {
  const p = pagina();
  let pendiente = p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await pendiente;
  assert.equal(p.get('form-reservar').hidden, false);
  p.get('form-reservar').elements.acepta_politica.checked = true;
  p.get('personas').value = '3';
  pendiente = p.calcularEstadia();
  assert.equal(p.get('precio-estadia').hidden, true);
  assert.equal(p.get('form-reservar').hidden, true);
  assert.equal(p.get('form-reservar').elements.acepta_politica.checked, false);
  p.pedidos[1].reject(Error('offline')); await pendiente;
  assert.equal(p.get('precio-estadia').hidden, true);
  assert.equal(p.get('form-reservar').hidden, true);
  assert.equal(p.get('seleccion').textContent, 'Sin conexión');
});

test('elegir un nuevo ingreso invalida la cotización pendiente', {timeout:2000}, async () => {
  const p = pagina();
  const pendiente = p.calcularEstadia();
  p.estado.meses.set('2027-02', new Map([['2027-02-20', {estado:'libre'}]]));
  await p.elegir('2027-02-20');
  p.pedidos[0].resolve(disponible(700)); await pendiente;
  assert.equal(p.estado.ingreso,'2027-02-20');
  assert.equal(p.estado.egreso,null);
  assert.equal(p.get('form-reservar').hidden,true);
});

test('un error antiguo tampoco pisa la cotización nueva', {timeout:2000}, async () => {
  const p = pagina();
  const anterior = p.calcularEstadia();
  p.get('personas').value='3';
  const actual = p.calcularEstadia();
  p.pedidos[1].resolve(disponible(900)); await actual;
  p.pedidos[0].reject(Error('offline')); await anterior;
  assert.equal(p.get('precio-total').textContent,'900');
  assert.match(p.get('seleccion').textContent,/está disponible/);
});

test('reservar exige cotización vigente y evita envíos duplicados', {timeout:2000}, async () => {
  const p = pagina();
  const form=p.get('form-reservar');
  const evento={preventDefault(){},target:form};
  await p.reservar(evento);
  assert.equal(p.pedidos.length,0);
  const cotizar=p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await cotizar;
  form.elements.acepta_politica.checked=true;
  const guardar=p.reservar(evento);
  const duplicado=p.reservar(evento);
  await duplicado;
  assert.equal(p.pedidos.filter(x=>x.ruta==='/reservas/crear').length,1);
  p.pedidos[1].resolve({respuesta:{ok:true,status:201},resultado:{ok:'Creada',reserva:{id:42}}});
  await guardar;
  assert.equal(p.window.location.href,'../reservas/pagar.html?reserva_id=42&tipo=sena');
  assert.equal(p.get('boton-reservar').disabled,true);
  await p.reservar(evento);
  assert.equal(p.pedidos.length,2);
});

test('crear sin identificador utilizable conserva acceso a Mis reservas', {timeout:2000}, async () => {
  for (const reserva of [undefined, {id:0}, {id:'42&tipo=saldo'}]) {
    const p = pagina();
    const cotizar=p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await cotizar;
    p.get('form-reservar').elements.acepta_politica.checked=true;
    const guardar=p.reservar({preventDefault(){},target:p.get('form-reservar')});
    p.pedidos[1].resolve({respuesta:{ok:true,status:201},resultado:{ok:'Creada',reserva}});
    await guardar;
    assert.equal(p.window.location.href,'../reservas/mis-reservas.html?nueva=1');
  }
});

test('personas distintas a las cotizadas no se envían a reservar', {timeout:2000}, async () => {
  const p = pagina();
  const cotizar=p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await cotizar;
  p.get('personas').value='4';
  p.get('form-reservar').elements.acepta_politica.checked=true;
  await p.reservar({preventDefault(){},target:p.get('form-reservar')});
  assert.equal(p.pedidos.length,1);
});


test('sesión vencida conserva la búsqueda en el enlace para volver a entrar', {timeout:2000}, async () => {
  const p = pagina();
  const cotizar = p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await cotizar;
  p.get('form-reservar').elements.acepta_politica.checked = true;
  const guardar = p.reservar({preventDefault(){},target:p.get('form-reservar')});
  p.pedidos[1].resolve({respuesta:{ok:false,status:401},resultado:{error:'Sesión vencida'}});
  await guardar;
  assert.equal(p.estado.usuario,null);
  assert.equal(p.get('form-reservar').hidden,true);
  const enlace = p.get('aviso-reservar').children.find(x=>x.tag==='a');
  assert.match(enlace.href,/inicio-sesion/);
  assert.match(decodeURIComponent(enlace.href),/ingreso=2027-02-10/);
  assert.match(decodeURIComponent(enlace.href),/personas=2/);
});

test('conflicto de disponibilidad invalida precio y aceptación antes de actualizar calendario', {timeout:2000}, async () => {
  const p = pagina();
  vm.runInContext('cargarMes = async () => {};', p.contexto);
  const cotizar = p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await cotizar;
  p.get('form-reservar').elements.acepta_politica.checked = true;
  const guardar = p.reservar({preventDefault(){},target:p.get('form-reservar')});
  p.pedidos[1].resolve({respuesta:{ok:false,status:409},resultado:{error:'Fechas ocupadas'}});
  await guardar;
  assert.equal(p.estado.cotizacion,null);
  assert.equal(p.get('precio-estadia').hidden,true);
  assert.equal(p.get('form-reservar').hidden,true);
  assert.equal(p.get('form-reservar').elements.acepta_politica.checked,false);
  assert.match(p.get('seleccion').textContent,/ya no están disponibles/);
});

test('editar viajeros invalida inmediatamente valores vacíos, fraccionarios o fuera de capacidad', {timeout:2000}, async () => {
  const p = pagina();
  const cotizar = p.calcularEstadia(); p.pedidos[0].resolve(disponible(700)); await cotizar;
  for (const valor of ['', '0', '5', '1.5']) {
    p.get('personas').value = valor;
    p.actualizarPersonas();
    assert.equal(p.estado.cotizacion,null);
    assert.equal(p.get('precio-estadia').hidden,true);
    assert.equal(p.get('form-reservar').hidden,true);
    assert.match(p.get('seleccion').textContent,/entre 1 y 4/);
    assert.equal(p.pedidos.length,1);
  }
  p.get('personas').value = '3';
  const recuperar = p.actualizarPersonas();
  p.pedidos[1].resolve(disponible(900)); await recuperar;
  assert.equal(p.get('form-reservar').hidden,false);
  assert.equal(p.get('precio-total').textContent,'900');
});
