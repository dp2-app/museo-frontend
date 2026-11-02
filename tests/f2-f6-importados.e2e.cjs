// Después de importar las dos hojas completas: editar y mover piezas sin perder su origen.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.F0_API;
const datos = process.env.F0_DATOS_API;
const web = process.env.F0_WEB;
for (const url of [base, datos, web]) assert.match(url || '', /^http:\/\/(127\.0\.0\.1|localhost):/);
const cargas = JSON.parse(fs.readFileSync(process.env.IMPORTACION_RESULTADO_FILE, 'utf8')).cargas;
assert.equal(cargas.length, 2);
const out = process.env.F0_EVIDENCIA;
fs.mkdirSync(out, { recursive: true });
const informe = { comprobaciones: [], erroresReact: [], piezas: [] }; let token, browser, page;
async function api(ruta, datosApi = false) {
  const r = await fetch((datosApi ? datos : base) + ruta, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200, await r.clone().text()); return r.json();
}
function comprobarConservacion(antes, despues, cambiados) {
  const campos = { ...despues.campos }; for (const clave of cambiados) campos[clave] = antes.campos[clave];
  assert.deepEqual(campos, antes.campos, 'Ningún otro campo del Excel debe cambiar');
  assert.deepEqual(despues.listas, antes.listas); assert.deepEqual(despues.codigos, antes.codigos); assert.deepEqual(despues.tenenciaVigente, antes.tenenciaVigente);
}
async function respuestaAccion(metodo, ruta, accion) {
  const esperando = page.waitForResponse(r => r.request().method() === metodo && r.url() === base + ruta);
  await accion(); const r = await esperando; assert.ok(r.ok(), await r.text());
}
function ok(s) { informe.comprobaciones.push(s); console.log('OK ' + s); }
(async () => {
  try {
    token = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.F0_EMAIL, password: process.env.F0_PASSWORD }) })).json()).accessToken;
    assert.equal((await api('/piezas?tamano=1')).total, 7759);
    const sede = (await api('/ubicaciones')).find(u => u.activo);
    const nueva = await fetch(base + '/ubicaciones', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ parentId: sede.id, nivelTipo: 'ubicacion', nombre: 'Validación importados · Rack ' + Date.now() }) });
    assert.equal(nueva.status, 201); const ubicacion = await nueva.json();
    const estados = await api('/listas/estado_pieza/valores');
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1366, height: 950 } }); await context.addInitScript(t => localStorage.setItem('museo.accessToken', t), token);
    page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', e => informe.erroresReact.push(e.message));
    for (const carga of cargas) {
      const fila = (await api(`/importacion/cargas/${carga.id}/filas?tamano=1`, true)).items[0]; assert.ok(fila.piezaResultanteId);
      const id = fila.piezaResultanteId; const original = await api('/piezas/' + id); const procedencia = await api(`/piezas/${id}/procedencia`);
      assert.ok(procedencia.some(o => o.hojaNombre === carga.hoja));
      await page.goto(web + '/coleccion/' + id); await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
      const observaciones = [String(original.campos.observaciones || ''), 'Validación ampliada F2 ' + Date.now()].filter(Boolean).join('\n');
      await page.locator('#ficha-observaciones').fill(observaciones);
      await respuestaAccion('PATCH', '/piezas/' + id, () => page.getByRole('button', { name: 'Guardar ficha', exact: true }).click());
      await page.getByRole('button', { name: 'Editar ficha', exact: true }).waitFor();
      let actual = await api('/piezas/' + id); assert.equal(actual.campos.observaciones, observaciones); comprobarConservacion(original, actual, ['observaciones']);
      assert.deepEqual(await api(`/piezas/${id}/procedencia`), procedencia); ok(carga.hoja + ': editar una observación conserva todos los demás campos, listas, códigos, tenencia y datos de origen');

      const movimientosAntes = await api(`/piezas/${id}/movimientos`); const estadosAntes = await api(`/piezas/${id}/estados`); const antesMovimiento = actual;
      await page.getByLabel('Nueva ubicación', { exact: true }).selectOption(ubicacion.id); await page.getByLabel('Motivo del traslado', { exact: true }).fill('Validación de traslado ' + carga.hoja);
      await respuestaAccion('POST', `/piezas/${id}/movimientos`, () => page.getByRole('button', { name: 'Registrar traslado', exact: true }).click());
      actual = await api('/piezas/' + id); assert.equal(actual.campos.ubicacion_actual_id, ubicacion.id); comprobarConservacion(antesMovimiento, actual, ['ubicacion_actual_id']);
      const estado = estados.find(e => e.id !== actual.campos.estado_pieza_id); assert.ok(estado); const antesEstado = actual;
      await page.getByLabel('Nuevo estado', { exact: true }).selectOption(estado.id); await page.getByLabel('Motivo del cambio de estado', { exact: true }).fill('Validación de estado ' + carga.hoja);
      await respuestaAccion('POST', `/piezas/${id}/estados`, () => page.getByRole('button', { name: 'Cambiar estado', exact: true }).click());
      actual = await api('/piezas/' + id); assert.equal(actual.campos.estado_pieza_id, estado.id); comprobarConservacion(antesEstado, actual, ['estado_pieza_id']);
      assert.equal((await api(`/piezas/${id}/movimientos`)).length, movimientosAntes.length + 1); assert.equal((await api(`/piezas/${id}/estados`)).length, estadosAntes.length + 1);
      assert.deepEqual(await api(`/piezas/${id}/procedencia`), procedencia); ok(carga.hoja + ': estado y traslado reales conservan el inventario e incrementan cada historial una sola vez');
      informe.piezas.push({ hoja: carga.hoja, id });
    }
    assert.equal((await api('/piezas?tamano=1')).total, 7759); assert.deepEqual(informe.erroresReact, []);
  } catch (e) { informe.fallo = e.stack; console.error(e); if (page) await page.screenshot({ path: path.join(out, 'fallo.png') }); process.exitCode = 1; }
  finally { if (browser) await browser.close(); fs.writeFileSync(path.join(out, 'conservacion_importados.json'), JSON.stringify(informe, null, 2)); }
})();
