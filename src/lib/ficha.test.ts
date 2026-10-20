import { describe, expect, it } from "vitest";
import type { CampoFicha, UbicacionFisica } from "../types";
import { datosEditables } from "./fichaF0";
import { seccionesPara } from "./secciones";
import { aplanarUbicaciones, rutaUbicacion } from "./ubicaciones";

const campo = (clave: string, extra: Partial<CampoFicha> = {}): CampoFicha => ({
  id: clave, clave, etiqueta: clave, tipo: "texto", lista: null, multivalor: false, obligatorio: false, orden: 0,
  grupo: "G", ayuda: null, activo: true, esBase: true, almacenamiento: "columna", soloLectura: false, ...extra,
});

describe("datosEditables", () => {
  it("solo envía los campos activos y editables que el formulario tocó", () => {
    const campos = [campo("denominacion"), campo("ubicacion_actual_id", { soloLectura: true }), campo("viejo", { activo: false }),
      campo("materiales", { almacenamiento: "lista" }), campo("autor")];
    const datos = { campos: { denominacion: "Retablo", ubicacion_actual_id: "u1", viejo: "x" }, listas: { materiales: ["m1"] } };
    expect(datosEditables(campos, datos)).toEqual({ campos: { denominacion: "Retablo" }, listas: { materiales: ["m1"] } });
  });
});

describe("ubicaciones en dos niveles", () => {
  const arbol = [{ id: "s", parentId: null, nivelTipo: "sede", nombre: "Sede central",
    hijos: [{ id: "u", parentId: "s", nivelTipo: "espacio", nombre: "Depósito 2 · Rack 3", hijos: [] }] }] as unknown as UbicacionFisica[];

  it("aplana la sede y sus ubicaciones con sangría para el selector", () => {
    expect(aplanarUbicaciones(arbol).map((u) => u.etiqueta)).toEqual(["Sede central", "— Depósito 2 · Rack 3"]);
  });

  it("arma la ruta hasta la ubicación", () => {
    expect(rutaUbicacion("u", arbol)).toEqual(["Sede central", "Depósito 2 · Rack 3"]);
    expect(rutaUbicacion("no-existe", arbol)).toEqual([]);
    expect(rutaUbicacion(null, arbol)).toEqual([]);
  });
});

describe("seccionesPara (navegación por permiso, nunca por rol)", () => {
  it("muestra solo las pantallas que el usuario puede abrir", () => {
    const permisos = new Set(["piezas.ver", "reportes.ver"]);
    const puedeAlguno = (...lista: string[]) => lista.length === 0 || lista.some((p) => permisos.has(p));
    expect(seccionesPara(puedeAlguno).map((s) => s.ruta)).toEqual(["/", "/coleccion", "/consultas-y-reportes"]);
  });
});
