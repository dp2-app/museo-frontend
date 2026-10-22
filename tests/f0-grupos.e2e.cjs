// Pruebas del selector de grupos contra el backend real y la base local exclusiva.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const cuenta = process.env.F0_ACCOUNT_FILE ? JSON.parse(fs.readFileSync(process.env.F0_ACCOUNT_FILE, 'utf8')) : { email: process.env.F0_EMAIL, password: process.env.F0_PASSWORD };
const web = process.env.F0_WEB || 'http://127.0.0.1:5175';
const base = process.env.F0_API || 'http://127.0.0.1:8000/api/v1';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):/);
const out = process.env.F0_EVIDENCIA || path.join(__dirname, 'evidencia');
fs.mkdirSync(out, { recursive: true });
const informe = { comprobaciones: [], errores: [] };
const creados = [];
let token, browser, page;
async function api(ruta, method = 'GET', body) {
  const r = await fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(r.ok, `${method} ${ruta}: ${r.status}`);
  return r.status === 204 ? null : r.json();
}
function ok(nombre) { informe.comprobaciones.push(nombre); console.log('OK ' + nombre); }
async function aviso(texto) { await page.getByRole('status').filter({ hasText: texto }).waitFor(); }
async function shot(nombre) { await page.screenshot({ path: path.join(out, nombre + '.png') }); }
async function grupo() { return page.getByRole('combobox', { name: 'Grupo', exact: true }); }
async function editar(campo) {
  await page.getByRole('row').filter({ hasText: campo.clave }).getByRole('button', { name: 'Editar ' + campo.etiqueta, exact: true }).click();
}
async function nuevo(clave, etiqueta) {
  await page.getByRole('button', { name: 'Crear campo adicional', exact: true }).click();
  await page.getByLabel('Clave', { exact: true }).fill(clave);
  await page.getByLabel('Etiqueta', { exact: true }).fill(etiqueta);
}
(async () => {
  try {
    token = (await api('/auth/login', 'POST', cuenta)).accessToken;
    const catalogo = await api('/config/campos-ficha');
    const grupos = [...new Set(catalogo.map(c => c.grupo))];
    const existente = grupos.find(g => g === 'Identificación') || grupos[0];
    const nombreNuevo = 'Datos del artesano';
    const marca = Date.now();
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    page.on('pageerror', e => informe.errores.push(e.message));
    await page.goto(web + '/administracion');
    await page.getByLabel('Correo', { exact: true }).fill(cuenta.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('button', { name: 'Crear campo adicional', exact: true }).waitFor();

    await nuevo('grupo_existente_' + marca, 'Taller de prueba F0');
    const opciones = await (await grupo()).locator('option').allTextContents();
    assert.equal(opciones.length, new Set(opciones).size);
    for (const g of grupos) assert.ok(opciones.includes(g));
    ok('Grupos del catálogo completos, únicos e independientes de los filtros');
    await (await grupo()).selectOption({ label: existente });
    await page.getByRole('button', { name: 'Guardar campo', exact: true }).click();
    await aviso('Campo creado');
    const a = (await api('/config/campos-ficha')).find(c => c.clave === 'grupo_existente_' + marca);
    creados.push(a.id); assert.equal(a.grupo, existente);
    ok('Crear un campo en un grupo existente y comprobarlo en API');

    await editar(a);
    assert.equal(await (await grupo()).inputValue(), 'existente:' + existente);
    await page.getByRole('form', { name: 'Editar campo', exact: true }).scrollIntoViewIfNeeded();
    await shot('01-editar-grupo-existente');
    await (await grupo()).focus(); await (await grupo()).press('Alt+ArrowDown');
    await shot('02-lista-de-grupos'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cerrar editor', exact: true }).click();
    ok('Edición conserva seleccionado el grupo actual');

    await nuevo('grupo_nuevo_' + marca, 'Marca del taller');
    await (await grupo()).selectOption('nuevo');
    const nombre = page.getByLabel('Nombre del nuevo grupo', { exact: true });
    await nombre.waitFor();
    assert.equal(await nombre.evaluate(e => e === document.activeElement), true);
    assert.equal(await nombre.evaluate(e => e.checkValidity()), false);
    await nombre.fill('   '); assert.equal(await nombre.evaluate(e => e.checkValidity()), false);
    ok('Crear grupo enfoca el nombre y rechaza vacío o solo espacios');
    await nombre.fill('Grupo temporal sin guardar');
    await (await grupo()).selectOption({ label: existente }); assert.equal(await nombre.count(), 0);
    await (await grupo()).selectOption('nuevo'); assert.equal(await nombre.inputValue(), '');
    await nombre.fill('  ' + nombreNuevo + '  ');
    await page.getByRole('form', { name: 'Crear campo', exact: true }).scrollIntoViewIfNeeded();
    await shot('03-crear-nuevo-grupo');
    ok('Volver a un grupo existente cancela la creación sin guardar un grupo');
    await page.getByRole('button', { name: 'Guardar campo', exact: true }).click();
    await aviso('Campo creado');
    const b = (await api('/config/campos-ficha')).find(c => c.clave === 'grupo_nuevo_' + marca);
    creados.push(b.id); assert.equal(b.grupo, nombreNuevo);
    ok('Guardar grupo nuevo con nombre recortado sin cambiar el contrato');

    await page.reload();
    await editar(a);
    assert.equal(await (await grupo()).locator('option').filter({ hasText: nombreNuevo }).count(), 1);
    await (await grupo()).selectOption({ label: nombreNuevo });
    await page.getByRole('form', { name: 'Editar campo', exact: true }).scrollIntoViewIfNeeded();
    await shot('04-reutilizar-grupo');
    await page.getByRole('button', { name: 'Guardar campo', exact: true }).click(); await aviso('Campo actualizado');
    assert.equal((await api('/config/campos-ficha')).find(c => c.id === a.id).grupo, nombreNuevo);
    ok('Grupo persiste tras recargar y se reutiliza al editar otro campo');

    await editar(b);
    await page.setViewportSize({ width: 390, height: 844 });
    await (await grupo()).selectOption('nuevo'); await nombre.fill('Datos del artesano');
    await (await grupo()).scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot('05-nuevo-grupo-movil');
    await page.setViewportSize({ width: 768, height: 1024 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot('06-nuevo-grupo-tablet');
    ok('Selector y nombre del grupo utilizables en móvil y tablet sin desborde');
    await page.setViewportSize({ width: 1366, height: 1000 });
    await editar(a);
    assert.equal(await nombre.count(), 0);
    assert.equal(await (await grupo()).inputValue(), 'existente:' + nombreNuevo);
    ok('Cambiar de campo durante edición reinicia el modo de creación de grupo');
    assert.deepEqual(informe.errores, []);
  } catch (e) {
    informe.fallo = String(e.stack || e);
    if (page) await shot('fallo').catch(() => {});
    throw e;
  } finally {
    for (const id of creados) await api('/config/campos-ficha/' + id, 'PATCH', { activo: false }).catch(() => {});
    fs.writeFileSync(path.join(out, 'resultado.json'), JSON.stringify(informe, null, 2));
    if (browser) await browser.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
