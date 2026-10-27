import type { DatosFichaV3, EstadoFicha } from "../types";

export interface Ficha {
  id: string; version: string; estadoFicha: EstadoFicha; motivoRechazo: string | null;
  incompleta: boolean; camposFaltantes: string[]; campos: Record<string, unknown>;
  listas: Record<string, { id: string; etiqueta: string | null }[]>;
  etiquetas: Record<string, string | null>;
  codigos: { id: string; tipoCodigo: string; tipoNombre: string; valor: string; bloqueado: boolean }[];
  tenenciaVigente: { regimen: string; regimenNombre: string; restringidoPublicacion: boolean } | null;
  creadoPor: { nombre: string } | null; creadoEn: string;
  actualizadoPor: { nombre: string } | null; actualizadoEn: string;
}
export interface Ubicacion {
  id: string; parentId: string | null; nivelTipo: "sede" | "ubicacion"; nombre: string;
  codigo: string | null; direccion: string | null; activo: boolean; hijos?: Ubicacion[];
}
export const nombreFicha = (p: Ficha) => String(p.campos.denominacion || "Sin denominación");
export const datosFicha = (p: Ficha): DatosFichaV3 => ({ campos: p.campos, listas: Object.fromEntries(Object.entries(p.listas).map(([k, v]) => [k, v.map((x) => x.id)])) });
/** PATCH parcial: los valores históricos inactivos que no cambiaron no se reenvían. */
export function cambiosFicha(original: DatosFichaV3, nuevo: DatosFichaV3): DatosFichaV3 {
  const campos = Object.fromEntries(Object.entries(nuevo.campos).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original.campos[k])));
  const listas = Object.fromEntries(Object.entries(nuevo.listas).filter(([k, v]) => JSON.stringify([...v].sort()) !== JSON.stringify([...(original.listas[k] ?? [])].sort())));
  return { campos, listas };
}
export const ubicacionesPlanas = (nodos: Ubicacion[], prefijo = ""): (Ubicacion & { etiqueta: string })[] => nodos.flatMap((n) => [{ ...n, etiqueta: `${prefijo}${n.nombre}` }, ...ubicacionesPlanas(n.hijos ?? [], `${prefijo}${n.nombre} › `)]);
