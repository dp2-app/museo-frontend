// F7 de punta a punta: filtros de la pantalla Colección (texto sin tildes, por palabras, comodines como texto, atributos).
// Backend real con una base local (nunca Supabase). Crea 3 piezas con una marca única: se puede repetir en la misma base.
// Opcional: F7_CI_EMAIL y F7_CI_PASSWORD (Consulta interna) para comprobar que un 403 no se reintenta (#107).
const { chromium } = require(process.env.F7_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

const web = process.env.F7_WEB || 'http://localhost:5173';
const api = process.env.F7_API || 'http://localhost:8000/api/v1';
for (const url of [web, api]) assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo servicios locales de prueba');
for (const key of ['F7_EMAIL', 'F7_PASSWORD']) assert.ok(process.env[key], `Configure ${key}`);
const marca = 'zq' + Date.now().toString(36);
const ok = (t) => console.log('OK ' + t);

async function llamar(token, ruta, cuerpo) {
  const r = await fetch(api + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) assert.fail(`${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
}

(async () => {
  const sesion = await (await fetch(api + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.F7_EMAIL, password: process.env.F7_PASSWORD }) })).json();
  const token = sesion.accessToken;
  assert.ok(token, 'No se pudo iniciar sesión');
  await llamar(token, '/piezas', { campos: { denominacion: `Retablo de Cerámica ${marca}`, autor: 'José Álvarez', descripcion: 'Escena del nacimiento con pastores' } });
  await llamar(token, '/piezas', { campos: { denominacion: `Mate burilado ${marca}`, autor: 'Anónimo' } });
  await llamar(token, '/piezas', { campos: { denominacion: `100% algodón ${marca}`, autor: 'Ana_B' } });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const malas = [];
  page.on('pageerror', (e) => malas.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(api)) malas.push(`${r.status()} ${r.url()}`); });
  await page.goto(web + '/login');
  await page.fill('input[type=email]', process.env.F7_EMAIL); await page.fill('input[type=password]', process.env.F7_PASSWORD);
  await page.click('button[type=submit]'); await page.waitForURL(web + '/');
  await page.goto(web + '/coleccion');
  await page.getByLabel('Texto de la ficha', { exact: true }).waitFor();

  async function abrirAvanzados() {
    const boton = page.getByRole('button', { name: /Filtros avanzados/ });
    if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  }

  async function buscar(texto, extra = {}) {
    await page.getByLabel('Texto de la ficha', { exact: true }).fill(texto);
    if (Object.keys(extra).length) await abrirAvanzados();
    for (const [etiqueta, valor] of Object.entries(extra)) await page.getByLabel(etiqueta, { exact: true }).fill(valor);
    const respuesta = page.waitForResponse((r) => r.url().startsWith(api + '/piezas?') && r.request().method() === 'GET'
      && new URL(r.url()).searchParams.get('q') === texto);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    const cuerpo = await (await respuesta).json();
    await page.waitForTimeout(300);
    return cuerpo.items.map((p) => p.campos.denominacion);
  }

  assert.deepEqual(await buscar(`ceramica ${marca}`), [`Retablo de Cerámica ${marca}`]);
  assert.deepEqual(await buscar(`JOSE ALVAREZ ${marca}`), [`Retablo de Cerámica ${marca}`]);
  ok('RF-42: el texto no distingue mayúsculas ni tildes');
  assert.deepEqual(await buscar(`nacimiento ${marca} retablo`), [`Retablo de Cerámica ${marca}`]);
  ok('RF-43: cada palabra en cualquier campo y orden');
  assert.deepEqual(await buscar(`% ${marca}`), [`100% algodón ${marca}`]);
  ok('Los comodines se buscan como texto');
  assert.deepEqual(await buscar(marca, { Autor: 'anonimo' }), [`Mate burilado ${marca}`]);
  ok('RF-42: filtro por atributo (autor) sin tildes, combinado con el texto');
  await abrirAvanzados();
  for (const etiqueta of ['Material', 'Tipo de bien', 'Clasificación', 'Procedencia', 'Estado de conservación', 'Ubicación']) {
    await page.locator('form label.form-label', { hasText: etiqueta }).first().waitFor();
  }
  ok('RF-42: la pantalla ofrece los filtros por atributo');
  // museo-frontend#102: la columna se llama «Completitud» y dice qué falta
  const encabezados = await page.locator('thead th').allInnerTexts();
  assert.deepEqual(encabezados.slice(-2), ['Estado de la ficha', 'Completitud']);
  const celda = page.locator('tbody tr').first().locator('td').nth(3);
  assert.match(await celda.innerText(), /^(Completa|Falta 1 campo|Faltan \d+ campos)$/);
  ok('#102: columnas «Estado de la ficha» y «Completitud» («Completa» o «Faltan N campos»)');
  // museo-frontend#100: la ficha se arma con UNA llamada a /ficha-completa, sin las llamadas sueltas de datos de la pieza
  const piezaId = (await llamar(token, '/piezas?q=' + marca + '&tamano=1')).items[0].id;
  const llamadas = [];
  page.on('request', (r) => { if (r.url().startsWith(api)) llamadas.push(new URL(r.url()).pathname.replace(new URL(api).pathname, '').replace(piezaId, '{id}')); });
  await page.goto(web + '/coleccion/' + piezaId);
  await page.getByText('Historial de cambios').waitFor(); await page.waitForTimeout(1500);
  assert.equal(llamadas.filter((u) => u === '/piezas/{id}/ficha-completa').length, 1, llamadas.join(' '));
  for (const suelta of ['/piezas/{id}', '/piezas/{id}/fotografias', '/piezas/{id}/documentos', '/piezas/{id}/codigos', '/piezas/{id}/movimientos', '/piezas/{id}/estados', '/piezas/{id}/tenencias']) {
    assert.ok(!llamadas.includes(suelta), `La ficha no debe pedir ${suelta}: ${llamadas.join(' ')}`);
  }
  ok('#100: la ficha usa una sola llamada a /ficha-completa');
  assert.deepEqual(malas, [], 'Errores: ' + malas.join(' | '));
  ok('Sin errores de página ni respuestas 4xx/5xx');
  // museo-frontend#107: un 403 no se reintenta y el mensaje aparece de inmediato (cuenta de Consulta interna opcional)
  if (process.env.F7_CI_EMAIL && process.env.F7_CI_PASSWORD) {
    const borrador = (await llamar(token, '/piezas?tamano=1&estadoFicha=borrador')).items[0].id;
    const ci = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pedidas = []; ci.on('request', (r) => { if (r.url().startsWith(api + '/piezas/' + borrador)) pedidas.push(r.url()); });
    await ci.goto(web + '/login'); await ci.fill('input[type=email]', process.env.F7_CI_EMAIL); await ci.fill('input[type=password]', process.env.F7_CI_PASSWORD);
    await ci.click('button[type=submit]'); await ci.waitForURL(web + '/');
    const t0 = Date.now(); await ci.goto(web + '/coleccion/' + borrador);
    await ci.getByText('Solo puede consultar fichas aprobadas').waitFor({ timeout: 5000 });
    assert.ok(Date.now() - t0 < 3000, 'El mensaje del 403 tarda demasiado');
    await ci.waitForTimeout(5000);
    assert.equal(pedidas.length, 1, 'Un 4xx no se reintenta: ' + pedidas.length + ' peticiones');
    ok('#107: el 403 de una ficha no aprobada se muestra de inmediato y no se reintenta');
  }
  await browser.close();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
