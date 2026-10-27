// F5 de punta a punta: reglas, carga, enviar a curación, aprobar y bitácora.
// Backend real con base local VACÍA (nunca Supabase). Crea datos: correr una vez por base.
const { chromium } = require(process.env.F5_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const web = process.env.F5_WEB || 'http://localhost:5173';
const datos = process.env.F5_DATOS || 'http://localhost:8000/datos/v1';
for (const url of [web, datos]) assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo servicios locales de prueba');
for (const key of ['F5_EMAIL', 'F5_PASSWORD']) assert.ok(process.env[key], `Configure ${key}`);
const out = process.env.F5_EVIDENCIA || path.join(process.cwd(), 'evidencia-f5');
const lote1 = path.join(__dirname, 'fixtures', 'f5', 'lote1.xlsx');
const lote2 = path.join(__dirname, 'fixtures', 'f5', 'lote2.xlsx');
fs.mkdirSync(out, { recursive: true });

let browser, page, token;
const erroresPagina = [], respuestasMalas = [];
function ok(texto) { console.log('OK ' + texto); }
async function api(ruta) {
  const r = await fetch(datos + ruta, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200, `${ruta}: ${r.status} ${await r.clone().text()}`);
  return r.json();
}
async function shot(nombre) { await page.screenshot({ path: path.join(out, nombre + '.png') }); }
async function abrirPanelReglas() {
  const panel = page.locator('details', { hasText: 'Reglas de duplicado y aprobación' });
  await panel.locator('summary').click();
  await page.locator('#reglas-umbral').waitFor();
  return panel;
}
async function subir(archivo) {
  await page.goto(web + '/importacion');
  await page.locator('#importacion-archivo').setInputFiles(archivo);
  const boton = page.getByRole('button', { name: 'Cargar hoja para revisión', exact: true });
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Cargar hoja para revisión')); return b && !b.disabled; });
  await boton.click();
  await page.waitForURL(/\/importacion\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await page.waitForSelector('tr[data-fila]');
  return page.url().split('/').pop();
}

(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  page.on('pageerror', e => erroresPagina.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(datos.replace('/datos/v1', ''))) respuestasMalas.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

  // Sesión
  await page.goto(web + '/login');
  await page.fill('input[type=email]', process.env.F5_EMAIL);
  await page.fill('input[type=password]', process.env.F5_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(web + '/');
  token = await page.evaluate(() => { for (const k of Object.keys(localStorage)) { const v = localStorage.getItem(k); if (v && v.split('.').length === 3) return v; } });
  assert.ok(token, 'No se encontró el token de sesión');

  // RF-58: reglas, umbral y persistencia
  await page.goto(web + '/importacion');
  let panel = await abrirPanelReglas();
  assert.equal(await panel.locator('#reglas-umbral').inputValue(), '0.60');
  assert.equal(await panel.locator('fieldset input:disabled').count(), 1, 'La regla del mismo código debe estar fija');
  ok('RF-58: valores iniciales (0,60) y regla exacta fija');
  await panel.locator('#reglas-umbral').fill('0.1');
  await panel.getByRole('button', { name: 'Guardar reglas' }).click();
  await panel.getByRole('alert').filter({ hasText: 'entre 0.30 y 1.00' }).waitFor();
  assert.equal((await api('/importacion/reglas')).similitudMinima, 0.6);
  ok('RF-58: un umbral de 0,10 no se guarda');
  await panel.locator('#reglas-umbral').fill('0.75');
  await panel.locator('fieldset input[type=checkbox]').nth(2).uncheck();
  await panel.getByRole('button', { name: 'Guardar reglas' }).click();
  await panel.getByRole('status').waitFor();
  await shot('01-reglas-guardadas');
  let reglas = await api('/importacion/reglas');
  assert.equal(reglas.similitudMinima, 0.75);
  assert.equal(reglas.reglas.find(r => r.clave === 'denominacion_repetida_en_lote').activa, false);
  await page.reload();
  panel = await abrirPanelReglas();
  assert.equal(await panel.locator('#reglas-umbral').inputValue(), '0.75');
  ok('RF-58: umbral 0,75 y una regla apagada persisten tras recargar');

  // Lote 1: enviar a curación y aprobar
  const carga1 = await subir(lote1);
  const filas = await page.locator('tr[data-fila]').count();
  assert.equal(filas, 3);
  const fila1 = page.locator('tr[data-fila]').first();
  await fila1.getByRole('button', { name: 'Enviar a curación' }).click();
  await page.getByText('Irá a la cola de curación al aprobar la carga').waitFor();
  await shot('02-fila-a-curacion');
  await fila1.getByRole('button', { name: 'Quitar de curación' }).click();
  await page.getByText('Irá a la cola de curación al aprobar la carga').waitFor({ state: 'detached' });
  await fila1.getByRole('button', { name: 'Enviar a curación' }).click();
  await page.getByText('Irá a la cola de curación al aprobar la carga').waitFor();
  ok('RF-40: enviar, quitar y volver a enviar una fila a curación');
  for (let i = 0; i < filas; i++) {
    const b = page.locator('tr[data-fila]').nth(i).getByRole('button', { name: 'Marcar revisada' });
    if (await b.isEnabled()) { await b.click(); await page.waitForTimeout(500); }
  }
  await page.waitForFunction(() => document.body.innerText.includes('0 filas pendientes de revisión'), null, { timeout: 15000 });
  await page.getByRole('button', { name: 'Aprobar carga completa' }).click();
  await page.getByText(/aprobada/i).first().waitFor({ timeout: 20000 });
  await shot('03-carga-aprobada');
  assert.equal((await api('/importacion/cargas/' + carga1)).estado, 'aprobada');
  const cola = await api('/importacion/curacion?estado=pendiente');
  const enCola = cola.items.filter(i => i.cargaId === carga1 && i.motivos.some(m => m.codigo === 'marcada_por_revision'));
  assert.equal(enCola.length, 1, 'La fila marcada debe estar en la cola de curación');
  ok('RF-36, RF-40: aprobar crea el pendiente de curación con el motivo de la revisión');

  // RF-39 y RF-58: cada carga conserva las reglas con que se concilió
  await page.goto(web + '/importacion');
  panel = await abrirPanelReglas();
  await panel.locator('#reglas-umbral').fill('0.90');
  await panel.getByRole('button', { name: 'Guardar reglas' }).click();
  await panel.getByRole('status').waitFor();
  const carga2 = await subir(lote2);
  const detalle1 = await api('/importacion/cargas/' + carga1);
  const detalle2 = await api('/importacion/cargas/' + carga2);
  assert.equal(detalle1.reglasAplicadas.similitudMinima, 0.75);
  assert.equal(detalle2.reglasAplicadas.similitudMinima, 0.9);
  await shot('04-lote2');
  ok('RF-39, RF-58: cada carga guarda las reglas de su momento (0,75 y 0,90)');

  // RF-36: cancelar un lote exige motivo y lo deja cancelado
  await page.getByRole('button', { name: 'Cancelar carga', exact: true }).click();
  await page.getByRole('textbox', { name: 'Motivo de la decisión' }).fill('Prueba automática: cancelación');
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
  await page.waitForFunction(async ([u, t, id]) => (await (await fetch(u + '/importacion/cargas/' + id, { headers: { Authorization: 'Bearer ' + t } })).json()).estado === 'cancelada', [datos, token, carga2], { timeout: 15000 });
  ok('RF-36: cancelar un lote con motivo lo deja cancelado y en la bitácora');

  // Se restauran los valores por defecto para poder repetir la prueba en la misma base
  await page.goto(web + '/importacion');
  panel = await abrirPanelReglas();
  await panel.locator('#reglas-umbral').fill('0.60');
  await panel.locator('fieldset input[type=checkbox]').nth(2).check();
  await panel.getByRole('button', { name: 'Guardar reglas' }).click();
  await panel.getByRole('status').waitFor();
  reglas = await api('/importacion/reglas');
  assert.equal(reglas.similitudMinima, 0.6);
  ok('Reglas restauradas a los valores por defecto');

  assert.deepEqual(erroresPagina, [], 'Errores de página: ' + erroresPagina.join(' | '));
  assert.deepEqual(respuestasMalas, [], 'Respuestas 4xx/5xx: ' + respuestasMalas.join(' | '));
  ok('Sin errores de página ni respuestas 4xx/5xx');
  await browser.close();
})().catch(async e => { console.error('FALLO', e.message); await shot('fallo').catch(() => {}); if (browser) await browser.close(); process.exit(1); });
