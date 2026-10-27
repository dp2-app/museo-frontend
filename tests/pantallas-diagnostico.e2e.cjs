// Diagnóstico de lectura de las siete pantallas; no invoca proveedores de IA.
const { chromium } = require(process.env.F0_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.F0_API; const web = process.env.F0_WEB; const out = process.env.F0_EVIDENCIA;
for (const url of [base, web]) assert.match(url || '', /^http:\/\/(127\.0\.0\.1|localhost):/);
const informe = { pantallas: [], erroresAplicacion: [], erroresHTTP: [], erroresConsola: [] };
(async () => {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.F0_EMAIL, password: process.env.F0_PASSWORD }) });
  assert.equal(login.status, 200); const token = (await login.json()).accessToken;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const ruta of ['/', '/coleccion', '/ubicacion-y-movimientos', '/importacion', '/consultas-y-reportes', '/asistente-ia', '/administracion']) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 950 } }); await context.addInitScript(t => localStorage.setItem('museo.accessToken', t), token);
      const page = await context.newPage();
      const fallos = [];
      page.on('pageerror', e => { informe.erroresAplicacion.push({ ruta, mensaje: e.message }); fallos.push(e.message); });
      page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) { informe.erroresConsola.push({ ruta, mensaje: m.text() }); fallos.push(m.text()); } });
      page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) { informe.erroresHTTP.push({ ruta, url: r.url().slice(base.length), estado: r.status() }); fallos.push(`HTTP ${r.status()}: ${r.url().slice(base.length)}`); } });
      await page.goto(web + ruta); await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const rota = await page.getByText('Esta pantalla no se pudo mostrar', { exact: true }).count();
      if (rota) fallos.push('ErrorBoundary: pantalla no disponible');
      const h1 = await page.locator('h1').allTextContents();
      informe.pantallas.push({ ruta, h1, correcta: !fallos.length, fallos });
      console.log((fallos.length ? 'FALLO ' : 'OK ') + ruta + (fallos.length ? ': ' + fallos.join('; ') : ' sin errores de consola/API'));
      await page.screenshot({ path: path.join(out, (ruta.replaceAll('/', '_') || 'inicio') + '.png') }); await context.close();
    }
    if (informe.pantallas.some(p => !p.correcta)) process.exitCode = 1;
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'pantallas.json'), JSON.stringify(informe, null, 2)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
