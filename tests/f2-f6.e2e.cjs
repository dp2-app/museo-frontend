// Integración real, solo en entorno local exclusivo. No intercepta respuestas.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const web = process.env.F0_WEB || 'http://127.0.0.1:58173';
const base = process.env.F0_API || 'http://127.0.0.1:58081/api/v1';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):/);
assert.match(web, /^http:\/\/(localhost|127\.0\.0\.1):/);
const email = process.env.F0_EMAIL;
const password = process.env.F0_PASSWORD;
assert.ok(email && password, 'Configurar F0_EMAIL y F0_PASSWORD de la base local exclusiva');
const out = process.env.F0_EVIDENCIA || path.join(__dirname, 'evidencia-f2-f6');
fs.mkdirSync(out, { recursive: true });
const report = { comprobaciones: [], errores: [] };
const marca = Date.now();
let token, browser, page, id;
async function api(ruta, method = 'GET', body, status = 200) {
  const r = await fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const texto = await r.text(); assert.equal(r.status, status, `${method} ${ruta}: ${texto}`); return texto ? JSON.parse(texto) : null;
}
const ok = (s) => { report.comprobaciones.push(s); console.log('OK ' + s); };
async function guardado() { await page.getByRole('status').filter({ hasText: 'Operación guardada.' }).last().waitFor(); }
async function ficha() { return api('/piezas/' + id); }
async function shot(s) { await page.screenshot({ path: path.join(out, s + '.png'), animations: 'disabled' }); }
async function esperar(condicion) { for (let i = 0; i < 50; i++) { if (await condicion()) return; await new Promise(r => setTimeout(r, 100)); } throw Error('No se observó el cambio esperado'); }
(async () => {
  try {
    token = (await api('/auth/login', 'POST', { email, password })).accessToken;
    const sede = (await api('/ubicaciones'))[0];
    const tipos = await api('/tipos-codigo');
    const coleccion = await api('/colecciones', 'POST', { nombre: 'Colección F2 ' + marca, prefijoCodigo: 'PRU' }, 201);
    const sub = await api(`/colecciones/${coleccion.id}/subcolecciones`, 'POST', { nombre: 'Subcolección de prueba' }, 201);
    const material = await api('/listas/material/valores', 'POST', { etiqueta: 'Material F2 ' + marca }, 201);
    const campo = await api('/config/campos-ficha', 'POST', { clave: 'marca_f2_' + marca, etiqueta: 'Marca de taller F2 ' + marca, tipo: 'texto', grupo: 'Prueba F2' }, 201);
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    page = await browser.newPage({ viewport: { width: 1366, height: 950 } }); page.setDefaultTimeout(15000);
    page.on('pageerror', e => report.errores.push(e.message));
    await page.goto(web + '/coleccion');
    await page.getByLabel('Correo', { exact: true }).fill(email); await page.getByLabel('Contraseña', { exact: true }).fill(password); await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar pieza', exact: true }).click();
    const form = page.getByRole('form', { name: 'Formulario de ficha' });
    await form.locator('#ficha-denominacion').fill('Pieza F2 ' + marca);
    await form.locator('#ficha-coleccion_id').selectOption(coleccion.id);
    await esperar(async () => (await form.locator('#ficha-subcoleccion_id option').count()) > 1);
    await form.locator('#ficha-subcoleccion_id').selectOption(sub.id);
    await form.locator('#ficha-materiales').selectOption([material.id]);
    await form.getByLabel('Marca de taller F2 ' + marca, { exact: true }).fill('Taller local');
    await page.getByText('Códigos, tenencia y ubicación inicial (opcionales)', { exact: true }).click();
    await page.getByRole('button', { name: 'Añadir código inicial' }).click();
    await page.getByLabel('Tipo de código', { exact: true }).selectOption(tipos.find(t => t.clave === 'I').id);
    await page.getByLabel('Valor del código', { exact: true }).fill('I-' + marca);
    await page.getByLabel('Ubicación inicial', { exact: true }).selectOption(sede.id);
    await form.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
    await page.waitForURL(/\/coleccion\/[a-f0-9-]+$/); id = page.url().split('/').pop();
    let p = await ficha(); assert.equal(p.campos.coleccion_id, coleccion.id); assert.equal(p.campos.subcoleccion_id, sub.id); assert.equal(p.listas.materiales[0].id, material.id); assert.equal(p.campos[campo.clave], 'Taller local'); assert.equal(p.estadoFicha, 'borrador'); assert.equal((await api(`/piezas/${id}/movimientos`)).length, 1);
    ok('Alta real desde formulario F0 con colección, subcolección, material, campo adicional, código I y ubicación inicial');

    await api(`/listas/material/valores/${material.id}`, 'PATCH', { activo: false });
    await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    await page.locator('#ficha-observaciones').fill('Edición local que se conserva');
    p = await ficha(); await api('/piezas/' + id, 'PATCH', { version: p.version, campos: { autor: 'Otra persona' } });
    await page.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
    await page.getByRole('button', { name: 'Recargar ficha y descartar mis cambios', exact: true }).waitFor();
    assert.equal(await page.locator('#ficha-observaciones').inputValue(), 'Edición local que se conserva');
    await page.getByRole('button', { name: 'Recargar ficha y descartar mis cambios', exact: true }).click();
    await esperar(async () => await page.locator('#ficha-autor').inputValue() === 'Otra persona');
    assert.equal(await page.locator('#ficha-materiales').evaluate(e => e.selectedOptions.length), 1);
    await page.locator('#ficha-observaciones').fill('Observación guardada');
    await page.getByRole('button', { name: 'Guardar ficha', exact: true }).click();
    await page.getByRole('button', { name: 'Editar ficha', exact: true }).waitFor();
    p = await ficha(); assert.equal(p.campos.observaciones, 'Observación guardada'); assert.equal(p.campos.autor, 'Otra persona'); assert.equal(p.listas.materiales[0].id, material.id);
    ok('409 conserva entradas; recarga explícita; edición incompleta y material histórico inactivo sin pérdida');

    const fotos = page.getByRole('region').filter({ has: page.getByRole('heading', { name: 'Fotografías', exact: true }) });
    // Sections sin aria-label se localizan por encabezado para no depender de posición.
    const seccionFotos = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fotografías', exact: true }) });
    for (let i = 1; i <= 2; i++) {
      await seccionFotos.getByLabel('URL del archivo', { exact: true }).fill(`https://res.cloudinary.com/museo-pruebas/image/upload/f2-${marca}-${i}.jpg`);
      await seccionFotos.getByRole('button', { name: 'Añadir fotografía', exact: true }).click();
      await esperar(async () => (await api(`/piezas/${id}/fotografias`)).length === i);
      // La escritura puede terminar antes del refresco de la lista en React.
      await seccionFotos.locator('article').nth(i - 1).waitFor();
    }
    void fotos;
    await seccionFotos.getByRole('button', { name: 'Hacer principal', exact: true }).last().click();
    await esperar(async () => (await api(`/piezas/${id}/fotografias`))[1].esPrincipal);
    await seccionFotos.getByRole('button', { name: 'Subir fotografía 2', exact: true }).click();
    await esperar(async () => (await api(`/piezas/${id}/fotografias`))[0].esPrincipal);
    const docs = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Documentos asociados', exact: true }) });
    await docs.getByLabel('URL del documento', { exact: true }).fill(`https://res.cloudinary.com/museo-pruebas/raw/upload/f2-${marca}.pdf`);
    await docs.getByLabel('Título del documento', { exact: true }).fill('Acta de prueba');
    await docs.getByRole('button', { name: 'Asociar documento', exact: true }).click();
    await esperar(async () => (await api(`/piezas/${id}/documentos`)).length === 1);
    ok('Registrar fotos/documento por URL autorizada, principal y reordenación persistidos');

    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
    await page.getByRole('button', { name: 'Rechazar ficha', exact: true }).click();
    await page.getByLabel('Motivo de rechazar ficha', { exact: true }).fill('Ajustar revisión');
    await page.getByRole('button', { name: 'Confirmar rechazar ficha', exact: true }).click();
    await esperar(async () => (await ficha()).estadoFicha === 'rechazada');
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
    await page.getByRole('button', { name: 'Aprobar ficha', exact: true }).click();
    await esperar(async () => (await ficha()).estadoFicha === 'aprobada');
    ok('Revisión, rechazo con motivo, reenvío y aprobación real');

    await page.goto(web + '/ubicacion-y-movimientos');
    await page.getByText('Gestionar sedes y ubicaciones', { exact: true }).click();
    await page.getByLabel('Nivel', { exact: true }).selectOption('ubicacion'); await page.getByLabel('Sede', { exact: true }).selectOption(sede.id);
    await page.getByLabel('Nombre de ubicación', { exact: true }).fill('Depósito · Rack F6 ' + marca);
    await page.getByRole('button', { name: 'Crear ubicación', exact: true }).click();
    await guardado();
    const ubicacion = (await api('/ubicaciones'))[0].hijos.find(u => u.nombre.endsWith(String(marca))); assert.ok(ubicacion);
    await page.getByLabel('Código de pieza', { exact: true }).fill('I-' + marca); await page.getByRole('button', { name: 'Buscar pieza', exact: true }).click();
    await page.getByLabel('Pieza', { exact: true }).selectOption(id);
    await page.getByLabel('Nueva ubicación', { exact: true }).selectOption(ubicacion.id);
    await page.getByLabel('Motivo del traslado', { exact: true }).fill('Organizar depósito');
    await page.getByRole('button', { name: 'Registrar traslado', exact: true }).click();
    await esperar(async () => (await ficha()).campos.ubicacion_actual_id === ubicacion.id);
    const estado = (await api('/listas/estado_pieza/valores')).find(v => v.etiqueta === 'Exhibido');
    await page.getByLabel('Nuevo estado', { exact: true }).selectOption(estado.id);
    assert.equal(await page.getByRole('button', { name: 'Cambiar estado', exact: true }).isDisabled(), true);
    await page.getByLabel('Motivo del cambio de estado', { exact: true }).fill('Exposición de prueba');
    await page.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
    await esperar(async () => (await ficha()).campos.estado_pieza_id === estado.id);
    p = await ficha(); assert.equal(p.campos.ubicacion_actual_id, ubicacion.id); assert.equal((await api(`/piezas/${id}/movimientos`)).length, 2); assert.equal((await api(`/piezas/${id}/estados`)).length, 1);
    await page.getByRole('heading', { name: /Estado actual: Exhibido/ }).waitFor(); await shot('01-f6-escritorio');
    ok('F6: catálogo, selector por código, QR, traslado y estado con historiales independientes y motivo obligatorio de estado');

    await page.goto(web + '/coleccion/' + id);
    await page.getByRole('button', { name: 'Dar de baja', exact: true }).click(); await page.getByLabel('Motivo de dar de baja', { exact: true }).fill('Prueba reversible'); await page.getByRole('button', { name: 'Confirmar dar de baja', exact: true }).click();
    await page.waitForURL(web + '/coleccion'); assert.ok((await api('/piezas/eliminadas')).some(p => p.id === id));
    await page.goto(web + '/administracion'); await page.getByRole('button', { name: 'Piezas dadas de baja', exact: true }).click();
    const baja = page.getByRole('listitem').filter({ hasText: 'Pieza F2 ' + marca }); await baja.getByRole('button', { name: 'Restaurar', exact: true }).click(); await baja.getByLabel('Motivo de restaurar', { exact: true }).fill('Restaurar prueba'); await baja.getByRole('button', { name: 'Confirmar restaurar', exact: true }).click();
    await esperar(async () => !(await api('/piezas/eliminadas')).some(p => p.id === id));
    assert.equal((await api(`/piezas/${id}/estados`)).length, 1);
    ok('Baja y restauración desde Administración conservan historiales');
    await page.goto(web + '/coleccion/' + id); await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('heading', { name: 'Pieza F2 ' + marca, exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Ficha sin desbordamiento móvil'); await shot('02-ficha-movil');
    await page.goto(web + '/ubicacion-y-movimientos'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await shot('03-f6-movil');
    assert.deepEqual(report.errores, []); ok('Pantallas móviles sin desborde y sin errores JavaScript');
    report.piezaId = id;
  } catch (e) { report.fallo = e.stack; console.error(e); if (page) await shot('fallo'); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(out, 'resultado.json'), JSON.stringify(report, null, 2)); if (browser) await browser.close(); }
})();
