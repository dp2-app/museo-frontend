// Backend real y base local exclusiva. No se simulan respuestas ni se revisan filas por SQL.
const { chromium } = require(process.env.IMPORTACION_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const web = process.env.IMPORTACION_WEB || 'http://127.0.0.1:5173';
const negocio = process.env.IMPORTACION_API || 'http://127.0.0.1:8000/api/v1';
const datos = process.env.IMPORTACION_DATOS || negocio.replace(/\/api\/v1\/?$/, '/datos/v1');
for (const url of [web, negocio, datos]) assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo servicios locales de prueba');
for (const key of ['IMPORTACION_ACCOUNT_FILE', 'IMPORTACION_EXCEL_FILE', 'IMPORTACION_ERROR_FILE', 'IMPORTACION_CORRECTED_FILE']) {
  assert.ok(process.env[key] && fs.existsSync(process.env[key]), `Configure ${key}`);
}
const cuenta = JSON.parse(fs.readFileSync(process.env.IMPORTACION_ACCOUNT_FILE, 'utf8'));
const formato = process.env.IMPORTACION_FORMATO || 'Inventario MATP (formato habitual)';
const out = process.env.IMPORTACION_EVIDENCIA || path.join(process.cwd(), 'evidencia-importacion');
fs.mkdirSync(out, { recursive: true });
const informe = { comprobaciones: [], cargas: [], erroresReact: [], sharedDatabaseModified: false };
let browser, page, token, plantilla;
function ok(texto) { informe.comprobaciones.push(texto); console.log('OK ' + texto); }
async function api(ruta, base = datos) {
  const r = await fetch(base + ruta, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200, `${ruta}: ${r.status} ${await r.clone().text()}`);
  return r.json();
}
async function shot(nombre) { await page.screenshot({ path: path.join(out, nombre + '.png'), fullPage: false }); }
async function textoVisible(texto) { await page.getByText(texto, { exact: true }).waitFor(); }
async function cargar(archivo, hoja, filas) {
  await page.goto(web + '/importacion');
  await page.getByLabel('Archivo Excel', { exact: true }).setInputFiles(archivo);
  const selector = page.getByLabel('Hoja del archivo', { exact: true });
  await selector.waitFor();
  await page.waitForFunction(() => !document.querySelector('#importacion-hoja').disabled);
  if (await selector.inputValue() !== hoja) await selector.selectOption(hoja);
  await page.getByRole('status').filter({ hasText: `Hoja ${hoja}: ${filas} filas` }).waitFor({ timeout: 120000 });
  await page.getByLabel('Formato de columnas', { exact: true }).selectOption({ label: formato });
  await shot('seleccion-' + hoja + '-' + filas);
  const respuesta = page.waitForResponse(r => r.url() === datos + '/importacion/cargas' && r.request().method() === 'POST', { timeout: 300000 });
  await page.getByRole('button', { name: 'Cargar hoja para revisión', exact: true }).click();
  const r = await respuesta;
  assert.equal(r.status(), 201, await r.text());
  const carga = await r.json();
  assert.equal(carga.hojaNombre, hoja);
  assert.equal(carga.plantillaMapeoId, plantilla.id);
  assert.equal(carga.totalFilas, filas);
  await page.waitForURL(web + '/importacion/' + carga.id);
  await page.getByRole('button', { name: 'Revisar varias filas pendientes', exact: true }).waitFor();
  return carga;
}
async function confirmarCierre(accion, motivo) {
  await page.getByRole('button', { name: accion + ' carga', exact: true }).click();
  const form = page.getByRole('form', { name: 'Motivo de la decisión', exact: true });
  const boton = form.getByRole('button', { name: accion === 'Cancelar' ? 'Confirmar cancelación' : 'Confirmar rechazo', exact: true });
  assert.equal(await boton.isDisabled(), true);
  await form.getByRole('textbox', { name: 'Motivo de la decisión', exact: true }).fill(motivo);
  await boton.click();
  await textoVisible('Decisión guardada.');
}

(async () => {
  try {
    const login = await fetch(negocio + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuenta) });
    assert.equal(login.status, 200);
    token = (await login.json()).accessToken;
    plantilla = (await api('/importacion/plantillas')).find(p => p.nombre === formato);
    assert.ok(plantilla, 'El administrador debe preparar el formato antes de ejecutar la prueba');
    assert.equal((await api('/piezas?tamano=1', negocio)).total, 0, 'La base debe empezar sin piezas');
    browser = await chromium.launch({ headless: true, channel: process.env.IMPORTACION_BROWSER_CHANNEL || 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => informe.erroresReact.push(e.message));
    page.on('request', r => { assert.ok(!r.url().includes('/api/v1/importacion'), 'No usar las rutas legadas de importación'); });
    await page.goto(web + '/importacion');
    await page.getByLabel('Correo', { exact: true }).fill(cuenta.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('heading', { name: 'Importación', exact: true }).waitFor();
    ok('Autenticación y rutas actuales de la API de datos');

    await page.getByLabel('Archivo Excel', { exact: true }).setInputFiles({ name: 'viejo.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('no es xlsx') });
    await page.getByRole('alert').filter({ hasText: 'Guarda el archivo como Excel .xlsx' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Cargar hoja para revisión', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Configurar un formato de columnas', exact: true }).click();
    await page.getByLabel('Dato de destino 1', { exact: true }).getByRole('option', { name: 'Detalle de medidas', exact: true }).waitFor({ state: 'attached' });
    assert.equal(await page.getByLabel('Dato de destino 1', { exact: true }).locator('option[value="ubicacion_actual_id"]').count(), 0);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    ok('Validación de archivo y destinos vigentes, incluidos los campos adicionales');

    const erronea = await cargar(process.env.IMPORTACION_ERROR_FILE, 'AJB', 1);
    assert.equal(erronea.filasConError, 1);
    assert.equal(await page.getByRole('button', { name: 'Aprobar carga completa', exact: true }).isDisabled(), true);
    await page.getByLabel('Solo filas con errores', { exact: true }).check();
    await page.locator('tr[data-fila="2"]').getByText(/no corresponde a ning[uú]n valor de la lista/i).first().waitFor();
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar reporte de errores', exact: true }).click();
    await (await descarga).saveAs(path.join(out, 'reporte-errores.xlsx'));
    await page.locator('tr[data-fila="2"]').getByRole('button', { name: 'Corregir fila', exact: true }).click();
    const editor = page.getByRole('form', { name: 'Corrección de fila 2', exact: true });
    const material = editor.getByLabel('Material', { exact: true });
    assert.equal(await material.inputValue(), 'Material inexistente de validación');
    assert.ok((await api('/listas/material/valores', negocio)).some(v => v.etiqueta === 'Madera'));
    await material.fill('Madera');
    await editor.getByRole('button', { name: 'Guardar corrección', exact: true }).click();
    await textoVisible('Revisión de fila guardada.');
    assert.equal((await api(`/importacion/cargas/${erronea.id}`)).filasConError, 0);
    await page.getByLabel('Solo filas con errores', { exact: true }).uncheck();
    await page.locator('tr[data-fila="2"]').getByRole('button', { name: 'Rechazar fila', exact: true }).click();
    await page.getByRole('textbox', { name: 'Motivo de la decisión', exact: true }).fill('Material por corregir');
    await page.getByRole('button', { name: 'Confirmar rechazo', exact: true }).click();
    await textoVisible('Decisión guardada.');
    assert.equal((await api(`/importacion/cargas/${erronea.id}/filas`)).items[0].motivoRechazo, 'Material por corregir');
    const recarga = page.waitForResponse(r => r.url() === datos + '/importacion/cargas' && r.request().method() === 'POST');
    await page.getByLabel('Archivo corregido', { exact: true }).setInputFiles(process.env.IMPORTACION_CORRECTED_FILE);
    const corregida = await (await recarga).json();
    assert.equal(corregida.hojaNombre, 'AJB'); assert.equal(corregida.plantillaMapeoId, plantilla.id); assert.equal(corregida.filasConError, 0);
    await page.waitForURL(web + '/importacion/' + corregida.id);
    await page.getByLabel('Solo filas con errores', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Marcar revisada', exact: true }).click();
    await textoVisible('Revisión de fila guardada.');
    await confirmarCierre('Cancelar', 'Prueba local de archivo corregido; sin aplicar piezas');
    await page.getByText('Cancelada', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Aprobar carga completa', exact: true }).count(), 0);
    await page.goto(web + '/importacion/' + erronea.id);
    await confirmarCierre('Rechazar', 'Se reemplazó por la versión corregida');
    assert.equal((await api('/piezas?tamano=1', negocio)).total, 0);
    ok('Error real, reporte, rechazo con motivo y archivo corregido conserva hoja AJB y formato; cierre sin crear piezas');

    for (const [hoja, total] of [['Inventario', 4380], ['AJB', 3379]]) {
      const carga = await cargar(process.env.IMPORTACION_EXCEL_FILE, hoja, total);
      assert.equal(carga.filasConError, 0); assert.equal(carga.filasConflicto, 0);
      const antes = (await api('/piezas?tamano=1', negocio)).total;
      assert.equal(await page.getByRole('button', { name: 'Aprobar carga completa', exact: true }).isDisabled(), true);
      await page.locator('tr[data-fila="2"]').waitFor();
      await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
      await page.locator('tr[data-fila="52"]').waitFor();
      await page.getByLabel('Filtrar clasificación', { exact: true }).selectOption('nuevo');
      await page.getByLabel('Filtrar clasificación', { exact: true }).selectOption('');
      await page.getByRole('button', { name: 'Página anterior', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Revisar varias filas pendientes', exact: true }).click();
      const revision = page.getByRole('form', { name: 'Revisión conjunta', exact: true });
      await revision.waitFor({ timeout: 180000 });
      const duplicados = revision.getByRole('checkbox', { name: /Incluir .* posibles duplicados/ });
      if (await duplicados.count()) { assert.equal(await duplicados.isChecked(), false); await duplicados.check(); }
      const actualizaciones = revision.getByRole('checkbox', { name: /Incluir .* actualizaciones/ });
      if (await actualizaciones.count()) { assert.equal(await actualizaciones.isChecked(), false); await actualizaciones.check(); }
      const marcar = revision.getByRole('button', { name: `Marcar ${total} filas como revisadas`, exact: true });
      assert.equal(await marcar.isDisabled(), true);
      await revision.getByRole('checkbox', { name: 'Confirmo que revisé las filas seleccionadas y las decisiones indicadas', exact: true }).check();
      await shot('revision-' + hoja);
      const respuestaRevision = page.waitForResponse(r => r.url() === datos + `/importacion/cargas/${carga.id}/filas` && r.request().method() === 'PATCH', { timeout: 180000 });
      await marcar.click();
      assert.equal((await respuestaRevision).status(), 200);
      await textoVisible(`${total} filas revisadas. La carga aún no se ha aplicado al catálogo.`);
      assert.equal((await api('/piezas?tamano=1', negocio)).total, antes);
      assert.equal((await api(`/importacion/cargas/${carga.id}/filas?estado=pendiente&tamano=1`)).total, 0);
      const aprobar = page.getByRole('button', { name: 'Aprobar carga completa', exact: true });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Aprobar carga completa' && !b.disabled));
      const respuestaAprobacion = page.waitForResponse(r => r.url() === datos + `/importacion/cargas/${carga.id}/aprobar` && r.request().method() === 'POST', { timeout: 600000 });
      await aprobar.click();
      console.log('Aplicando ' + hoja + ': ' + total + ' filas mediante aprobación real');
      const resultado = await respuestaAprobacion;
      assert.equal(resultado.status(), 200, await resultado.text());
      assert.equal((await resultado.json()).estado, 'aprobada');
      await textoVisible('Carga aplicada al catálogo. Las fichas conservan su estado de borrador para la revisión habitual.');
      assert.equal((await api('/piezas?tamano=1', negocio)).total, antes + total);
      await page.getByRole('link', { name: 'Ver pieza registrada', exact: true }).first().waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sin desborde horizontal de la página');
      await shot('aprobada-movil-' + hoja);
      await page.setViewportSize({ width: 1366, height: 900 });
      await shot('aprobada-' + hoja);
      informe.cargas.push({ id: carga.id, hoja, filas: total, estado: 'aprobada' });
      ok(hoja + ': detección, formato, paginación, revisión por API y aprobación desde la interfaz');
    }
    assert.equal((await api('/piezas?tamano=1', negocio)).total, 7759);
    assert.deepEqual(informe.erroresReact, []);
    informe.estado = 'correcto';
    ok('7.759 piezas importadas con las dos hojas y sin errores de React');
  } catch (e) {
    informe.estado = 'fallo'; informe.fallo = String(e.stack || e);
    if (page) await shot('fallo').catch(() => {});
    throw e;
  } finally {
    fs.writeFileSync(path.join(out, 'validacion.json'), JSON.stringify(informe, null, 2));
    if (browser) await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
