import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const cuenta: { email: string; password: string } = process.env.E2E_CUENTA
  ? JSON.parse(readFileSync(process.env.E2E_CUENTA, "utf8"))
  : { email: process.env.E2E_EMAIL ?? "", password: process.env.E2E_PASSWORD ?? "" };

test.beforeEach(async ({ page }) => {
  test.skip(!cuenta.email, "Defina E2E_EMAIL y E2E_PASSWORD (o E2E_CUENTA) con una cuenta de prueba");
  await page.goto("/login");
  await page.getByLabel("Correo", { exact: true }).fill(cuenta.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(cuenta.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
});

test("F2 de punta a punta: registrar, completar, aprobar y encontrar por código", async ({ page }) => {
  const sufijo = Date.now().toString().slice(-6);
  const nombre = `Retablo E2E ${sufijo}`;
  const codigo = `I-9${sufijo}`;

  // Alta con código I y ubicación inicial: un solo POST /piezas
  await page.goto("/coleccion/nueva");
  await page.getByRole("button", { name: /Agregar código/ }).click();
  await page.getByLabel("Tipo de código 1").selectOption({ label: "N° de inventario MATP (I)" });
  await page.getByLabel("Valor del código 1").fill(codigo);
  await page.getByLabel("Sede o ubicación").selectOption({ index: 1 });
  await page.getByLabel(/Título \/ Denominación/).fill(nombre);
  await page.getByRole("button", { name: "Guardar ficha" }).click();

  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
  await expect(page.getByText("Pieza registrada. La ficha está en borrador.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Información faltante" })).toContainText("Fotografía");

  // Foto (RF-10): con ella la ficha queda completa
  await page.getByLabel(/Agregar fotografía/).fill(`https://archivos.museo.pe/e2e-${sufijo}.jpg`);
  await page.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByText("Principal", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Información faltante" })).toHaveCount(0);

  // Edición con versión
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel(/Autor/).fill("Taller E2E");
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(page.getByRole("region", { name: "Descripción" })).toContainText("Taller E2E");

  // Revisión: enviar y aprobar
  await page.getByRole("button", { name: /Enviar a revisión/ }).click();
  await page.getByRole("button", { name: /Aprobar/ }).click();
  await expect(page.locator("h1 + div .chip").first()).toHaveText("Aprobada");

  // El código I no se puede repetir: el error del backend se ve en la pantalla
  await page.getByLabel("Tipo", { exact: true }).selectOption({ label: "N° de inventario MATP (I)" });
  await page.getByLabel("Valor", { exact: true }).fill("I-1");
  await page.getByRole("button", { name: "Agregar código" }).click();
  await expect(page.getByRole("alert")).toContainText("ya tiene un código vigente de tipo I");

  // Búsqueda por el código escrito de otra forma (normalización)
  await page.goto("/coleccion");
  await page.getByLabel("Código").fill(codigo.toLowerCase().replace("-", " "));
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("row", { name: new RegExp(nombre) })).toBeVisible();
});

test("F2: documentos, corrección del código I y alta en comodato (RN-03, RN-07)", async ({ page }) => {
  const sufijo = Date.now().toString().slice(-6);

  // Pieza propia con código I
  await page.goto("/coleccion/nueva");
  await page.getByRole("button", { name: /Agregar código/ }).click();
  await page.getByLabel("Tipo de código 1").selectOption({ label: "N° de inventario MATP (I)" });
  await page.getByLabel("Valor del código 1").fill(`I-8${sufijo}`);
  await page.getByLabel(/Título \/ Denominación/).fill(`Mate burilado E2E ${sufijo}`);
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(page.getByRole("heading", { name: `Mate burilado E2E ${sufijo}` })).toBeVisible();

  // Documento (RF-11)
  const documentos = page.getByRole("region", { name: "Documentos" });
  await documentos.getByRole("button", { name: /Asociar documento/ }).click();
  await page.getByLabel(/URL del documento/).fill(`https://archivos.museo.pe/acta-${sufijo}.pdf`);
  await page.getByLabel("Título").fill("Acta de donación");
  await documentos.getByRole("button", { name: "Asociar" }).click();
  await expect(documentos.getByRole("link", { name: /Acta de donación/ })).toBeVisible();

  // Corrección excepcional del código I (RF-05)
  const codigos = page.getByRole("region", { name: "Códigos del museo" });
  await codigos.getByRole("button", { name: "Corregir" }).click();
  await page.getByLabel("Valor correcto").fill(`I-7${sufijo}`);
  await page.getByLabel("Motivo de la corrección").fill("Error de transcripción");
  await codigos.getByRole("form").getByRole("button", { name: "Corregir" }).click();
  await expect(codigos).toContainText(`I-7${sufijo}`);
  await expect(page.getByRole("region", { name: "Historial de cambios" })).toContainText("Motivo: Error de transcripción");

  // El comodato no admite código I: la base lo rechaza y la pantalla lo dice (RN-03)
  await page.getByRole("button", { name: "Cambiar régimen" }).click();
  await page.getByLabel("Nuevo régimen").selectOption({ label: "Comodato" });
  await page.getByLabel("Propietario o institución que cede").selectOption({ index: 1 });
  await page.getByRole("region", { name: "Tenencia" }).getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("alert")).toContainText("RN-03");

  // Alta en comodato sin código I, con condiciones y restricción de publicación (RN-07)
  await page.goto("/coleccion/nueva");
  await page.getByLabel("Régimen").selectOption({ label: "Comodato" });
  await page.getByLabel("Propietario o institución que cede").selectOption({ index: 1 });
  await page.getByLabel("Condiciones del contrato").fill("Cesión por 5 años");
  await page.getByLabel(/No se puede publicar/).check();
  await page.getByLabel(/Título \/ Denominación/).fill(`Máscara en comodato E2E ${sufijo}`);
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  const tenencia = page.getByRole("region", { name: "Tenencia" });
  await expect(tenencia).toContainText("Comodato");
  await expect(tenencia).toContainText("No se puede publicar (RN-07)");
});
