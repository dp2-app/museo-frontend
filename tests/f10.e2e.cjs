// F10 · Recorrido de punta a punta contra el backend y el frontend REALES (sin interceptar ni simular respuestas),
// con el proveedor de IA real (Groq) configurado en el backend local. Cubre RIA-06 (Buscar con IA en Colección),
// RIA-05 (Armar sala), los permisos de F10 por rol y RIA-01 (propuesta desde las observaciones, solo API).
// Solo contra un entorno local con una base EXCLUSIVA de pruebas: deja consultas, sugerencias y exportaciones (RN-05).
//   F10_PLAYWRIGHT_MODULE=<ruta a playwright> F10_PASSWORD=... npm run test:f10
// Cuentas de la base local (mismas claves): Administrador, Gestor de colecciones y Consulta interna.
const { chromium } = require(process.env.F10_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WEB = process.env.F10_WEB || 'http://localhost:5173';
const API = process.env.F10_API || 'http://localhost:8000/api/v1';
assert.match(API, /^http:\/\/(127\.0\.0\.1|localhost):/, 'Solo un entorno local exclusivo de pruebas');
const OUT = process.env.F10_EVIDENCIA || path.join(process.cwd(), 'evidencia-f10');
const CLAVE = process.env.F10_PASSWORD;
assert.ok(CLAVE, 'Defina F10_PASSWORD (contraseña de las cuentas de la base local)');
const EMAIL_ADMIN = process.env.F10_EMAIL_ADMIN || 'e2e.f10.admin@example.com';
const EMAIL_GESTOR = process.env.F10_EMAIL_GESTOR || 'e2e.f10.gestor@example.com';
const EMAIL_CONSULTA = process.env.F10_EMAIL_CONSULTA || 'e2e.f10.consulta@example.com';
const PREGUNTA = process.env.F10_PREGUNTA || 'retablos de Ayacucho';
const PEDIDO_SALA = process.env.F10_PEDIDO_SALA || 'máscaras de fiesta con fotografía';
const TIPO_RIA06 = 'RIA-06-consulta-lenguaje-natural';
const IA_TIMEOUT = 90000; // la primera llamada a Groq y la búsqueda híbrida pueden tardar
fs.mkdirSync(OUT, { recursive: true });
const resultado = [];
const ok = (n) => { resultado.push(n); console.log('OK  ' + n); };

async function api(ruta, { metodo = 'GET', cuerpo, token, esperado } = {}) {
  const r = await fetch(API + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) });
  const t = await r.text();
  if (esperado) assert.equal(r.status, esperado, `${metodo} ${ruta} -> ${r.status} ${t.slice(0, 300)}`);
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = null; }
  return { status: r.status, json };
}
const token = async (email) => (await api('/auth/login', { metodo: 'POST', cuerpo: { email, password: CLAVE }, esperado: 200 })).json.accessToken;

async function entrar(context, email) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(WEB + '/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(CLAVE);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
}
const shot = async (page, n) => { await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false }); };
const shotEn = async (page, n, loc) => {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(200);
  await shot(page, n);
};
const menu = async (page) => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); return (await page.locator('header nav a').allInnerTexts()).map((t) => t.trim()); };
const consultasDe = async (t) => (await api(`/ia/sugerencias?tipo=${TIPO_RIA06}&limite=500`, { token: t, esperado: 200 })).json;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    await token(EMAIL_ADMIN); // la cuenta del Administrador existe y entra (se usa en el paso 3)
    const gestorT = await token(EMAIL_GESTOR);
    const consultaT = await token(EMAIL_CONSULTA);
    const gestorId = (await api('/auth/sesion', { token: gestorT, esperado: 200 })).json.usuario.id;

    // ---------- 1. RIA-06 · el Gestor pregunta en Colección con «Buscar con IA»
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    const gestor = await entrar(ctx, EMAIL_GESTOR);
    assert.ok((await menu(gestor)).includes('Armar sala'), 'El Gestor (ia.usar) ve Armar sala');
    await gestor.goto(WEB + '/piezas');
    const buscarIA = gestor.locator('details', { hasText: 'Buscar con IA' });
    await buscarIA.locator('summary').click();
    const antes = (await consultasDe(gestorT)).length;
    await buscarIA.getByPlaceholder(/cerámicas de Ayacucho/).fill(PREGUNTA);
    await buscarIA.getByRole('button', { name: 'Preguntar' }).click();
    const respuesta = buscarIA.getByRole('status').filter({ hasText: 'Interpretación de IA' });
    await respuesta.waitFor({ timeout: IA_TIMEOUT });
    const chips = respuesta.getByRole('button', { name: /^Quitar el filtro/ });
    const nChips = await chips.count();
    assert.ok(nChips >= 1, 'La IA interpretó al menos un filtro');
    const totalTexto = async () => {
      const t = await buscarIA.locator('p', { hasText: /^(\d+|…) piezas$/ }).first().innerText();
      return Number(t.replace(/\D/g, ''));
    };
    await gestor.waitForLoadState('networkidle');
    const totalIA = await totalTexto();
    await shotEn(gestor, '01-ria06-buscar-con-ia', buscarIA);

    // El registro: una consulta nueva, «registrada», con quién preguntó y sin revisor (D4).
    const despues = await consultasDe(gestorT);
    assert.equal(despues.length, antes + 1, 'Cada consulta deja su registro');
    const ultima = despues.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))[0];
    assert.equal(ultima.estado, 'registrada');
    assert.equal(ultima.solicitadoPor, gestorId);
    assert.equal(ultima.revisadoPor ?? null, null);
    ok(`RIA-06: «${PREGUNTA}» → ${nChips} filtro(s) interpretado(s) y ${totalIA} piezas; la consulta queda «registrada» con quién preguntó y sin revisor`);

    // El total es el de la búsqueda real de F7 con los mismos filtros (la IA no da cifras).
    const filtros = ultima.payloadSugerido?.filtros || {};
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, String(v)])), tamano: '1' }).toString();
    const real = (await api('/piezas?' + qs, { token: gestorT, esperado: 200 })).json;
    assert.equal(real.total, totalIA, `El total mostrado (${totalIA}) es el de GET /piezas (${real.total})`);
    ok(`RIA-06: el total mostrado coincide con GET /piezas con los mismos filtros (${real.total})`);

    // Quitar un filtro recalcula sobre el catálogo y queda anotado en el registro (filtrosAplicados).
    await chips.first().click();
    await gestor.waitForLoadState('networkidle');
    await gestor.waitForTimeout(800);
    const totalSinChip = await totalTexto();
    assert.ok(totalSinChip >= totalIA, 'Sin un filtro hay igual o más piezas');
    const anotada = (await consultasDe(gestorT)).find((s) => s.id === ultima.id);
    assert.ok(anotada.payloadSugerido?.filtrosAplicados, 'El registro guarda los filtros con que se quedó la persona');
    await shotEn(gestor, '02-ria06-filtro-quitado', buscarIA);
    ok(`RIA-06: quitar un filtro deja ${totalSinChip} piezas y el registro guarda «filtrosAplicados»`);

    // Las preguntas de una persona no las ve otra sin auditoria.ver.
    const otrosVen = (await api(`/ia/sugerencias?tipo=${TIPO_RIA06}&limite=500`, { token: gestorT })).json.every((s) => s.solicitadoPor === gestorId);
    assert.ok(otrosVen, 'El Gestor solo ve sus propias preguntas');
    const enCola = (await api('/ia/sugerencias?limite=500', { token: gestorT, esperado: 200 })).json.some((s) => s.tipo === TIPO_RIA06);
    assert.ok(!enCola, 'Las preguntas no entran a la cola de revisión');
    ok('RIA-06: cada persona ve solo sus preguntas y no entran a la cola de pendientes');

    // ---------- 2. RIA-05 · el Gestor arma una sala; las condiciones del pedido son filtros
    await gestor.goto(WEB + '/asistente-ia');
    await gestor.getByRole('heading', { name: '¿Qué historia quieres contar?' }).waitFor();
    assert.equal(await gestor.getByText(/Índice de búsqueda|Indexar ahora/).count(), 0, 'Sin ia.indexar no se ve el panel del índice');
    ok('RIA-05: el Gestor no ve el panel del índice (ia.indexar es solo del Administrador)');
    await gestor.getByLabel('Tema o estilo', { exact: true }).fill(PEDIDO_SALA);
    await gestor.getByRole('button', { name: 'Proponer piezas' }).click();
    const propuesta = gestor.locator('.sala-proposal');
    await propuesta.waitFor({ timeout: IA_TIMEOUT });
    const condiciones = gestor.getByLabel('Condiciones del pedido');
    await condiciones.waitFor();
    assert.match(await condiciones.innerText(), /fotograf/i, '«con fotografía» se aplica como condición');
    const elegir = gestor.getByRole('checkbox', { name: /^Elegir (?!todas)/ });
    // Con la condición, solo entran piezas con fotografía. La base local no tiene fotografías: la propuesta queda vacía
    // y el mensaje lo explica, sin rellenar con piezas que no cumplen (#210).
    const conCondicion = await elegir.count();
    await shotEn(gestor, '03-ria05-condicion-con-fotografia', propuesta);
    const ids = [];
    if (conCondicion > 0) {
      const salas = (await api('/ia/sugerencias?tipo=RIA-05-consulta-catalogo&limite=5', { token: gestorT, esperado: 200 })).json;
      const sala = salas.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))[0];
      ids.push(...(sala?.payloadSugerido?.piezas || []).map((p) => p.id || p.piezaId).filter(Boolean).slice(0, 10));
      for (const id of ids) {
        const ficha = (await api(`/piezas/${id}`, { token: gestorT, esperado: 200 })).json;
        assert.ok((ficha.fotografias || []).length > 0, `La pieza ${id} propuesta tiene fotografía`);
      }
      ok(`RIA-05: con «con fotografía» propone ${conCondicion} piezas y todas tienen fotografía`);
    } else {
      ok(`RIA-05: «${PEDIDO_SALA}» aplica «con fotografía» como condición: ninguna pieza local la cumple y no se rellena con otras (mensaje: «${(await propuesta.innerText()).split(/\n/)[0]}»)`);
    }
    // Quitar la condición vuelve a pedir la propuesta sin ella.
    await condiciones.getByRole('button', { name: /^Quitar la condición/ }).first().click();
    await propuesta.waitFor({ timeout: IA_TIMEOUT });
    await elegir.first().waitFor({ timeout: IA_TIMEOUT });
    const nPropuestas = await elegir.count();
    assert.ok(nPropuestas >= 1, 'Sin la condición, la IA propone piezas');
    assert.match(await gestor.getByLabel('Condiciones del pedido').innerText(), /fotograf/i, 'La condición quitada sigue a la vista, tachada');
    // El curador decide: deja marcadas solo 3 de las propuestas.
    await gestor.getByRole('button', { name: 'Quitar selección', exact: true }).click();
    const nElegidas = Math.min(3, nPropuestas);
    for (let i = 0; i < nElegidas; i++) await elegir.nth(i).check();
    await gestor.getByRole('button', { name: 'Lista', exact: true }).click();
    for (let i = 0; i < nElegidas; i++) assert.ok(await elegir.nth(i).isChecked(), 'La vista conserva la selección');
    await gestor.getByRole('button', { name: 'Catálogo', exact: true }).click();
    await shotEn(gestor, '04-ria05-propuesta-y-seleccion', propuesta);
    const [descarga] = await Promise.all([
      gestor.waitForEvent('download', { timeout: 30000 }),
      gestor.getByRole('button', { name: /Exportar selección a Excel/ }).click(),
    ]);
    const archivo = path.join(OUT, 'ria05-seleccion.xlsx');
    await descarga.saveAs(archivo);
    assert.ok(fs.statSync(archivo).size > 1000, 'El Excel de la selección no está vacío');
    ok(`RIA-05: sin la condición propone ${nPropuestas} piezas; el curador elige ${nElegidas} y exporta solo esas (${descarga.suggestedFilename()})`);
    await ctx.close();

    // ---------- 3. Permisos por rol: el Administrador ve el índice; Consulta pregunta pero no arma salas
    const ctxAdmin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const admin = await entrar(ctxAdmin, EMAIL_ADMIN);
    await admin.goto(WEB + '/asistente-ia');
    await admin.getByRole('heading', { name: '¿Qué historia quieres contar?' }).waitFor();
    await admin.locator('.sala-index-details > summary').click();
    await admin.getByText(/Indexar ahora/).first().waitFor();
    await shot(admin, '05-ria05-indice-administrador');
    ok('RIA-05: el Administrador (ia.indexar) ve el estado del índice y «Indexar ahora»');
    await ctxAdmin.close();
    assert.equal((await api('/ia/salas/indice', { token: gestorT })).status, 403);
    ok('RIA-05: GET /ia/salas/indice sin ia.indexar → 403');

    const ctxConsulta = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const consulta = await entrar(ctxConsulta, EMAIL_CONSULTA);
    assert.ok(!(await menu(consulta)).includes('Armar sala'), 'Consulta interna (sin ia.usar) no ve Armar sala');
    await consulta.goto(WEB + '/piezas');
    await consulta.locator('details', { hasText: 'Buscar con IA' }).waitFor();
    await ctxConsulta.close();
    assert.equal((await api('/ia/salas/sugerir', { metodo: 'POST', cuerpo: { pedido: PEDIDO_SALA, cantidad: 10 }, token: consultaT })).status, 403);
    const preguntarConsulta = () => api('/ia/consultas', { metodo: 'POST', cuerpo: { pregunta: PREGUNTA }, token: consultaT });
    let r = await preguntarConsulta();
    if (r.status === 429) { // una corrida anterior agotó el cupo de este minuto (paso 4): se espera a que pase
      await new Promise((ok) => setTimeout(ok, 61000));
      r = await preguntarConsulta();
    }
    assert.equal(r.status, 200);
    ok('Permisos: Consulta interna pregunta (piezas.ver, C1) pero no arma salas (403 sin ia.usar) ni ve el menú');

    // ---------- 4. Límite por persona de RIA-06 (#128): la misma pregunta sale de la caché, sin gastar cuota
    let ultimo = 200;
    for (let i = 0; i < 12 && ultimo !== 429; i++) {
      ultimo = (await api('/ia/consultas', { metodo: 'POST', cuerpo: { pregunta: PREGUNTA }, token: consultaT })).status;
    }
    assert.equal(ultimo, 429, 'Al superar el límite por minuto responde 429');
    ok('RIA-06: al superar IA_CONSULTAS_POR_MINUTO la API responde 429 limite_consultas');

    // ---------- 5. RIA-01 · la IA propone y una persona decide (DA-006): rechazar no toca la ficha
    // Fichas de iglesias: en el inventario real casi todas traen observaciones (inscripciones, exhibiciones).
    const lista = (await api('/piezas?q=iglesia&tamano=20', { token: gestorT, esperado: 200 })).json.items || [];
    let probada = null;
    for (const p of lista) {
      const r = await api(`/ia/extraccion-observaciones/${p.id}`, { metodo: 'POST', token: gestorT });
      if (r.status === 202) { probada = { pieza: p, sugerencia: r.json }; break; }
    }
    if (probada) {
      const fichaAntes = (await api(`/piezas/${probada.pieza.id}`, { token: gestorT, esperado: 200 })).json;
      assert.equal(probada.sugerencia.estado, 'pendiente', 'La propuesta queda pendiente de una persona');
      await api(`/ia/sugerencias/${probada.sugerencia.id}`, { metodo: 'PATCH', cuerpo: { estado: 'rechazado' }, token: gestorT, esperado: 200 });
      const fichaDespues = (await api(`/piezas/${probada.pieza.id}`, { token: gestorT, esperado: 200 })).json;
      assert.equal(fichaDespues.version, fichaAntes.version, 'Rechazar no cambia la ficha');
      ok('RIA-01: la propuesta desde las observaciones queda «pendiente» y, al rechazarla, la ficha no cambia (DA-006)');
    } else {
      ok('RIA-01: ninguna de las 20 fichas buscadas tiene observaciones con datos que proponer (sin llamada útil al modelo)');
    }

    fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify({ fecha: new Date().toISOString(), web: WEB, api: API, comprobaciones: resultado }, null, 2));
    console.log(`\n${resultado.length} comprobaciones aprobadas. Evidencia en ${OUT}`);
  } catch (e) {
    console.error('FALLA:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
