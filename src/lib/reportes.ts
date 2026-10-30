import { datosApi } from "./api";

// F8 · Contrato de GET /api/v1/reportes/* (museo-backend#59). Todos aceptan los filtros de GET /piezas (F7)
// y devuelven lo que aplicaron de verdad: quien no ve fichas sin aprobar recibe `estadoFicha: "aprobada"`.

export interface FiltrosConsulta {
  q?: string; codigo?: string; coleccionId?: string; ubicacionId?: string; estadoConservacionId?: string;
  estadoPiezaId?: string; materialId?: string; autor?: string; epoca?: string; estadoFicha?: string; soloIncompletas?: boolean;
}

export interface EncabezadoReporte {
  institucion: { nombre: string | null; logoUrl: string | null; direccion: string | null };
  titulo: string; generadoEn: string; filtros: Record<string, string | boolean>;
}
export interface ReporteInventario extends EncabezadoReporte {
  total: number;
  piezas: { id: string; denominacion: string | null; codigoPrincipal: string | null; coleccion: string | null; incompleta: boolean }[];
}
export interface GrupoReporte { valorId: string | null; valor: string; total: number }
export interface ReportePorEstado extends EncabezadoReporte { total: number; porEstadoPieza: GrupoReporte[]; porEstadoConservacion: GrupoReporte[] }
export interface ReporteUbicacion extends EncabezadoReporte {
  total: number; porUbicacion: { ubicacionId: string; ubicacion: string; total: number }[]; sinUbicacion: number;
}
export interface ReporteIncompletos extends EncabezadoReporte {
  totalPiezas: number; piezasIncompletas: number; porcentajeIncompleto: number;
  porColeccion: { coleccionId: string | null; coleccion: string; totalPiezas: number; piezasIncompletas: number; porcentajeCompleto: number }[];
  detalle: { piezaId: string; denominacion: string | null; camposFaltantes: string[] }[];
}

export type ClaveReporte = "inventario" | "por-estado" | "por-ubicacion" | "informacion-incompleta";

/** Campo de la ficha que protege cada filtro: si el rol no lo ve, el backend rechaza el filtro (403). */
export const CAMPO_DE_FILTRO: Partial<Record<keyof FiltrosConsulta, string>> = {
  coleccionId: "coleccion_id", ubicacionId: "ubicacion_actual_id", estadoConservacionId: "estado_conservacion_id",
  estadoPiezaId: "estado_pieza_id", materialId: "materiales", autor: "autor", epoca: "epoca_texto",
};

export const ETIQUETA_FILTRO: Record<string, string> = {
  q: "Texto", codigo: "Código", coleccionId: "Colección", ubicacionId: "Ubicación", estadoConservacionId: "Estado de conservación",
  estadoPiezaId: "Estado de la pieza", materialId: "Material", autor: "Autor", epoca: "Época", estadoFicha: "Estado de ficha",
  soloIncompletas: "Solo incompletas",
};

/** Solo los filtros con valor, para no mandar parámetros vacíos. */
export function parametros(filtros: FiltrosConsulta): Record<string, string | boolean> {
  return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== false));
}

/** Descarga un .xlsx de la API de datos. Si falla, el error JSON llega como Blob: se convierte para mostrar su mensaje. */
export async function descargarExcel(ruta: string, params: Record<string, unknown>, nombre: string): Promise<number> {
  try {
    const respuesta = await datosApi.get<Blob>(ruta, { params, responseType: "blob" });
    const url = URL.createObjectURL(respuesta.data);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    return Number(respuesta.headers["x-total-filas"] ?? 0);
  } catch (error) {
    const datos = (error as { response?: { data?: unknown } }).response?.data;
    if (datos instanceof Blob) {
      try { (error as { response: { data: unknown } }).response.data = JSON.parse(await datos.text()); } catch { /* se muestra el genérico */ }
    }
    throw error;
  }
}

/** Total de piezas del reporte: el de incompletos lo llama `totalPiezas`. */
export function totalDe(clave: ClaveReporte, datos: unknown): number {
  return clave === "informacion-incompleta" ? (datos as ReporteIncompletos).totalPiezas : (datos as { total: number }).total;
}
