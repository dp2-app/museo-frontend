// Casos de borde con datos y respuestas reales; base local exclusiva.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const apiBase = process.env.F0_API || 'http://127.0.0.1:58081/api/v1';
const web = process.env.F0_WEB || 'http://127.0.0.1:58173';
for (const url of [apiBase, web]) assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):/);
const out = process.env.F0_EVIDENCIA || path.join(__dirname, 'evidencia-f2-f6');
fs.mkdirSync(out, { recursive: true });
const informe = { comprobaciones: [], fallos: [], erroresReact: [] };
const marca = Date.now();
let token, browser, context, page;
async function api(ruta, method = 'GET', body, esperado = 200) {
  const r = await fetch(apiBase + ruta, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const t = await r.text(); assert.equal(r.status, esperado, `${method} ${ruta}: ${t}`); return t ? JSON.parse(t) : null;
}
async function caso(nombre, fn) {
  try { await fn(); informe.comprobaciones.push(nombre); console.log('OK ' + nombre); }
  catch (e) { informe.fallos.push({ caso: nombre, error: e.stack }); console.error('FALLO ' + nombre + ': ' + e.message); if (page) await page.screenshot({ path: path.join(out, 'limite-' + informe.fallos.length + '.png') }); }
}
async function nueva(nombre) { return api('/piezas', 'POST', { campos: { denominacion: nombre + ' ' + marca } }, 201); }
function seccionFotos() { return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fotografías', exact: true }) }); }
async function guardarFoto(pieza, fecha) {
  await page.goto(web + '/coleccion/' + pieza.id);
  const fotos = seccionFotos(); await fotos.getByText('Editar datos de fotografía', { exact: true }).click();
  await fotos.getByLabel('Fecha de fotografía', { exact: true }).first().fill(fecha);
  const respuesta = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes(`/piezas/${pieza.id}/fotografias/`));
  await fotos.getByRole('button', { name: 'Guardar datos de fotografía', exact: true }).click();
  const r = await respuesta; assert.equal(r.status(), 200, await r.text());
}
(async () => {
  try {
    token = (await api('/auth/login', 'POST', { email: process.env.F0_EMAIL, password: process.env.F0_PASSWORD })).accessToken;
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    context = await browser.newContext({ viewport: { width: 1366, height: 950 } });
    await context.addInitScript(t => localStorage.setItem('museo.accessToken', t), token);
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => informe.erroresReact.push(e.message));

    await caso('Editar una fecha conserva el fotógrafo aunque quede fuera de las primeras 200 personas', async () => {
      // El endpoint admite búsqueda, pero limita a 200 las opciones sin filtro.
      for (let inicio = 0; inicio < 200; inicio += 8) {
        await Promise.all(Array.from({ length: Math.min(8, 200 - inicio) }, (_, i) => api('/personas', 'POST', { nombreCompleto: `AAA persona ${marca} ${String(inicio + i).padStart(3, '0')}` }, 201)));
      }
      const persona = await api('/personas', 'POST', { nombreCompleto: 'ZZZ Fotógrafo histórico ' + marca }, 201);
      assert.ok(!(await api('/personas')).some(p => p.id === persona.id));
      const pieza = await nueva('Fotógrafo fuera del selector');
      await api(`/piezas/${pieza.id}/fotografias`, 'POST', { url: 'https://res.cloudinary.com/museo-pruebas/image/upload/historica.jpg', fotografoId: persona.id }, 201);
      await guardarFoto(pieza, '2026-10-01');
      const foto = (await api(`/piezas/${pieza.id}/fotografias`))[0];
      assert.equal(foto.fotografoId, persona.id, 'Cambiar solo la fecha no debe borrar el fotógrafo');
      assert.equal(foto.fechaFotografia, '2026-10-01');
    });

    await caso('Editar una fecha conserva un tipo de vista histórico que fue desactivado', async () => {
      const tipo = await api('/listas/tipo_vista_foto/valores', 'POST', { etiqueta: 'Vista histórica ' + marca }, 201);
      const pieza = await nueva('Vista histórica inactiva');
      await api(`/piezas/${pieza.id}/fotografias`, 'POST', { url: 'https://res.cloudinary.com/museo-pruebas/image/upload/vista.jpg', tipoVistaId: tipo.id }, 201);
      await api('/listas/tipo_vista_foto/valores/' + tipo.id, 'PATCH', { activo: false });
      await guardarFoto(pieza, '2026-10-02');
      const foto = (await api(`/piezas/${pieza.id}/fotografias`))[0];
      assert.equal(foto.tipoVistaId, tipo.id); assert.equal(foto.fechaFotografia, '2026-10-02');
    });

    await caso('La ficha rechaza dimensiones negativas y fechas futuras sin guardar datos inválidos', async () => {
      const pieza = await nueva('Validaciones de ficha');
      await page.goto(web + '/coleccion/' + pieza.id); await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
      await page.locator('#ficha-alto_cm').fill('-1'); await page.locator('#ficha-fecha_ingreso').fill('2999-01-01');
      const respuesta = page.waitForResponse(r => r.url() === apiBase + '/piezas/' + pieza.id && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Guardar ficha', exact: true }).click(); const r = await respuesta; assert.equal(r.status(), 422);
      await page.locator('#ficha-alto_cm-error').waitFor(); await page.locator('#ficha-fecha_ingreso-error').waitFor();
      const actual = await api('/piezas/' + pieza.id); assert.equal(actual.campos.alto_cm, pieza.campos.alto_cm); assert.equal(actual.campos.fecha_ingreso, pieza.campos.fecha_ingreso);
      assert.equal(await page.locator('#ficha-alto_cm').inputValue(), '-1', 'Conservar la entrada para corregirla');
    });

    await caso('Alta con código duplicado muestra conflicto y no crea una pieza parcial', async () => {
      const pieza = await nueva('Código existente'); const tipo = (await api('/tipos-codigo')).find(t => t.clave === 'I'); const valor = 'I-' + marca;
      await api(`/piezas/${pieza.id}/codigos`, 'POST', { tipoCodigoId: tipo.id, valor }, 201); const total = (await api('/piezas?tamano=1')).total;
      await page.goto(web + '/coleccion'); await page.getByRole('button', { name: 'Registrar pieza', exact: true }).click();
      await page.locator('#ficha-denominacion').fill('No debe crearse ' + marca); await page.getByText('Códigos, tenencia y ubicación inicial (opcionales)', { exact: true }).click();
      await page.getByRole('button', { name: 'Añadir código inicial', exact: true }).click(); await page.getByLabel('Tipo de código', { exact: true }).selectOption(tipo.id); await page.getByLabel('Valor del código', { exact: true }).fill(valor);
      const respuesta = page.waitForResponse(r => r.url() === apiBase + '/piezas' && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Guardar ficha', exact: true }).click(); assert.equal((await respuesta).status(), 409);
      assert.equal((await api('/piezas?tamano=1')).total, total); assert.equal(await page.locator('#ficha-denominacion').inputValue(), 'No debe crearse ' + marca);
      await page.getByRole('alert').waitFor();
    });

    await caso('Una sede inactiva y sus ambientes no aparecen como destinos de traslado', async () => {
      const sede = await api('/ubicaciones', 'POST', { nivelTipo: 'sede', nombre: 'Sede inactiva ' + marca }, 201);
      const hijo = await api('/ubicaciones', 'POST', { nivelTipo: 'ubicacion', parentId: sede.id, nombre: 'Rack inactivo ' + marca }, 201);
      await api('/ubicaciones/' + sede.id, 'PATCH', { activo: false });
      const pieza = await nueva('Destinos activos'); await page.goto(web + '/coleccion/' + pieza.id);
      const select = page.getByLabel('Nueva ubicación', { exact: true }); await select.waitFor();
      assert.equal(await select.locator(`option[value="${sede.id}"]`).count(), 0); assert.equal(await select.locator(`option[value="${hijo.id}"]`).count(), 0);
      await api(`/piezas/${pieza.id}/movimientos`, 'POST', { ubicacionNuevaId: hijo.id }, 422);
      assert.deepEqual(await api(`/piezas/${pieza.id}/movimientos`), []);
    });
    assert.deepEqual(informe.erroresReact, []);
  } catch (e) { informe.fallos.push({ caso: 'Preparación', error: e.stack }); console.error(e); }
  finally { if (browser) await browser.close(); fs.writeFileSync(path.join(out, 'limites.json'), JSON.stringify(informe, null, 2)); if (informe.fallos.length) process.exitCode = 1; }
})();
