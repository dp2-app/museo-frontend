// Complemento del recorrido: permisos reales, campos ocultos y archivos restringidos.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.F0_API || 'http://127.0.0.1:58081/api/v1';
const web = process.env.F0_WEB || 'http://127.0.0.1:58173';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):/);
assert.match(web, /^http:\/\/(127\.0\.0\.1|localhost):/);
const out = process.env.F0_EVIDENCIA || path.join(__dirname, 'evidencia-f2-f6');
const informe = { comprobaciones: [], errores: [] }; let browser, admin, campoEstado, campoUbicacion, rol;
const password = process.env.F0_PASSWORD;
async function api(token, ruta, method = 'GET', body, status = 200) {
  const r = await fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const s = await r.text(); assert.equal(r.status, status, `${method} ${ruta}: ${s}`); return s ? JSON.parse(s) : null;
}
async function abrir(token, ruta) { const context = await browser.newContext({ viewport: { width: 1366, height: 950 } }); await context.addInitScript(t => localStorage.setItem('museo.accessToken', t), token); const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => informe.errores.push(e.message)); await page.goto(web + ruta); return page; }
const ok = (s) => { informe.comprobaciones.push(s); console.log('OK ' + s); };
async function visibilidad(visible) { for (const campo of [campoEstado, campoUbicacion]) await api(admin, '/config/visibilidad-campos', 'PUT', { campoId: campo.id, rolId: rol.id, visible }); }
(async () => {
  try {
    admin = (await api(null, '/auth/login', 'POST', { email: process.env.F0_EMAIL, password })).accessToken;
    const roles = await api(admin, '/roles');
    async function cuenta(nombre, email) {
      const correo = email || `f2f6-${Date.now()}-${nombre === 'Conservación' ? 'conservacion' : 'consulta'}@prueba.pe`;
      if (!email) await api(admin, '/usuarios', 'POST', { nombre: 'Prueba ' + nombre, email: correo, rolId: roles.find(r => r.nombre === nombre).id, proveedorAuth: 'local', password }, 201);
      return (await api(null, '/auth/login', 'POST', { email: correo, password })).accessToken;
    }
    const consulta = await cuenta('Consulta interna', process.env.F0_CONSULTA_EMAIL);
    const conservacion = await cuenta('Conservación', process.env.F0_CONSERVACION_EMAIL);
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const p = await api(admin, '/piezas', 'POST', { campos: { denominacion: 'Pieza de acceso F2/F6 ' + Date.now() } }, 201);
    const codigo = (await api(admin, '/tipos-codigo')).find(t => t.clave === 'I');
    await api(admin, `/piezas/${p.id}/codigos`, 'POST', { tipoCodigoId: codigo.id, valor: 'I-' + Date.now() }, 201);
    await api(admin, `/piezas/${p.id}/fotografias`, 'POST', { url: 'https://res.cloudinary.com/museo-pruebas/image/upload/acceso.jpg', restringidoUso: true }, 201);
    await api(admin, `/piezas/${p.id}/documentos`, 'POST', { url: 'https://res.cloudinary.com/museo-pruebas/raw/upload/acceso.pdf', titulo: 'Documento restringido F2', restringidoUso: true }, 201);
    const estado = (await api(admin, '/listas/estado_pieza/valores'))[0];
    await api(admin, `/piezas/${p.id}/estados`, 'POST', { estadoNuevoId: estado.id, motivo: 'Estado inicial de acceso' }, 201);
    await api(admin, `/piezas/${p.id}/estado-ficha`, 'PATCH', { accion: 'enviar_revision' }); await api(admin, `/piezas/${p.id}/estado-ficha`, 'PATCH', { accion: 'aprobar' });

    let page = await abrir(consulta, '/coleccion/' + p.id); await page.getByRole('heading', { name: 'Ficha de inventario', exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Editar ficha', exact: true }).isDisabled());
    assert.ok(await page.getByRole('button', { name: 'Registrar traslado', exact: true }).isDisabled());
    assert.ok(await page.getByRole('button', { name: 'Cambiar estado', exact: true }).isDisabled());
    assert.ok(await page.getByRole('button', { name: 'Añadir fotografía', exact: true }).isDisabled());
    assert.equal(await page.getByText('Documento restringido F2', { exact: true }).count(), 0);
    assert.deepEqual(await api(consulta, `/piezas/${p.id}/fotografias`), []); assert.deepEqual(await api(consulta, `/piezas/${p.id}/documentos`), []);
    await api(consulta, `/piezas/${p.id}/estados`, 'POST', { estadoNuevoId: estado.id, motivo: 'No autorizado' }, 403);
    ok('Consulta: lectura de ficha, sin acciones de escritura ni fotografías/documentos restringidos; API rechaza escritura'); await page.context().close();

    const campos = await api(admin, '/config/campos-ficha'); campoEstado = campos.find(c => c.clave === 'estado_pieza_id'); campoUbicacion = campos.find(c => c.clave === 'ubicacion_actual_id');
    rol = (await api(admin, '/roles')).find(r => r.nombre === 'Conservación'); await visibilidad(false);
    page = await abrir(conservacion, '/coleccion/' + p.id); await page.getByRole('heading', { name: 'Estado y ubicación', exact: true }).waitFor();
    assert.equal(await page.getByText('Historial de estados', { exact: true }).count(), 0); assert.equal(await page.getByText('Historial de ubicaciones', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Cambiar estado', exact: true }).count(), 0);
    const completa = await api(conservacion, `/piezas/${p.id}/ficha-completa`); assert.deepEqual(completa.estados, []); assert.deepEqual(completa.movimientos, []);
    await api(conservacion, `/piezas/${p.id}/estados`, 'GET', undefined, 403);
    ok('Conservación con campos ocultos: UI y ficha completa no revelan ninguno de los dos historiales'); await page.context().close();
    await visibilidad(true);

    page = await abrir(admin, '/coleccion/' + p.id);
    const fotos = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fotografías', exact: true }) });
    await fotos.getByText('Editar datos de fotografía', { exact: true }).click(); await fotos.getByLabel('Fecha de fotografía', { exact: true }).first().fill('2026-10-01');
    await fotos.getByRole('button', { name: 'Guardar datos de fotografía', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Operación guardada.' }).waitFor(); assert.equal((await api(admin, `/piezas/${p.id}/fotografias`))[0].fechaFotografia, '2026-10-01');
    await fotos.getByRole('button', { name: 'Retirar fotografía', exact: true }).click(); await fotos.getByLabel('Motivo de retirar fotografía', { exact: true }).fill('Retirar referencia local'); await fotos.getByRole('button', { name: 'Confirmar retirar fotografía', exact: true }).click();
    await fotos.getByText('No hay fotografías registrados.', { exact: true }).waitFor();
    const docs = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Documentos asociados', exact: true }) });
    await docs.getByRole('button', { name: 'Retirar documento', exact: true }).click(); await docs.getByLabel('Motivo de retirar documento', { exact: true }).fill('Retirar documento local'); await docs.getByRole('button', { name: 'Confirmar retirar documento', exact: true }).click();
    await docs.getByText('No hay documentos registrados.', { exact: true }).waitFor(); assert.deepEqual(await api(admin, `/piezas/${p.id}/documentos`), []);
    ok('Administrador: editar metadatos y retirar foto/documento con motivo desde UI real');
    assert.deepEqual(informe.errores, []);
  } catch (e) { informe.fallo = e.stack; console.error(e); process.exitCode = 1; }
  finally { if (admin && rol && campoEstado && campoUbicacion) await visibilidad(true); if (browser) await browser.close(); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'acceso.json'), JSON.stringify(informe, null, 2)); }
})();
