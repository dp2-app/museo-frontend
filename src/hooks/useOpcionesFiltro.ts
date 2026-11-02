import type { ColeccionFicha } from "../components/Colecciones";
import { ubicacionesPlanas, type Ubicacion } from "../lib/ficha";
import { useRecurso } from "../lib/recursosFicha";
import type { ValorLista } from "../types";

export interface OpcionesFiltro {
  colecciones: ColeccionFicha[]; ubicaciones: (Ubicacion & { etiqueta: string })[];
  estadoConservacion: ValorLista[]; estadoPieza: ValorLista[]; material: ValorLista[];
}

/** Opciones de los filtros: catálogos de apoyo del formulario (solo sesión). Incluye valores inactivos, que pueden estar en piezas antiguas. */
export function useOpcionesFiltro(): OpcionesFiltro {
  const conInactivos = { incluirInactivos: true };
  const estadoConservacion = useRecurso<ValorLista[]>("f8-lista", "/listas/estado_conservacion/valores", true, conInactivos).data ?? [];
  const estadoPieza = useRecurso<ValorLista[]>("f8-lista", "/listas/estado_pieza/valores", true, conInactivos).data ?? [];
  const material = useRecurso<ValorLista[]>("f8-lista", "/listas/material/valores", true, conInactivos).data ?? [];
  const colecciones = useRecurso<ColeccionFicha[]>("colecciones", "/colecciones").data ?? [];
  const ubicaciones = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones").data ?? [];
  return { colecciones, ubicaciones: ubicacionesPlanas(ubicaciones), estadoConservacion, estadoPieza, material };
}

/** Nombre legible de cada id que puede aparecer en los filtros aplicados de un reporte. */
export function nombresDeOpciones(o: OpcionesFiltro): Record<string, string> {
  return Object.fromEntries([
    ...o.colecciones.map((c) => [c.id, c.nombre]), ...o.ubicaciones.map((u) => [u.id, u.etiqueta]),
    ...[...o.estadoConservacion, ...o.estadoPieza, ...o.material].map((v) => [v.id, v.etiqueta]),
  ]);
}
