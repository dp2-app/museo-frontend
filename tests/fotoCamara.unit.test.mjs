import assert from "node:assert/strict";
import { test } from "node:test";
import { dimensionesReducidas, LADO_MAXIMO_FOTO } from "../src/lib/fotoCamara.ts";

test("una foto de celular se reduce al lado máximo y conserva la proporción", () => {
  assert.deepEqual(dimensionesReducidas(4032, 3024), { ancho: LADO_MAXIMO_FOTO, alto: 1800 });
  assert.deepEqual(dimensionesReducidas(3024, 4032), { ancho: 1800, alto: LADO_MAXIMO_FOTO });
});

test("una imagen pequeña no se agranda", () => {
  assert.deepEqual(dimensionesReducidas(800, 600), { ancho: 800, alto: 600 });
});

test("nunca devuelve dimensiones menores a un píxel", () => {
  assert.deepEqual(dimensionesReducidas(10000, 1), { ancho: LADO_MAXIMO_FOTO, alto: 1 });
});
