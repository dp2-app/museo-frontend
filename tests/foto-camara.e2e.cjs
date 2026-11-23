/**
 * Tomar foto desde el celular (ficha de la pieza). Backend local real; Cloudinary se intercepta porque el
 * entorno de prueba no tiene salida a internet: se verifica que la foto se reduce, se sube y se REGISTRA en la ficha.
 * Requiere vite con VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET. Variables: BASE, API, PW_PATH, CUENTA, CLAVE.
 */
const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.PW_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:5173', API = process.env.API || 'http://localhost:8000/api/v1';
const CUENTA = process.env.CUENTA || 'admin@museo-atp.pe', CLAVE = process.env.CLAVE || 'ClaveLocal123';
const ok = (m) => console.log('  ✓', m);

(async () => {
  const sesion = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: CUENTA, password: CLAVE }) })).json();
  const H = { Authorization: 'Bearer ' + sesion.accessToken, 'Content-Type': 'application/json' };
  const pieza = await (await fetch(API + '/piezas', { method: 'POST', headers: H, body: JSON.stringify({ campos: { denominacion: 'Pieza de prueba de cámara ' + Date.now() }, listas: {} }) })).json();
  const fotosApi = async () => (await (await fetch(`${API}/piezas/${pieza.id}/fotografias`, { headers: H })).json());
  assert.equal((await fotosApi()).length, 0);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: [] }); const page = await ctx.newPage();
  const subidas = []; await page.route('https://api.cloudinary.com/**', async (ruta) => {
    const cuerpo = ruta.request().postDataBuffer(); subidas.push(cuerpo ? cuerpo.length : 0);
    await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/museo/prueba-camara.jpg' }) });
  });
  await page.goto(BASE + '/login'); await page.locator('input[type=email]').first().fill(CUENTA); await page.locator('input[type=password]').first().fill(CLAVE);
  await page.locator('button[type=submit]').first().click(); await page.waitForURL(BASE + '/'); ok('sesión iniciada en un Pixel 7 emulado');

  // Una "foto de celular" grande (4032x3024) generada en el navegador, con una marca asimétrica para comprobar la orientación.
  const jpegGrande = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 4032; c.height = 3024; const g = c.getContext('2d');
    g.fillStyle = '#c0573d'; g.fillRect(0, 0, 4032, 3024); g.fillStyle = '#042354'; g.fillRect(0, 0, 900, 700);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95)); return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await page.goto(BASE + '/coleccion/' + pieza.id + '?campo=fotografias'); await page.getByText('Fotografía rápida').waitFor({ timeout: 20000 });
  ok('en la ficha aparece «Fotografía rápida» y el enlace ?campo=fotografias lleva a esa sección');
  const camara = page.locator('input[type=file][capture]'); assert.equal(await camara.getAttribute('capture'), 'environment'); ok('el botón abre la cámara trasera (capture=environment)');

  await camara.setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpegGrande) });
  await page.getByAltText('Vista previa de la fotografía por guardar').waitFor(); const mb = await page.getByText(/lista para guardar/).innerText();
  const original = jpegGrande.length; const texto = mb.split('·')[0].trim(); const reducida = parseFloat(texto.replace(',', '.')) * (texto.includes('KB') ? 1024 : 1048576); assert.ok(reducida < original, `reducida ${texto} < original ${original}`); ok(`la foto se reduce antes de subir: ${(original / 1048576).toFixed(1)} MB → ${texto}`);
  const dims = await page.getByAltText('Vista previa de la fotografía por guardar').evaluate((i) => new Promise((r) => { const t = new Image(); t.onload = () => r([t.naturalWidth, t.naturalHeight]); t.src = i.src; }));
  assert.equal(Math.max(...dims), 2400); assert.ok(dims[0] > dims[1]); ok(`dimensiones ${dims.join('×')} (lado mayor 2400, apaisada)`);
  await page.screenshot({ path: process.env.CAPTURA_1 || '/tmp/foto-camara-1.png' });

  await page.getByRole('button', { name: 'Guardar fotografía' }).click(); await page.getByText('Fotografía guardada').first().waitFor({ timeout: 20000 });
  assert.equal(subidas.length, 1); ok('se subió una sola vez a Cloudinary (interceptado)');
  const fotos = await fotosApi(); assert.equal(fotos.length, 1); assert.ok(fotos[0].url.includes('prueba-camara')); assert.equal(fotos[0].esPrincipal, true); ok('el backend registró la fotografía y es la principal');
  const ficha = await (await fetch(`${API}/piezas/${pieza.id}`, { headers: H })).json(); assert.ok(!ficha.camposFaltantes.includes('fotografias')); ok('la ficha ya no pide la fotografía en «camposFaltantes»');
  await page.getByAltText(/Fotografía 1/).first().waitFor({ timeout: 10000 }).catch(() => {}); await page.screenshot({ path: process.env.CAPTURA_2 || '/tmp/foto-camara-2.png' });

  // Un archivo que no es imagen o que no se puede leer se rechaza con un mensaje claro y sin subir nada.
  await camara.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }); await page.getByRole('alert').filter({ hasText: /no es una imagen/ }).waitFor();
  assert.equal(subidas.length, 1); ok('un archivo que no es imagen se rechaza sin subirlo');
  await camara.setInputFiles({ name: 'rota.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('no soy un jpeg') }); await page.getByRole('alert').filter({ hasText: /No se pudo leer la foto/ }).waitFor(); ok('una imagen ilegible (p. ej. HEIC) da el aviso de cambiar la cámara a JPG');
  await browser.close(); console.log('FOTO CÁMARA: OK');
})().catch((e) => { console.error('FALLO', e.message.split('\n')[0]); process.exit(1); });
