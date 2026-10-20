import { describe, expect, it } from "vitest";
import { erroresPorCampo, extraerErroresApi, extraerMensajeError } from "./api";

const conRespuesta = (data: unknown) => ({ response: { data } });

describe("extraerErroresApi", () => {
  it("lee el formato común del backend v3", () => {
    const error = conRespuesta({ errores: [{ campo: "denominacion", codigo: "obligatorio", mensaje: "Falta" }] });
    expect(extraerErroresApi(error)).toEqual([{ campo: "denominacion", codigo: "obligatorio", mensaje: "Falta" }]);
  });

  it("entiende la validación de Pydantic y arma el campo desde loc", () => {
    const error = conRespuesta({ detail: [{ loc: ["body", "codigos", 0, "valor"], msg: "Campo requerido", type: "missing" }] });
    expect(extraerErroresApi(error)).toEqual([{ campo: "codigos.0.valor", codigo: "missing", mensaje: "Campo requerido" }]);
  });

  it("acepta un detail de texto y descarta lo que no es un error", () => {
    expect(extraerErroresApi(conRespuesta({ detail: "No autorizado" }))).toEqual([{ codigo: "error", campo: null, mensaje: "No autorizado" }]);
    expect(extraerErroresApi(new Error("red caída"))).toEqual([]);
    expect(extraerErroresApi(conRespuesta({ errores: [{ campo: "x" }, 3] }))).toEqual([]);
  });
});

describe("erroresPorCampo y extraerMensajeError", () => {
  it("junta los mensajes del mismo campo y deja fuera los generales", () => {
    const error = conRespuesta({ errores: [
      { campo: "codigos[0].valor", codigo: "duplicado", mensaje: "Ya existe" },
      { campo: "codigos[0].valor", codigo: "formato", mensaje: "Formato inválido" },
      { campo: null, codigo: "regla", mensaje: "General" },
    ] });
    expect(erroresPorCampo(error)).toEqual({ "codigos[0].valor": "Ya existe; Formato inválido" });
    expect(extraerMensajeError(error)).toBe("Ya existe; Formato inválido; General");
  });

  it("da un mensaje útil si el backend no respondió", () => {
    expect(extraerMensajeError(new Error("Network Error"))).toMatch(/Comprueba la conexión/);
  });
});
