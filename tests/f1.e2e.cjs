// F1 · Identificadores y tenencia. Pruebas sobre el backend real; no se interceptan ni simulan respuestas.
// Solo contra una base local exclusiva de pruebas (ver docs/f1/README.md). Cuentas en F1_ACCOUNT_FILE:
// {"admin":{"email","password"},"catalogador":{…},"consulta":{…}} (nunca versionado).
const { chromium } = require(process.env.F1_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const cuentas = JSON.parse(fs.readFileSync(process.env.F1_ACCOUNT_FILE || 'cuentas-f1.json', 'utf8'));
const web = process.env.F1_WEB || 'http://127.0.0.1:5173';
const base = process.env.F1_API || 'http://127.0.0.1:8000/api/v1';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo un entorno local exclusivo de pruebas');
const out = process.env.F1_EVIDENCIA || path.join(process.cwd(), 'evidencia-f1');
fs.mkdirSync(out, { recursive: true });
const sfx = Date.now().toString(36);
const report = { comprobaciones: [], errores: [] };
const ok = (nombre) => { report.comprobaciones.push(nombre); console.log('OK ' + nombre); };
let browser, page, token, tipoI;
const tokens = {};

async function api(ruta, method = 'GET', body, expected = 200, quien = 'admin') {
  const r = await fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tokens[quien] ?? token) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  assert.equal(r.status, expected, `${method} ${ruta}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
async function login(cuenta) {
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuenta) });
  assert.equal(r.status, 200); return (await r.json()).accessToken;
}
async function abrirComo(quien, ruta, viewport = { width: 1366, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const p = await context.newPage(); p.setDefaultTimeout(15000);
  p.on('pageerror', (e) => report.errores.push({ quien, url: p.url(), mensaje: e.message }));
  await p.goto(web + ruta);
  await p.getByLabel('Correo', { exact: true }).fill(cuentas[quien].email);
  await p.getByLabel('Contraseña', { exact: true }).fill(cuentas[quien].password);
  await p.getByRole('button', { name: 'Ingresar', exact: true }).click();
  return p;
}
const shot = (p, nombre) => p.screenshot({ path: path.join(out, nombre + '.png'), fullPage: false });
const seccion = (nombre) => page.getByRole('button', { name: nombre, exact: true }).click();
const estado = (p, texto) => p.getByRole('status').filter({ hasText: texto }).first().waitFor();
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const pieza = (denominacion, extra = {}) => api('/piezas', 'POST', { campos: { denominacion }, ...extra }, 201);

(async () => {
  try {
    for (const q of Object.keys(cuentas)) tokens[q] = await login(cuentas[q]);
    token = tokens.admin;
    const tipos = await api('/tipos-codigo?incluirInactivos=true');
    tipoI = tipos.find((t) => t.esPrincipal);
    const regimenes = await api('/regimenes');
    const comodato = regimenes.find((r) => r.clave === 'comodato');
    browser = await chromium.launch({ headless: true, channel: process.env.F1_BROWSER_CHANNEL || 'chrome' });

    // ------------------------------------------------------------ Administración › Tipos de código (RF-55)
    page = await abrirComo('admin', '/administracion');
    await page.getByRole('heading', { name: 'Administración', exact: true }).waitFor();
    await seccion('Tipos de código');
    await page.getByRole('heading', { name: 'Tipos de código', exact: true }).waitFor();
    for (const t of tipos) await page.getByRole('rowheader', { name: new RegExp(t.nombre.replace(/[()]/g, '\\$&')) }).waitFor();
    ok('Grupo «Códigos y tenencia» en Administración con los tipos sembrados y sus reglas');

    await page.getByRole('button', { name: 'Editar ' + tipoI.nombre, exact: true }).click();
    assert.equal(await page.getByLabel('Tipo activo', { exact: true }).count(), 0, 'El I no ofrece desactivarse');
    await page.getByText('no desactivar', { exact: false }).waitFor();
    await page.getByLabel('Correlativo', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar tipo de código', exact: true }).click();
    await estado(page, 'Tipo de código actualizado');
    assert.equal((await api('/tipos-codigo')).find((t) => t.id === tipoI.id).esCorrelativo, true);
    ok('El código I se edita (correlativo) pero no ofrece desactivarse (D7)');

    const clave = 'e2e_inc_' + sfx;
    await page.getByRole('button', { name: 'Crear tipo de código', exact: true }).click();
    await page.getByLabel('Clave', { exact: true }).fill(clave);
    await page.getByLabel('Nombre', { exact: true }).fill('INC de prueba ' + sfx);
    await page.getByLabel('Formato (expresión regular)', { exact: true }).fill('INC-(');
    await page.getByRole('button', { name: 'Guardar tipo de código', exact: true }).click();
    const errPatron = page.locator('#f1-tipo-patron-error');
    await errPatron.waitFor(); assert.match(await errPatron.innerText(), /expresión regular/i);
    await shot(page, '02-patron-invalido');
    await page.getByLabel('Formato (expresión regular)', { exact: true }).fill('INC-\\d{4}');
    await page.getByLabel('Único', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar tipo de código', exact: true }).click();
    await estado(page, 'Tipo de código creado');
    const inc = (await api('/tipos-codigo')).find((t) => t.clave === clave);
    assert.ok(inc && inc.esUnico && inc.patron === 'INC-\\d{4}');
    await page.getByRole('rowheader', { name: new RegExp('INC de prueba ' + sfx) }).waitFor();
    await shot(page, '01-tipos-codigo');
    ok('Crear un tipo con formato: un patrón inválido se rechaza junto a su campo (RF-55)');

    await page.getByRole('button', { name: 'Crear tipo de código', exact: true }).click();
    await page.getByLabel('Clave', { exact: true }).fill(clave);
    await page.getByLabel('Nombre', { exact: true }).fill('Repetido');
    await page.getByRole('button', { name: 'Guardar tipo de código', exact: true }).click();
    await page.locator('#f1-tipo-clave-error').waitFor();
    await page.getByRole('button', { name: 'Cerrar editor', exact: true }).click();
    ok('Clave repetida: error del servidor junto a la clave');

    // D8: no se exige «único» si ya hay valores repetidos.
    const dup = await api('/config/tipos-codigo', 'POST', { clave: 'e2e_dup_' + sfx, nombre: 'Duplicable ' + sfx }, 201);
    const p1 = await pieza('D8 uno ' + sfx), p2 = await pieza('D8 dos ' + sfx);
    for (const p of [p1, p2]) await api(`/piezas/${p.id}/codigos`, 'POST', { tipoCodigoId: dup.id, valor: 'D-1' }, 201);
    await page.reload(); await seccion('Tipos de código');
    await page.getByRole('button', { name: 'Editar Duplicable ' + sfx, exact: true }).click();
    await page.getByLabel('Único', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar tipo de código', exact: true }).click();
    const errUnico = page.locator('#f1-tipo-esUnico-error');
    await errUnico.waitFor(); assert.match(await errUnico.innerText(), /repetidos/i);
    await shot(page, '03-d8-datos-en-conflicto');
    await page.getByRole('button', { name: 'Cerrar editor', exact: true }).click();
    ok('D8: exigir «único» con valores repetidos se rechaza y se explica junto a la regla');

    // ------------------------------------------------------------ Regímenes (RF-56)
    await seccion('Regímenes');
    await page.getByRole('heading', { name: 'Regímenes de tenencia', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Editar Propiedad', exact: true }).click();
    assert.equal(await page.getByLabel('Régimen activo', { exact: true }).count(), 0, 'Un régimen del sistema no ofrece desactivarse');
    await page.getByRole('button', { name: 'Cerrar editor', exact: true }).click();
    const nombreReg = 'Depósito ' + sfx;
    await page.getByRole('button', { name: 'Crear régimen', exact: true }).click();
    await page.getByLabel('Clave', { exact: true }).fill('dep_' + sfx);
    await page.getByLabel('Nombre', { exact: true }).fill(nombreReg);
    await page.getByLabel('Exige contraparte (propietario o comodante)', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar régimen', exact: true }).click();
    await estado(page, 'Régimen creado');
    const reglas = page.getByRole('form', { name: 'Códigos que admite ' + nombreReg });
    await reglas.getByRole('checkbox', { name: /inventario MATP/ }).uncheck();
    await reglas.getByRole('button', { name: 'Guardar códigos admitidos' }).click();
    await estado(page, `Códigos admitidos en «${nombreReg}» guardados`);
    const dep = (await api('/regimenes')).find((r) => r.clave === 'dep_' + sfx);
    assert.equal(dep.requiereContraparte, true);
    assert.equal(dep.reglasCodigo.find((r) => r.tipoCodigoId === tipoI.id)?.permitido, false);
    assert.equal(await page.getByRole('form', { name: 'Códigos que admite Comodato' }).getByRole('checkbox', { name: /inventario MATP/ }).isChecked(), false);
    const tarjetaPropiedad = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Propiedad', exact: true }) });
    await tarjetaPropiedad.getByText('Por defecto en piezas nuevas', { exact: true }).waitFor();
    assert.ok(dep.orden > 1, 'Un régimen nuevo se propone al final del orden y no desplaza a Propiedad');
    await shot(page, '04-regimenes');
    ok('Crear un régimen y fijar qué códigos admite; el comodato no admite el I y Propiedad sigue por defecto (RF-56, RN-03)');

    // ------------------------------------------------------------ Propietarios (RN-06)
    await seccion('Propietarios');
    const nombreProp = 'Comodante E2E ' + sfx;
    await page.getByRole('button', { name: 'Registrar propietario', exact: true }).click();
    await page.getByLabel('Nombre o razón social', { exact: true }).fill(nombreProp);
    await page.getByLabel('Documento de identidad (DNI o RUC)', { exact: true }).fill('40000000');
    await page.getByRole('button', { name: 'Guardar propietario', exact: true }).click();
    await estado(page, 'Propietario registrado');
    await page.getByRole('searchbox', { name: 'Buscar propietarios' }).fill(sfx);
    await estado(page, '1 de');
    await shot(page, '05-propietarios');
    const prop = (await api('/propietarios')).find((p) => p.nombre === nombreProp);
    assert.ok(prop);
    ok('Registrar un propietario o contraparte y encontrarlo por nombre o documento (RN-06)');

    // ------------------------------------------------------------ Préstamos temporales (RN-04)
    const totalAntes = (await api('/piezas?tamano=1')).total;
    await page.goto(web + '/coleccion/prestamos-temporales');
    await page.getByRole('heading', { name: 'Préstamos temporales', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Registrar préstamo', exact: true }).click();
    await page.getByLabel('Bien recibido', { exact: true }).fill('Retablo prestado ' + sfx);
    await page.getByLabel('Prestador', { exact: true }).selectOption(prop.id);
    await page.getByLabel('Fecha de inicio', { exact: true }).fill('2026-10-01');
    await page.getByLabel('Fecha de devolución (opcional)', { exact: true }).fill('2026-12-15');
    await page.getByRole('button', { name: 'Registrar préstamo', exact: true }).last().click();
    await estado(page, 'Préstamo temporal registrado');
    await page.getByRole('rowheader', { name: new RegExp('Retablo prestado ' + sfx) }).waitFor();
    assert.equal((await api('/piezas?tamano=1')).total, totalAntes, 'Un préstamo temporal no crea pieza');
    await shot(page, '06-prestamos');
    ok('Registrar un préstamo temporal: aparece en la lista y no crea pieza (RN-04, T06)');

    // ------------------------------------------------------------ Pendientes de código I (RF-06, D6) y asignación
    const pendiente = await pieza('Pendiente ' + sfx);
    const enComodato = await pieza('En comodato ' + sfx, { tenencia: { regimenId: comodato.id, contraparteId: prop.id } });
    const conI = `I-${10000 + Math.floor(Math.random() * 80000)}`;
    await pieza('Con I ' + sfx, { codigos: [{ tipoCodigoId: tipoI.id, valor: conI }] });
    await page.goto(web + '/coleccion/pendientes-codigo-i');
    await page.getByRole('heading', { name: 'Pendientes de código I', exact: true }).waitFor();
    await page.getByRole('searchbox', { name: 'Buscar entre las pendientes' }).fill(sfx);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('link', { name: 'Pendiente ' + sfx, exact: true }).waitFor();
    for (const n of ['En comodato ' + sfx, 'Con I ' + sfx]) assert.equal(await page.getByRole('link', { name: n, exact: true }).count(), 0, n + ' no está pendiente');
    assert.ok(!(await api('/piezas?sinCodigoPrincipal=true&tamano=200')).items.some((p) => p.id === enComodato.id));
    await shot(page, '07-pendientes');
    ok('Pendientes de código I: aparece la pieza en propiedad sin I; no las que tienen I ni las de comodato (T10, T11)');

    await page.getByRole('button', { name: 'Asignar código I a Pendiente ' + sfx, exact: true }).click();
    const asignar = page.getByRole('form', { name: 'Asignar ' + tipoI.nombre });
    await asignar.getByLabel(tipoI.nombre, { exact: true }).fill(conI.toLowerCase().replace('-', ' '));
    await asignar.locator('[data-codigo="duplicado"]').waitFor();
    assert.ok(await asignar.getByRole('button', { name: 'Asignar código', exact: true }).isDisabled());
    await shot(page, '08-validacion-en-vivo');
    ok('Validación en vivo: un I ya asignado escrito de otra forma se detecta como duplicado antes de guardar (D1, T04)');
    const siguiente = (await api(`/tipos-codigo/${tipoI.id}/siguiente`)).valor;
    await asignar.getByRole('button', { name: 'Usar el siguiente: ' + siguiente, exact: true }).click();
    await asignar.getByText('Código válido', { exact: false }).waitFor();
    await asignar.getByRole('button', { name: 'Asignar código', exact: true }).click();
    const asignados = page.getByRole('region', { name: 'Códigos asignados' });
    await asignados.getByText(siguiente, { exact: true }).waitFor();
    assert.ok(!(await api('/piezas?sinCodigoPrincipal=true&tamano=200')).items.some((p) => p.id === pendiente.id));
    ok('Asignar el I con el correlativo sugerido: queda bloqueado y la pieza sale de pendientes (D4, RF-04, T10)');

    // RF-05: corrección excepcional del I recién asignado.
    await asignados.getByRole('button', { name: 'Corregir ' + siguiente, exact: true }).click();
    const corregir = page.getByRole('form', { name: 'Corregir ' + tipoI.nombre });
    const corregido = siguiente.replace(/\d+$/, (n) => String(Number(n) + 1).padStart(n.length, '0'));
    await corregir.getByLabel('Valor corregido', { exact: true }).fill(corregido);
    await corregir.getByLabel('Motivo de la corrección', { exact: true }).fill('corto');
    assert.ok(await corregir.getByRole('button', { name: 'Guardar corrección', exact: true }).isDisabled());
    await corregir.getByLabel('Motivo de la corrección', { exact: true }).fill('Se tipeó mal el número inscrito en la pieza');
    await corregir.getByText('Código válido', { exact: false }).waitFor();
    await shot(page, '09-correccion-rf05');
    await corregir.getByRole('button', { name: 'Guardar corrección', exact: true }).click();
    await asignados.getByText(corregido, { exact: true }).waitFor();
    const codigos = await api(`/piezas/${pendiente.id}/codigos`);
    assert.equal(codigos.find((c) => c.tipoCodigoId === tipoI.id).valor, corregido);
    const auditoria = await api(`/piezas/${pendiente.id}/auditoria`);
    assert.ok(JSON.stringify(auditoria).includes('Se tipeó mal'), 'La corrección queda en la auditoría con su motivo');
    ok('Corregir el I por excepción exige motivo de 10+ caracteres y queda guardado y auditado (RF-05, T08, T09)');

    // ------------------------------------------------------------ Permisos: catalogador y consulta (RNF-08)
    for (const quien of ['catalogador', 'consulta']) {
      const sesion = await api('/auth/sesion', 'GET', undefined, 200, quien);
      const tiene = (p) => sesion.permisos.includes(p);
      const p = await abrirComo(quien, '/coleccion/pendientes-codigo-i');
      if (!tiene('piezas.ver')) { await p.waitForURL(web + '/'); await p.context().close(); continue; }
      await p.getByRole('heading', { name: 'Pendientes de código I', exact: true }).waitFor();
      await p.getByRole('status').filter({ hasText: /pendiente/ }).first().waitFor();
      assert.equal(await p.getByRole('button', { name: /^Asignar código I a / }).count() > 0, tiene('codigos.gestionar'), quien + ': asignar según codigos.gestionar');
      await p.goto(web + '/coleccion/prestamos-temporales');
      if (tiene('tenencias.ver')) {
        await p.getByRole('heading', { name: 'Préstamos temporales', exact: true }).waitFor();
        await p.getByRole('rowheader', { name: new RegExp('Retablo prestado ' + sfx) }).waitFor();
        assert.equal(await p.getByRole('button', { name: 'Registrar préstamo', exact: true }).count(), tiene('tenencias.gestionar') ? 1 : 0);
      } else await p.waitForURL(web + '/');
      await p.goto(web + '/administracion');
      // Mismo criterio que PERMISOS_ADMINISTRACION (src/lib/secciones.ts): Administración es configuración.
      const admin = ['config.codigos_tenencia', 'config.campos.ver', 'config.listas', 'config.institucion.ver', 'usuarios.ver', 'roles.ver', 'auditoria.ver'].some(tiene);
      if (admin) {
        await p.getByRole('heading', { name: 'Administración', exact: true }).waitFor();
        assert.equal(await p.getByRole('button', { name: 'Tipos de código', exact: true }).count(), tiene('config.codigos_tenencia') ? 1 : 0);
      } else await p.waitForURL(web + '/');
      await api('/config/tipos-codigo', 'POST', { clave: 'x_' + sfx, nombre: 'x' }, tiene('config.codigos_tenencia') ? 201 : 403, quien);
      await p.context().close();
      ok(`${quien}: las acciones de F1 se muestran según sus permisos y la API rechaza el resto (403)`);
    }

    // ------------------------------------------------------------ Móvil
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(web + '/administracion');
    await page.getByLabel('Sección de administración', { exact: true }).selectOption('regimenes');
    await page.getByRole('heading', { name: 'Regímenes de tenencia', exact: true }).waitFor();
    assert.ok(await sinDesborde(page));
    await shot(page, '10-regimenes-movil');
    await page.goto(web + '/coleccion/pendientes-codigo-i');
    await page.getByRole('heading', { name: 'Pendientes de código I', exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: /pendiente/ }).first().waitFor();
    assert.ok(await sinDesborde(page));
    await shot(page, '11-pendientes-movil');
    ok('Móvil (390 px): navegación por selector y sin desborde horizontal');

    assert.deepEqual(report.errores, [], 'Sin errores de JavaScript en la página');
    ok('Sin errores de JavaScript durante la prueba');
  } catch (e) {
    report.fallo = String(e?.stack ?? e);
    console.error(e);
    process.exitCode = 1;
  } finally {
    // Restaura lo que se cambió del catálogo sembrado; lo demás son datos sintéticos de la base local.
    if (tipoI) await api(`/config/tipos-codigo/${tipoI.id}`, 'PATCH', { esCorrelativo: tipoI.esCorrelativo }).catch(() => {});
    fs.writeFileSync(path.join(out, 'resultado.json'), JSON.stringify(report, null, 2));
    await browser?.close();
  }
})();
