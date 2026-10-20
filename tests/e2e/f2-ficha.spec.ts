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
