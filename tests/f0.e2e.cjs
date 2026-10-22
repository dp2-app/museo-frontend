// Pruebas sobre backend real; no se interceptan ni simulan respuestas.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const cuenta = process.env.F0_ACCOUNT_FILE ? JSON.parse(fs.readFileSync(process.env.F0_ACCOUNT_FILE, 'utf8')) : {email:process.env.F0_EMAIL,password:process.env.F0_PASSWORD};
const web = process.env.F0_WEB || 'http://127.0.0.1:5173';
const base = process.env.F0_API || 'http://127.0.0.1:8000/api/v1';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):/,'Solo un entorno local exclusivo de pruebas');
const out = process.env.F0_EVIDENCIA || path.join(process.cwd(), 'evidencia-f0');
fs.mkdirSync(out,{recursive:true});
const report={comprobaciones:[],regresion:[],errores:[]};
const ok = (nombre) => { report.comprobaciones.push(nombre); console.log('OK '+nombre); };
let token, browser, page, originales, creado, pieza, procedencia;
const valoresCreados=[];
async function api(ruta, method='GET', body, expected=200) {
 const r=await fetch(base+ruta,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const text=await r.text(); assert.equal(r.status,expected,`${method} ${ruta}: ${r.status} ${text}`); return text ? JSON.parse(text):null;
}
async function shot(name) { await page.screenshot({path:path.join(out,name+'.png'),fullPage:false}); }
async function tab(nombre) { await page.getByRole('button',{name:nombre,exact:true}).click(); }
async function estado(texto) { await page.getByRole('status').filter({hasText:texto}).waitFor(); }
(async()=>{
 try {
  const login=await api('/auth/login','POST',cuenta);token=login.accessToken;
  assert.ok(token);originales=await api('/config/parametros');
  const campos=await api('/config/campos-ficha');procedencia=campos.find(c=>c.clave==='procedencia');
  browser=await chromium.launch({headless:true,channel:process.env.F0_BROWSER_CHANNEL || 'chrome'});
  const context=await browser.newContext({viewport:{width:1366,height:900}});
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>report.errores.push({url:page.url(),mensaje:e.message}));
  await page.goto(web+'/administracion');await page.getByLabel('Correo',{exact:true}).fill(cuenta.email);
  await page.getByLabel('Contraseña',{exact:true}).fill(cuenta.password);await page.getByRole('button',{name:'Ingresar',exact:true}).click();
  await page.getByRole('heading',{name:'Administración',exact:true}).waitFor();
  await page.getByRole('button',{name:'Crear campo adicional',exact:true}).waitFor();ok('Login v3, permisos y retorno a Administración');
  const compatibilidad=await page.evaluate(async()=>{
   const {extraerMensajeError,erroresPorCampo}=await import('/src/lib/api.ts');
   return {viejo:extraerMensajeError({response:{data:{detail:'Error legado'}}}),
     nuevo:erroresPorCampo({response:{data:{errores:[{campo:'nombre',codigo:'obligatorio',mensaje:'Nombre requerido'}]}}}),
     validacion:erroresPorCampo({response:{data:{detail:[{loc:['body','email'],msg:'Correo inválido',type:'value_error'}]}}})};
  });
  assert.equal(compatibilidad.viejo,'Error legado');assert.equal(compatibilidad.nuevo.nombre,'Nombre requerido');assert.equal(compatibilidad.validacion.email,'Correo inválido');ok('Extractor compatible con errores v3, detail legado y validación Pydantic');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'La cabecera no debe desbordar en escritorio');
  // Filtros sobre el catálogo real y estado vacío, sin alterar la configuración.
  const buscar=page.getByRole('searchbox',{name:'Buscar campos',exact:true});
  await buscar.fill(procedencia.clave);
  assert.equal(await page.getByRole('button',{name:'Editar '+procedencia.etiqueta,exact:true}).count(),1);
  await buscar.fill('sin_resultados_f0_que_no_existe');
  await page.getByText('No se encontraron campos',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();assert.equal(await buscar.inputValue(),'');
  const filtro=page.getByRole('combobox',{name:'Filtrar campos por estado',exact:true});
  for(const [estado,activo] of [['activos',true],['inactivos',false]]) {
   await filtro.selectOption(estado);
   assert.equal(await page.locator('.f0-table tbody tr:not(.f0-group)').count(),campos.filter(c=>c.activo===activo).length);
  }
  await filtro.selectOption('activos');await page.evaluate(()=>window.scrollTo(0,0));await shot('00-catalogo-redisenado');await filtro.selectOption('todos');
  ok('Buscar campos, filtrar activos/inactivos y limpiar un estado sin resultados');
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('Sección de administración',{exact:true}).selectOption('institucion');
  await page.getByRole('heading',{name:'Datos de la institución',exact:true}).waitFor();
  await page.getByLabel('Sección de administración',{exact:true}).selectOption('campos');
  await page.getByRole('button',{name:'Crear campo adicional',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await shot('09-campos-movil');await page.setViewportSize({width:1366,height:900});
  ok('Navegación de Administración accesible en móvil y catálogo sin desborde de página');
  const clave='f0_visual_'+Date.now();
  await page.getByRole('button',{name:'Crear campo adicional',exact:true}).click();
  await page.getByLabel('Clave',{exact:true}).fill(clave);await page.getByLabel('Etiqueta',{exact:true}).fill('Marca del taller F0');
  await page.getByRole('combobox',{name:'Grupo',exact:true}).click();await page.getByRole('button',{name:'Crear grupo',exact:true}).click();await page.getByLabel('Nombre del nuevo grupo',{exact:true}).fill('Pruebas de F0');await page.getByRole('button',{name:'Guardar campo',exact:true}).click();await estado('Campo creado');
  creado=(await api('/config/campos-ficha')).find(c=>c.clave===clave);assert.ok(creado);ok('Crear campo adicional real en el catálogo');
  await shot('01-campos');
  await page.getByRole('button',{name:'Crear campo adicional',exact:true}).click();await page.getByLabel('Clave',{exact:true}).fill(clave);await page.getByLabel('Etiqueta',{exact:true}).fill('Clave duplicada');
  await page.getByRole('button',{name:'Guardar campo',exact:true}).click();await page.locator('#f0-clave-error').waitFor();assert.match(await page.locator('#f0-clave-error').innerText(),/existe/i);await shot('02-error-servidor');ok('Error real 409 del servidor junto al campo');
  await page.getByRole('button',{name:'Cerrar editor',exact:true}).click();
  const lista=(await api('/listas')).find(l=>l.clave==='material');
  await page.getByRole('button',{name:'Crear campo adicional',exact:true}).click();await page.getByLabel('Clave',{exact:true}).fill('lista_'+clave);await page.getByLabel('Etiqueta',{exact:true}).fill('Lista múltiple F0');await page.getByLabel('Tipo de campo',{exact:true}).selectOption('lista');await page.getByLabel('Lista asociada',{exact:true}).selectOption(lista.id);await page.getByLabel('Permite varios valores',{exact:true}).check();await page.getByRole('button',{name:'Guardar campo',exact:true}).click();await estado('Campo creado');
  const campoMulti=(await api('/config/campos-ficha')).find(c=>c.clave==='lista_'+clave);
  await tab('Vista previa');assert.notEqual(await page.locator('#ficha-'+campoMulti.clave).getAttribute('multiple'),null);assert.equal(await page.locator('#ficha-peso_gr').getAttribute('type'),'number');assert.equal(await page.locator('#ficha-fecha_ingreso').getAttribute('type'),'date');await page.locator('#ficha-coleccion_id').waitFor();ok('Creación de lista multivalor y controles de referencia, número y fecha');
  await api('/config/campos-ficha/'+campoMulti.id,'PATCH',{activo:false});await tab('Campos de ficha');
  await page.getByRole('button',{name:'Editar '+procedencia.etiqueta,exact:true}).click();await page.getByLabel('Obligatorio',{exact:true}).check();await page.getByRole('button',{name:'Guardar campo',exact:true}).click();await estado('Campo actualizado');
  let escrituras=0;const detectar=req=>{if(req.method()==='POST'&&req.url()===base+'/piezas')escrituras++;};page.on('request',detectar);
  await tab('Vista previa');await page.getByRole('button',{name:'Comprobar obligatorios',exact:true}).click();await page.locator('#ficha-procedencia-error').waitFor();assert.equal(await page.locator('#ficha-procedencia').getAttribute('aria-invalid'),'true');assert.equal(escrituras,0);page.off('request',detectar);
  await page.locator('#ficha-procedencia').scrollIntoViewIfNeeded();await shot('03-vista-previa');ok('Obligatoriedad vigente en vista previa sin guardar piezas');
  await tab('Campos de ficha');const denominacion=campos.find(c=>c.clave==='denominacion');await page.getByRole('button',{name:'Editar '+denominacion.etiqueta,exact:true}).click();assert.equal(await page.getByLabel('Campo activo',{exact:true}).count(),0);
  const bloqueado=await api('/config/campos-ficha/'+denominacion.id,'PATCH',{activo:false},409);assert.equal(bloqueado.errores[0].codigo,'campo_base');ok('Campo base no desactivable en UI ni por API');await page.getByRole('button',{name:'Cerrar editor',exact:true}).click();
  await tab('Listas de valores');await page.getByLabel('Lista de valores',{exact:true}).selectOption('material');
  const etiqueta='Material F0 '+Date.now();await page.getByLabel('Etiqueta del valor',{exact:true}).fill(etiqueta);await page.getByRole('button',{name:'Guardar valor',exact:true}).click();await estado('Valor creado');
  let valores=await api('/listas/material/valores?incluirInactivos=true');const valor=valores.find(v=>v.etiqueta===etiqueta);assert.ok(valor);valoresCreados.push(valor.id);
  pieza=await api('/piezas','POST',{campos:{denominacion:'Pieza sintética de prueba visual F0',procedencia:'Prueba local'},listas:{materiales:[valor.id]}},201);
  const catalogoActual=await api('/campos-ficha');
  const serializada=await page.evaluate(async({catalogo,pieza})=>{const {datosEditables}=await import('/src/lib/fichaF0.ts');return datosEditables(catalogo,{campos:pieza.campos,listas:{materiales:pieza.listas.materiales.map(v=>v.id)}});},{catalogo:catalogoActual,pieza});
  for(const c of catalogoActual.filter(c=>c.soloLectura))assert.ok(!(c.clave in serializada.campos)&&!(c.clave in serializada.listas));assert.deepEqual(serializada.listas.materiales,[valor.id]);ok('Contrato F2 conserva listas y excluye campos de solo lectura al guardar');
  await tab('Vista previa');await page.getByLabel('Ficha para consultar',{exact:true}).selectOption(pieza.id);
  await page.getByRole('region',{name:'Información faltante',exact:true}).getByText('Código del museo',{exact:true}).waitFor();
  await page.getByRole('region',{name:'Información faltante',exact:true}).getByText('Fotografía',{exact:true}).waitFor();
  await shot('08-faltantes-reales');ok('CamposFaltantes muestra código y foto calculados por el servidor');
  await tab('Listas de valores');await page.getByLabel('Lista de valores',{exact:true}).selectOption('material');
  await page.getByRole('listitem').filter({hasText:etiqueta}).getByRole('button',{name:'Eliminar',exact:true}).click();await page.getByRole('button',{name:'Desactivar valor en uso',exact:true}).click();await estado('Estado del valor actualizado');
  assert.equal((await api('/listas/material/valores?incluirInactivos=true')).find(v=>v.id===valor.id).activo,false);ok('Valor en uso: rechazo real de borrado y desactivación por UI');await shot('04-listas');
  const segundo=etiqueta+' oficial';await page.getByLabel('Etiqueta del valor',{exact:true}).fill(segundo);await page.getByRole('button',{name:'Guardar valor',exact:true}).click();await estado('Valor creado');
  valores=await api('/listas/material/valores?incluirInactivos=true');const oficial=valores.find(v=>v.etiqueta===segundo);valoresCreados.push(oficial.id);
  await page.getByLabel('Texto del Excel',{exact:true}).fill('Variante histórica '+clave);await page.getByLabel('Valor oficial',{exact:true}).selectOption(oficial.id);await page.getByRole('button',{name:'Guardar equivalencia',exact:true}).click();await estado('Equivalencia guardada');
  assert.ok((await api('/listas/material/equivalencias')).some(e=>e.valorId===oficial.id));ok('Equivalencia del Excel guardada contra API real');
  await tab('Institución');await page.getByLabel('Nombre de la institución',{exact:false}).waitFor();assert.equal(await page.getByText('Sin logo configurado.',{exact:false}).count(),1);
  await page.getByLabel('Nombre de la institución',{exact:false}).fill(' ');await page.getByRole('button',{name:'Guardar institución',exact:true}).click();await page.locator('#institucion-nombre-error').waitFor();assert.match(await page.locator('#institucion-nombre-error').innerText(),/vacío/);ok('Error institucional del backend identificado junto al nombre');
  await page.getByLabel('Nombre de la institución',{exact:false}).fill('Museo de prueba visual F0');await page.getByLabel('URL del logo',{exact:true}).fill('ftp://example.org/logo.png');await page.getByRole('button',{name:'Guardar institución',exact:true}).click();await page.locator('#institucion-logo_url-error').waitFor();assert.match(await page.locator('#institucion-logo_url-error').innerText(),/http/);ok('Logo con protocolo inválido rechazado por el servidor junto al campo');
  await page.getByLabel('Nombre de la institución',{exact:false}).fill('Museo de prueba visual F0');await page.getByLabel('URL del logo',{exact:true}).fill(web+'/brand/matp_lockup_positivo.svg');await page.getByRole('button',{name:'Guardar institución',exact:true}).click();await estado('Datos de la institución guardados');
  await page.getByAltText('Logo de la institución',{exact:true}).waitFor();await page.waitForFunction(()=>{const i=document.querySelector('img[alt="Logo de la institución"]');return i&&i.complete&&i.naturalWidth>0;});
  const inv=await api('/reportes/inventario');assert.equal(inv.institucion.nombre,'Museo de prueba visual F0');ok('Nombre/logo reales, vista previa y efecto inmediato en reportes');await page.getByRole('heading',{name:'Administración',exact:true}).scrollIntoViewIfNeeded();await shot('05-institucion');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await shot('06-movil');
  await page.setViewportSize({width:768,height:1024});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await shot('07-tablet');ok('Responsive móvil y tablet sin desborde horizontal');
  // Las páginas ajenas se inspeccionan sin migrarlas: registrar errores previos de contrato.
  for(const [ruta,nombre] of [['/coleccion','Colección'],['/importacion','Importación'],['/consultas-y-reportes','Consultas y reportes']]) {
   const respuestas=[];const observar=res=>{if(res.url().startsWith(base)&&res.status()>=400)respuestas.push({url:res.url().replace(base,''),status:res.status()});};page.on('response',observar);
   const antes=report.errores.length;await page.goto(web+ruta);await page.waitForLoadState('networkidle');
   report.regresion.push({pagina:nombre,contratoLegado:true,respuestas,errores:report.errores.slice(antes)});page.off('response',observar);
  }
  // Otro usuario: el token v3 no concede acceso por conocer la ruta.
  const roles=await api('/roles');const rol=roles.find(r=>r.nombre==='Catalogador/practicante');const email='f0-sin-config-'+Date.now()+'@example.org';
  await api('/usuarios','POST',{nombre:'Catalogador de pruebas F0',email,password:cuenta.password,rolId:rol.id},201);
  const loginOtro=await api('/auth/login','POST',{email,password:cuenta.password});
  const respuesta=await fetch(base+'/config/parametros',{headers:{Authorization:'Bearer '+loginOtro.accessToken}});assert.equal(respuesta.status,403);
  const otro=await browser.newContext({viewport:{width:1280,height:800}});const p2=await otro.newPage();await p2.goto(web+'/login');await p2.evaluate(t=>localStorage.setItem('museo.accessToken',t),loginOtro.accessToken);await p2.goto(web+'/administracion');await p2.waitForURL(web+'/');assert.equal(await p2.getByRole('heading',{name:'Administración',exact:true}).count(),0);await otro.close();ok('Permiso negativo: catalogador sin acceso a configuración por API y ruta');
  // Ninguna excepción de React se acepta dentro de las pantallas F0.
  assert.equal(report.errores.filter(e=>e.url.includes('/administracion')).length,0);
 } catch(e) { report.fallo=String(e.stack||e);if(page)await shot('fallo').catch(()=>{});throw e; }
 finally {
  if(token) {
   if(procedencia)await api('/config/campos-ficha/'+procedencia.id,'PATCH',{obligatorio:procedencia.obligatorio}).catch(()=>{});
   if(creado)await api('/config/campos-ficha/'+creado.id,'PATCH',{activo:false}).catch(()=>{});
   if(originales)for(const p of originales.filter(p=>p.clave.startsWith('institucion.')))await api('/config/parametros/'+p.clave,'PUT',{valor:p.valor}).catch(()=>{});
   if(pieza)await api('/piezas/'+pieza.id+'/baja','POST',{motivo:'Fin de verificación visual F0 local'},204).catch(()=>{});
   for(const id of valoresCreados)await api('/listas/material/valores/'+id,'PATCH',{activo:false}).catch(()=>{});
  }
  fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
