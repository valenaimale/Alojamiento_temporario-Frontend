const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function pagina(respuesta) {
  const window={location:{hostname:'localhost',href:'actual'}};
  const avisos=[];
  const context=vm.createContext({
    window, document:{querySelectorAll:()=>[]}, fetch:async()=>respuesta,
    alert:texto=>avisos.push(texto), console:{error(){}}, URLSearchParams,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../funcionalidades/sesion.js'),'utf8'),context);
  return {...vm.runInContext('({obtenerSesion,cerrarSesion})',context),window,avisos};
}
test('solo 401 significa que ya no hay sesión',async()=>{
  assert.equal(await pagina({ok:false,status:401}).obtenerSesion(),null);
  for(const status of [403,404,429,500,503]) {
    await assert.rejects(pagina({ok:false,status}).obtenerSesion());
  }
});
test('sesión válida conserva usuario; JSON incompleto se trata como error',async()=>{
  const usuario={id:1,rol:'huesped'};
  assert.deepEqual(await pagina({ok:true,status:200,json:async()=>({usuario})}).obtenerSesion(),usuario);
  await assert.rejects(pagina({ok:true,status:200,json:async()=>({})}).obtenerSesion());
});
test('un logout rechazado no anuncia cierre ni redirige',async()=>{
  const p=pagina({ok:false,status:503});
  await p.cerrarSesion();
  assert.equal(p.window.location.href,'actual');
  assert.equal(p.avisos.length,1);
  const cerrado=pagina({ok:true,status:200});
  await cerrado.cerrarSesion();
  assert.equal(cerrado.window.location.href,'../homes/index-sin-sesion.html');
});

