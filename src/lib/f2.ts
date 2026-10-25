import type { DatosFichaV3 } from "../types";

const normal = (v: unknown) => (v === undefined || v === "" ? null : v);
const igual = (a: unknown, b: unknown) =>
  Array.isArray(a) || Array.isArray(b)
    ? JSON.stringify([...((a as unknown[]) ?? [])].sort()) === JSON.stringify([...((b as unknown[]) ?? [])].sort())
    : JSON.stringify(normal(a)) === JSON.stringify(normal(b));

/** R2: al editar se envía solo lo que cambió. Además de ser lo acordado, evita un error real: el backend rechaza
 * un obligatorio enviado vacío aunque ya lo estuviera, y las piezas migradas del Excel suelen tener alguno así (V3). */
export function soloCambios(antes: DatosFichaV3, despues: DatosFichaV3): DatosFichaV3 {
  const campos = Object.fromEntries(Object.entries(despues.campos).filter(([k, v]) => !igual(antes.campos[k], v)));
  const listas = Object.fromEntries(Object.entries(despues.listas).filter(([k, v]) => !igual(antes.listas[k] ?? [], v)));
  return { campos, listas };
}

export const sinCambios = (d: DatosFichaV3) => !Object.keys(d.campos).length && !Object.keys(d.listas).length;
