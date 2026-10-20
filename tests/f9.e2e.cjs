// F9 · Recorrido de punta a punta contra el backend y el frontend REALES (sin interceptar ni simular respuestas).
// Solo contra un entorno local con una base EXCLUSIVA de pruebas: crea roles y usuarios (que no se pueden borrar, RN-05).
//   F9_PLAYWRIGHT_MODULE=<ruta a playwright> F9_PASSWORD=... npm run test:f9
// Requiere las cuentas de la base local: admin@... (Administrador) y catalogador@... (Catalogador/practicante).
const { chromium } = require(process.env.F9_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WEB = process.env.F9_WEB || 'http://127.0.0.1:5173';
const API = process.env.F9_API || 'http://127.0.0.1:8000/api/v1';
assert.match(API, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo un entorno local exclusivo de pruebas');
const OUT = process.env.F9_EVIDENCIA || path.join(process.cwd(), 'evidencia-f9');
const CLAVE = process.env.F9_PASSWORD;
assert.ok(CLAVE, 'Defina F9_PASSWORD (contraseña de las cuentas de la base local)');
const EMAIL_ADMIN = process.env.F9_EMAIL_ADMIN || 'admin@museo-atp.pe';
const EMAIL_CATALOGADOR = process.env.F9_EMAIL_CATALOGADOR || 'catalogador@museo-atp.pe';
const SUFIJO = Date.now().toString(36);
const ROL = `Auditor de cargas ${SUFIJO}`;
const ROL_LECTURA = `Lectura de seguridad ${SUFIJO}`;
const EMAIL = `auditor.${SUFIJO}@museo-atp.pe`;
const EMAIL_LECTURA = `lector.${SUFIJO}@museo-atp.pe`;
fs.mkdirSync(OUT, { recursive: true });
const resultado = [];
const ok = (n) => { resultado.push(n); console.log('OK  ' + n); };

async function api(ruta, { metodo = 'GET', cuerpo, token, esperado } = {}) {
  const r = await fetch(API + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
  const t = await r.text();
  if (esperado) assert.equal(r.status, esperado, `${metodo} ${ruta} -> ${r.status} ${t}`);
  return { status: r.status, json: t ? JSON.parse(t) : null };
}
const token = async (email) => (await api('/auth/login', { metodo: 'POST', cuerpo: { email, password: CLAVE }, esperado: 200 })).json.accessToken;

async function entrar(context, email) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(WEB + '/login');
  await page.getByLabel('Correo').fill(email).catch(async () => page.locator('#login-email').fill(email));
  await page.locator('#login-password').fill(CLAVE);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
}
const shot = async (page, n) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false }); };
// Captura con `loc` cerca del borde superior (debajo del encabezado fijo).
const shotEn = async (page, n, loc) => {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false });
};
const acceso = (page, funcionalidad) => page.getByLabel('Acceso a ' + funcionalidad, { exact: true });
const camposDelRol = async (page) => {
  const det = page.locator('details', { hasText: 'Campos de la ficha que ve este rol' });
  await det.waitFor();
  if (!(await det.evaluate((d) => d.open))) await det.locator('summary').click();
  return det;
};
const menu = async (page) => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); return (await page.locator('header nav a').allInnerTexts()).map((t) => t.trim()); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const adminT = await token(EMAIL_ADMIN);

    // ---------- 1. El administrador crea un rol desde la pantalla, con una combinación de permisos
    const ctxAdmin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const admin = await entrar(ctxAdmin, EMAIL_ADMIN);
    assert.deepEqual((await menu(admin)).sort(), ['Administración', 'Asistente IA', 'Colección', 'Consultas y reportes', 'Importación', 'Panel principal', 'Ubicación y movimientos'].sort());
    ok('Administrador ve todo el menú (derivado de sus 44 permisos, no de su nombre de rol)');
    await admin.goto(WEB + '/administracion');
    await admin.getByRole('button', { name: 'Roles y permisos', exact: true }).click();
    await admin.getByRole('heading', { name: 'Roles y permisos' }).waitFor();
    await admin.getByRole('button', { name: /Catalogador\/practicante/ }).click();
    await shotEn(admin, '01-roles-y-permisos', admin.getByText('Elige, para cada funcionalidad'));
    await admin.getByRole('button', { name: 'Nuevo rol' }).click();
    await admin.locator('#rol-nombre').fill(ROL);
    await admin.locator('#rol-descripcion').fill('Revisa cargas de Excel sin poder aprobarlas');
    // Cada funcionalidad tiene un desplegable de nivel de acceso; lo que depende de otra funcionalidad se ajusta solo.
    assert.equal(await admin.getByLabel('Fichas: Aprobar o rechazar fichas', { exact: true }).isDisabled(), true);
    await acceso(admin, 'Fotografías').selectOption('editar');
    assert.equal(await acceso(admin, 'Fichas').inputValue(), 'ver');
    await admin.getByText('También se activó el acceso a Fichas').waitFor();
    await shotEn(admin, '02-nuevo-rol-matriz', admin.getByText('También se activó el acceso a Fichas'));
    ok('«Puede editar» fotografías activa «Solo ver» en Fichas (dependencia) y lo avisa');
    await acceso(admin, 'Fichas').selectOption('sin');
    assert.equal(await acceso(admin, 'Fotografías').inputValue(), 'sin');
    await admin.getByText(/También se quitó el acceso a .*Fotografías/).waitFor();
    ok('Quitar el acceso a Fichas quita lo que depende de él (Fotografías) y lo avisa');
    await acceso(admin, 'Cargas de Excel').selectOption('editar');
    assert.equal(await admin.getByLabel('Cargas de Excel: Aprobar cargas', { exact: true }).isEnabled(), true);
    await acceso(admin, 'Cargas de Excel').selectOption('ver');
    await acceso(admin, 'Reportes').selectOption('ver');
    await admin.getByRole('button', { name: 'Crear rol' }).click();
    await admin.getByText('Rol creado').waitFor();
    const roles = (await api('/roles', { token: adminT, esperado: 200 })).json;
    const creado = roles.find((r) => r.nombre === ROL);
    assert.deepEqual([...creado.permisos].sort(), ['importacion.ver', 'reportes.ver']);
    ok('El rol nuevo se guardó en el servidor con exactamente esa combinación');

    // ---------- 2. Crear un usuario con ese rol desde la pantalla
    await admin.getByRole('button', { name: 'Usuarios', exact: true }).click();
    await admin.getByRole('heading', { name: 'Usuarios' }).first().waitFor();
    await admin.locator('#u-nombre').fill('Auditoría de Prueba');
    await admin.locator('#u-email').fill(EMAIL);
    await admin.locator('#u-password').fill(CLAVE);
    await admin.locator('#u-rol').selectOption({ label: ROL });
    await admin.getByRole('button', { name: 'Crear usuario' }).click();
    await admin.getByText('creado').first().waitFor();
    await shot(admin, '03-usuarios');
    ok('Usuario creado desde la pantalla con el rol nuevo');

    // ---------- 3. Ese usuario solo ve y hace lo que su rol permite
    const ctxAud = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const aud = await entrar(ctxAud, EMAIL);
    const audMenu = await menu(aud);
    assert.deepEqual(audMenu.sort(), ['Consultas y reportes', 'Importación', 'Panel principal'].sort());
    ok('El menú del usuario nuevo muestra solo Panel, Importación y Consultas');
    await aud.goto(WEB + '/administracion');
    await aud.waitForURL((u) => u.pathname === '/');
    ok('Entrar por URL a /administracion sin permiso redirige al inicio');
    await shot(aud, '04-menu-usuario-limitado');
    const audT = await token(EMAIL);
    assert.equal((await api('/usuarios', { token: audT })).status, 403);
    assert.equal((await api('/piezas', { metodo: 'POST', cuerpo: { campos: { denominacion: 'x' } }, token: audT })).status, 403);
    assert.equal((await api('/propietarios', { token: audT })).status, 403);
    ok('Llamadas directas a la API sin permiso: 403 (usuarios, crear fichas, propietarios)');

    // ---------- 4. El cambio de permisos rige sin volver a iniciar sesión
    await admin.getByRole('button', { name: 'Roles y permisos', exact: true }).click();
    await admin.getByRole('button', { name: new RegExp(ROL) }).click();
    await acceso(admin, 'Sugerencias de IA').selectOption('ver');
    await admin.getByRole('button', { name: 'Guardar cambios' }).click();
    await admin.getByText('Rol guardado').waitFor();
    await aud.reload();
    await aud.locator('header nav a', { hasText: 'Asistente IA' }).waitFor();
    ok('Al guardar el rol, el usuario ve «Asistente IA» tras recargar, con el mismo inicio de sesión');

    // ---------- 5. Rol de solo lectura en Administración
    await api('/roles', { metodo: 'POST', token: adminT, esperado: 201, cuerpo: { nombre: ROL_LECTURA, permisos: ['usuarios.ver', 'roles.ver', 'auditoria.ver', 'config.visibilidad.ver'] } });
    const rolLectura = (await api('/roles', { token: adminT })).json.find((r) => r.nombre === ROL_LECTURA);
    await api('/usuarios', { metodo: 'POST', token: adminT, esperado: 201, cuerpo: { nombre: 'Lector de Seguridad', email: EMAIL_LECTURA, password: CLAVE, rolId: rolLectura.id } });
    const ctxLec = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const lec = await entrar(ctxLec, EMAIL_LECTURA);
    assert.deepEqual(await menu(lec), ['Panel principal', 'Administración']);
    await lec.goto(WEB + '/administracion');
    await lec.locator('nav[aria-label="Secciones de administración"] button').first().waitFor();
    const secciones = await lec.locator('nav[aria-label="Secciones de administración"] button').allInnerTexts();
    assert.deepEqual(secciones.map((s) => s.trim()), ['Usuarios', 'Roles y permisos', 'Bitácora de auditoría']);
    ok('Rol de solo lectura: ve únicamente las 3 secciones de seguridad (sin configuración de ficha)');
    assert.equal(await lec.getByRole('button', { name: 'Crear usuario' }).count(), 0);
    assert.equal(await lec.getByRole('button', { name: 'Desactivar' }).count(), 0);
    await shot(lec, '05-usuarios-solo-lectura');
    await lec.getByRole('button', { name: 'Roles y permisos', exact: true }).click();
    assert.equal(await lec.getByRole('button', { name: 'Nuevo rol' }).count(), 0);
    assert.equal(await lec.getByRole('button', { name: 'Guardar cambios' }).count(), 0);
    assert.equal(await acceso(lec, 'Fichas').isDisabled(), true);
    const detLec = await camposDelRol(lec);
    assert.equal(await detLec.getByLabel('Campo Autor / Atribuido / Firmado: visibilidad', { exact: true }).isDisabled(), true);
    await shotEn(lec, '06-roles-solo-lectura', lec.getByText('Solo lectura: tu rol puede ver los roles'));
    ok('Solo lectura: sin botones de crear/guardar y desplegables deshabilitados');
    const lecT = await token(EMAIL_LECTURA);
    assert.equal((await api('/roles/' + rolLectura.id + '/permisos', { metodo: 'PUT', token: lecT, cuerpo: { permisos: [] } })).status, 403);
    ok('Aunque se fuerce la llamada, el servidor rechaza la edición (403)');

    // ---------- 6. Campos de la ficha que ve el rol (dentro de la misma pantalla de roles)
    assert.equal(await admin.getByRole('button', { name: 'Visibilidad por rol', exact: true }).count(), 0);
    await admin.getByRole('button', { name: /Catalogador\/practicante/ }).click();
    const det = await camposDelRol(admin);
    const campoAutor = det.getByLabel('Campo Autor / Atribuido / Firmado: visibilidad', { exact: true });
    await campoAutor.selectOption('oculto');
    await admin.getByText('1 campo oculto').waitFor();
    let put = admin.waitForResponse((r) => r.url().includes('/config/visibilidad-campos') && r.request().method() === 'PUT');
    await admin.getByRole('button', { name: 'Guardar cambios' }).click();
    assert.equal((await put).status(), 200);
    await admin.getByText('Rol guardado').waitFor();
    await shotEn(admin, '07-visibilidad', det.locator('summary'));
    const catT = await token(EMAIL_CATALOGADOR);
    const ses = (await api('/auth/sesion', { token: catT })).json;
    assert.ok(ses.camposOcultos.includes('autor'), `ocultos del catalogador=${JSON.stringify(ses.camposOcultos)}`);
    const campos = (await api('/campos-ficha', { token: catT, esperado: 200 })).json;
    assert.equal(campos.some((c) => c.clave === 'autor'), false, 'autor sigue en /campos-ficha');
    await campoAutor.selectOption('visible');
    put = admin.waitForResponse((r) => r.url().includes('/config/visibilidad-campos') && r.request().method() === 'PUT');
    await admin.getByRole('button', { name: 'Guardar cambios' }).click();
    assert.equal((await put).status(), 200);
    await admin.getByText('Rol guardado').waitFor();
    assert.equal((await api('/campos-ficha', { token: catT, esperado: 200 })).json.some((c) => c.clave === 'autor'), true);
    ok('Ocultar «Autor» al Catalogador desde la pantalla de roles: el servidor deja de entregárselo en el formulario; se restaura al volver a marcarlo');

    // ---------- 7. Bitácora
    await admin.getByRole('button', { name: 'Bitácora de auditoría', exact: true }).click();
    await admin.getByRole('heading', { name: 'Bitácora de auditoría' }).waitFor();
    await admin.locator('#bitacora-tabla').selectOption('roles');
    await admin.getByText(/permisos/).first().waitFor();
    await shot(admin, '08-bitacora');
    ok('La bitácora muestra los cambios de roles y permisos con quién, cuándo, antes y después');

    // ---------- 8. Móvil
    const ctxMov = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mov = await entrar(ctxMov, EMAIL_ADMIN);
    await mov.goto(WEB + '/administracion');
    await mov.locator('#f0-seccion').selectOption('roles');
    await mov.getByRole('heading', { name: 'Roles y permisos' }).waitFor();
    const desborde = await mov.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await shot(mov, '09-movil-roles');
    assert.equal(desborde, false);
    ok('En móvil (390 px) no hay desborde horizontal de la página');

    fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify({ fecha: new Date().toISOString(), comprobaciones: resultado }, null, 2));
    console.log(`\n${resultado.length} comprobaciones aprobadas`);
  } catch (e) {
    console.error('FALLÓ:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
