import { datosApi } from "./api";
import type { CargaExcel, DeteccionExcel, FilaImportacion, FilaImportacionPagina } from "../types";

export const ESTADOS_CARGA: Record<CargaExcel["estado"], string> = {
  en_revision: "En revisión", pendiente_aprobacion: "Pendiente de aprobación", aprobada: "Aprobada",
  rechazada: "Rechazada", cancelada: "Cancelada",
};
export const CLASIFICACIONES: Record<FilaImportacion["clasificacion"], string> = {
  nuevo: "Nuevo", actualizacion: "Actualización", duplicado: "Posible duplicado", conflicto: "Conflicto",
};

export function formularioExcel(archivo: File, hoja?: string | null, plantillaMapeoId?: string | null) {
  const form = new FormData();
  form.append("archivo", archivo);
  if (hoja) form.append("hoja", hoja);
  if (plantillaMapeoId) form.append("plantillaMapeoId", plantillaMapeoId);
  return form;
}

export function validarArchivoExcel(archivo: File): string | null {
  if (!/\.xlsx$/i.test(archivo.name)) return "Guarda el archivo como Excel .xlsx, sin contraseña.";
  if (!archivo.size) return "El archivo está vacío.";
  if (archivo.size > 25 * 1024 * 1024) return "El archivo supera el máximo de 25 MB.";
  return null;
}

export async function detectarExcel(archivo: File, hoja?: string) {
  return (await datosApi.post<DeteccionExcel>("/importacion/columnas", formularioExcel(archivo, hoja))).data;
}

export async function subirExcel(archivo: File, hoja: string | null, plantillaMapeoId: string | null) {
  return (await datosApi.post<CargaExcel>("/importacion/cargas", formularioExcel(archivo, hoja, plantillaMapeoId))).data;
}

export function valorLegible(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "Sin dato";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (Array.isArray(valor)) return valor.map(valorLegible).join(", ");
  if (typeof valor === "object") return Object.entries(valor).map(([k, v]) => `${k}: ${valorLegible(v)}`).join("; ");
  return String(valor);
}

export interface SeleccionRevision {
  nuevas: string[]; actualizaciones: string[]; duplicados: string[]; excluidas: number;
}

/** Reúne solo identificadores; nunca aprueba ni aplica datos por el hecho de navegar páginas. */
export async function prepararRevision(cargaId: string): Promise<SeleccionRevision> {
  const seleccion: SeleccionRevision = { nuevas: [], actualizaciones: [], duplicados: [], excluidas: 0 };
  let pagina = 1, leidas = 0, total = 0;
  do {
    const { data } = await datosApi.get<FilaImportacionPagina>(`/importacion/cargas/${cargaId}/filas`, {
      params: { estado: "pendiente", pagina, tamano: 500 },
    });
    total = data.total;
    for (const fila of data.items) {
      if (fila.errores.length || fila.clasificacion === "conflicto" ||
          fila.candidatos.some((c) => c.regla === "identificador_repetido_en_lote")) {
        seleccion.excluidas++;
      } else if (fila.clasificacion === "nuevo") seleccion.nuevas.push(fila.id);
      else if (fila.clasificacion === "actualizacion") seleccion.actualizaciones.push(fila.id);
      else seleccion.duplicados.push(fila.id);
    }
    leidas += data.items.length;
    if (!data.items.length && leidas < total) throw new Error("Las filas cambiaron durante la revisión. Vuelve a preparar la selección.");
    pagina++;
  } while (leidas < total);
  return seleccion;
}
