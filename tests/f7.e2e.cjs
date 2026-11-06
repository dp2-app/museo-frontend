// F7 de punta a punta: filtros de la pantalla Colección (texto sin tildes, por palabras, comodines como texto, atributos).
// Backend real con una base local (nunca Supabase). Crea 3 piezas con una marca única: se puede repetir en la misma base.
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
  assert.deepEqual(malas, [], 'Errores: ' + malas.join(' | '));
  ok('Sin errores de página ni respuestas 4xx/5xx');
  await browser.close();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
