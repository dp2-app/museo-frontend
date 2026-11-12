import type { DatosFichaV3, EstadoFicha } from "../types";
import type { Codigo, Tenencia } from "../types/f1";

export interface Archivo { id: string; url: string; titulo?: string; descripcion?: string; fechaDocumento?: string; restringidoUso: boolean; esPrincipal?: boolean; tipoVistaId?: string; fotografoId?: string; fechaFotografia?: string; orden?: number; }

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
/** `GET /piezas/{id}/ficha-completa` (RF-44): la ficha con todo lo que muestra la pantalla de detalle, en una sola llamada. */
export interface HistorialFicha {
  id: string; fecha: string; motivo: string | null; responsable?: string | null;
  ubicacionAnterior?: string | null; ubicacionNueva?: string | null; estadoAnterior?: string | null; estadoNuevo?: string | null;
}
export interface FichaCompleta extends Ficha {
  codigosDetalle: Codigo[];
  tenencias: Tenencia[];
  fotografias: Archivo[];
  documentos: Archivo[];
  movimientos: HistorialFicha[];
  estados: HistorialFicha[];
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
/** frontend#61 P8: «1 pieza», «2 piezas» (no «1 piezas»). */
export const piezas = (n: number) => `${n.toLocaleString("es-PE")} ${n === 1 ? "pieza" : "piezas"}`;
export const ubicacionesPlanas = (nodos: Ubicacion[], prefijo = ""): (Ubicacion & { etiqueta: string })[] => nodos.flatMap((n) => [{ ...n, etiqueta: `${prefijo}${n.nombre}` }, ...ubicacionesPlanas(n.hijos ?? [], `${prefijo}${n.nombre} › `)]);
