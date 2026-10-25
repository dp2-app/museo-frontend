import { describe, expect, it } from "vitest";
import { FORMATOS_DOCUMENTO, FORMATOS_FOTO, sinCambios, soloCambios, validarArchivo } from "./f2";

describe("soloCambios (R2)", () => {
  it("deja fuera lo que no cambió, trata vacío y null como iguales y compara listas sin orden", () => {
    const antes = { campos: { denominacion: "Retablo", procedencia: null, alto_cm: 31, autor: "A" }, listas: { materiales: ["m1", "m2"] } };
    const despues = { campos: { denominacion: "Retablo", procedencia: "", alto_cm: 31, autor: "B" }, listas: { materiales: ["m2", "m1"], tecnicas: [] } };
    expect(soloCambios(antes, despues)).toEqual({ campos: { autor: "B" }, listas: {} });
  });

  it("detecta listas cambiadas y el vaciado de un campo", () => {
    const antes = { campos: { autor: "A" }, listas: { materiales: ["m1"] } };
    expect(soloCambios(antes, { campos: { autor: null }, listas: { materiales: ["m1", "m3"] } }))
      .toEqual({ campos: { autor: null }, listas: { materiales: ["m1", "m3"] } });
    expect(sinCambios({ campos: {}, listas: {} })).toBe(true);
  });
});

describe("validarArchivo (V12, V13)", () => {
  const archivo = (nombre: string, mb: number) => new File([new Uint8Array(Math.round(mb * 1024 * 1024))], nombre);

  it("acepta JPG/PNG de hasta 15 MB para fotos y PDF para documentos", () => {
    expect(validarArchivo(archivo("frente.JPG", 1), FORMATOS_FOTO, 15)).toBeNull();
    expect(validarArchivo(archivo("acta.pdf", 1), FORMATOS_DOCUMENTO, 25)).toBeNull();
  });

  it("rechaza formatos y tamaños fuera de la regla, con un mensaje que nombra el archivo", () => {
    expect(validarArchivo(archivo("acta.pdf", 1), FORMATOS_FOTO, 15)).toMatch(/«acta.pdf»: formato no permitido/);
    expect(validarArchivo(archivo("enorme.png", 16), FORMATOS_FOTO, 15)).toMatch(/«enorme.png» pesa más de 15 MB/);
  });
});
