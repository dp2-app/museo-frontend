// F1 · asignar el siguiente código I a varias pendientes (RF-06, museo-backend#170). Backend real con una base local (nunca Supabase).
// Crea 1 pieza con I-00100 y 4 pendientes con una marca única; elige 2, confirma y comprueba los códigos, la lista descargable y lo que queda pendiente.
// F1A_EMAIL y F1A_PASSWORD: administrador de la base local. Requiere que el tipo I sea correlativo (museo-backend#184).
const { chromium } = require(process.env.F1A_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const web = process.env.F1A_WEB || 'http://localhost:5173';
const api = process.env.F1A_API || 'http://localhost:8000/api/v1';
for (const url of [web, api]) assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo servicios locales de prueba');
for (const key of ['F1A_EMAIL', 'F1A_PASSWORD']) assert.ok(process.env[key], `Configure ${key}`);
const ok = (t) => console.log('OK ' + t);

async function llamar(token, ruta, cuerpo) {
  const r = await fetch(api + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) assert.fail(`${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
}

(async () => {
  const sesion = await (await fetch(api + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.F1A_EMAIL, password: process.env.F1A_PASSWORD }) })).json();
  const token = sesion.accessToken; assert.ok(token, 'No se pudo iniciar sesión');
  const tipoI = (await llamar(token, '/tipos-codigo')).find((t) => t.clave === 'I'); assert.ok(tipoI.esCorrelativo, 'El tipo I debe ser correlativo');
  const marca = Date.now().toString(36);
  const mayor = (await llamar(token, `/tipos-codigo/${tipoI.id}/siguiente`)).valor;
  if (!mayor) await llamar(token, '/piezas', { campos: { denominacion: 'Base con I ' + marca }, codigos: [{ tipoCodigoId: tipoI.id, valor: 'I-00100' }] });
  for (const n of ['Alfa', 'Beta', 'Gamma', 'Delta']) await llamar(token, '/piezas', { campos: { denominacion: `${n} ${marca}` } });

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true })).newPage();
  const malas = []; page.on('pageerror', (e) => malas.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(api)) malas.push(`${r.status()} ${r.url()}`); });
  await page.goto(web + '/login'); await page.fill('input[type=email]', process.env.F1A_EMAIL); await page.fill('input[type=password]', process.env.F1A_PASSWORD);
  await page.click('button[type=submit]'); await page.waitForURL(web + '/');
  await page.goto(web + '/coleccion/pendientes-codigo-i');
  await page.getByLabel('Buscar entre las pendientes').fill(marca); await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByText('4 piezas pendientes').waitFor();
  assert.ok(await page.getByRole('button', { name: 'Asignar código I a las elegidas' }).isDisabled());
  ok('sin piezas elegidas el botón masivo está deshabilitado');
  await page.getByLabel(`Elegir Gamma ${marca}`).check(); await page.getByLabel(`Elegir Alfa ${marca}`).check();
  await page.getByRole('button', { name: /Asignar código I a las 2 elegidas/ }).click();
  assert.match(await page.getByRole('alertdialog').innerText(), /escrito en la pieza/);
  await page.getByText(/El primer código será I-\d{5}/).waitFor();
  ok('pide confirmación, avisa que el código queda escrito en la pieza y muestra el primer número');
  await page.getByRole('button', { name: 'Confirmar asignación' }).click();
  await page.getByText('2 códigos I asignados').waitFor();
  const resultado = await page.getByLabel('Resultado de la asignación').innerText();
  assert.match(resultado, new RegExp(`Alfa ${marca}[\\s\\S]*I-\\d{5}[\\s\\S]*Gamma ${marca}[\\s\\S]*I-\\d{5}`));
  ok('asigna el siguiente I a las elegidas, en el orden de la lista');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar lista/ }).click()]);
  const csv = fs.readFileSync(await descarga.path(), 'utf8');
  assert.match(csv, new RegExp(`Alfa ${marca}.*I-\\d{5}`)); assert.match(csv, new RegExp(`Gamma ${marca}.*I-\\d{5}`)); assert.doesNotMatch(csv, /Beta|Delta/);
  ok('la lista descargable trae solo las asignadas');
  await page.getByText(/2 piezas pendientes que coinciden/).waitFor();
  ok('las no elegidas siguen pendientes');
  assert.deepEqual(malas, [], 'Errores: ' + malas.join(' | '));
  ok('Sin errores de página ni respuestas 4xx/5xx');
  await browser.close();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
