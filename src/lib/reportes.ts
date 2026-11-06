import { datosApi, extraerMensajeError } from "./api";

// F8 · Contrato de GET /api/v1/reportes/* (museo-backend#59). Todos aceptan los filtros de GET /piezas (F7)
// y devuelven lo que aplicaron de verdad: quien no ve fichas sin aprobar recibe `estadoFicha: "aprobada"`.

export interface FiltrosConsulta {
  q?: string; codigo?: string; coleccionId?: string; ubicacionId?: string; estadoConservacionId?: string;
  estadoPiezaId?: string; materialId?: string; tipoBienId?: string; clasificacionId?: string; autor?: string; procedencia?: string;
  epoca?: string; estadoFicha?: string; soloIncompletas?: boolean;
  sinFotografia?: boolean; sinUbicacion?: boolean; sinCodigoPrincipal?: boolean;
}

export interface EncabezadoReporte {
  institucion: { nombre: string | null; logoUrl: string | null; direccion: string | null };
  titulo: string; generadoEn: string; filtros: Record<string, string | boolean>;
}
export interface ReporteInventario extends EncabezadoReporte {
  total: number;
  piezas: { id: string; denominacion: string | null; codigoPrincipal: string | null; otrosCodigos: string[]; coleccion: string | null; incompleta: boolean }[];
}
export interface GrupoReporte { valorId: string | null; valor: string; total: number }
export interface ReportePorEstado extends EncabezadoReporte { total: number; porEstadoPieza: GrupoReporte[]; porEstadoConservacion: GrupoReporte[] }
export interface ReporteUbicacion extends EncabezadoReporte {
  total: number; porUbicacion: { ubicacionId: string; ubicacion: string; total: number }[]; sinUbicacion: number;
}
export interface ReporteIncompletos extends EncabezadoReporte {
  totalPiezas: number; piezasIncompletas: number; porcentajeIncompleto: number;
  porFaltante: { campo: string; total: number }[];
  porColeccion: { coleccionId: string | null; coleccion: string; totalPiezas: number; piezasIncompletas: number; porcentajeCompleto: number }[];
  detalle: { piezaId: string; denominacion: string | null; camposFaltantes: string[] }[];
}

/** Un punto de comparación (línea base o hace una semana): solo existe para quien ve todo el catálogo y no usa filtros. */
export interface PuntoHistoria { fecha: string; porcentaje: number }
export interface Indicador {
  clave: string; etiqueta: string; decision: string; tipo: "porcentaje" | "cantidad"; valor: number; total: number; porcentaje: number | null;
  /** Parámetros de GET /piezas que listan las piezas que le faltan a este indicador. */
  filtro: FiltrosConsulta; verPiezas: string;
  lineaBase: PuntoHistoria | null; semanaAnterior: PuntoHistoria | null; detalle: { diasMasAntigua: number | null } | null;
}
export interface IndicadorColeccion {
  coleccionId: string | null; coleccion: string; totalPiezas: number;
  fichasCompletas: number; conFotografia: number; conUbicacion?: number; conCodigoI: number; porcentajes: Record<string, number | null>;
}
export interface ReporteIndicadores extends EncabezadoReporte {
  totalPiezas: number; indicadores: Indicador[]; porColeccion: IndicadorColeccion[];
  historia: { disponible: boolean; motivo: string | null };
}

export type ClaveReporte = "inventario" | "por-estado" | "por-ubicacion" | "informacion-incompleta" | "indicadores";

/** Campo de la ficha que protege cada filtro: si el rol no lo ve, el backend rechaza el filtro (403). */
export const CAMPO_DE_FILTRO: Partial<Record<keyof FiltrosConsulta, string>> = {
  coleccionId: "coleccion_id", ubicacionId: "ubicacion_actual_id", estadoConservacionId: "estado_conservacion_id",
  estadoPiezaId: "estado_pieza_id", materialId: "materiales", tipoBienId: "tipo_bien_id", clasificacionId: "clasificacion_id",
  autor: "autor", procedencia: "procedencia", epoca: "epoca_texto", sinUbicacion: "ubicacion_actual_id",
};

export const ETIQUETA_FILTRO: Record<string, string> = {
  q: "Texto", codigo: "Código", coleccionId: "Colección", ubicacionId: "Ubicación", estadoConservacionId: "Estado de conservación",
  estadoPiezaId: "Estado de la pieza", materialId: "Material", tipoBienId: "Tipo de bien", clasificacionId: "Clasificación",
  autor: "Autor", procedencia: "Procedencia", epoca: "Época", estadoFicha: "Estado de ficha",
  soloIncompletas: "Solo incompletas", sinFotografia: "Sin fotografía", sinUbicacion: "Sin ubicación", sinCodigoPrincipal: "Pendientes de código I",
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
  return clave === "informacion-incompleta" || clave === "indicadores" ? (datos as { totalPiezas: number }).totalPiezas : (datos as { total: number }).total;
}

/** Mensajes de la consulta o de la exportación según lo que pasó (QA F8-01, F8-04, F8-05); los filtros nunca se pierden. */
export function mensajeReporte(error: unknown, generico = "El reporte tardó demasiado. Tus filtros se mantienen. Puedes volver a intentarlo."): string {
  const e = error as { code?: string; response?: { status?: number; headers?: Record<string, string> } };
  const estado = e.response?.status;
  if (estado === 429) {
    const espera = Number(e.response?.headers?.["retry-after"]);
    return `Se alcanzó el límite de solicitudes. Espera${Number.isFinite(espera) && espera > 0 ? ` ${Math.ceil(espera)} s` : ""} antes de reintentar.`;
  }
  if (estado === 503) return "El servicio no está disponible en este momento.";
  if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") return generico;
  return extraerMensajeError(error);
}

/** Piezas que el navegador puede imprimir sin trabarse: con miles de filas el diálogo de impresión se cuelga (QA 5/11). */
export const MAX_FILAS_IMPRESION = 300;

/** Filas de pieza que imprimiría el reporte (los de totales por grupo no crecen con el catálogo). */
export function filasDeImpresion(clave: ClaveReporte, datos: unknown): number {
  if (clave === "inventario") return (datos as ReporteInventario).piezas.length;
  if (clave === "informacion-incompleta") return (datos as ReporteIncompletos).detalle.length;
  return 0;
}
