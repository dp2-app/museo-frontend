import type { UbicacionFisica } from "../types";

export interface UbicacionPlana {
  id: string;
  nombre: string;
  nivelTipo: UbicacionFisica["nivelTipo"];
  etiqueta: string; // con sangría, para <select>
}

export function aplanarUbicaciones(nodos: UbicacionFisica[], nivel = 0): UbicacionPlana[] {
  return nodos.flatMap((n) => [
    { id: n.id, nombre: n.nombre, nivelTipo: n.nivelTipo, etiqueta: `${"— ".repeat(nivel)}${n.nombre}` },
    ...aplanarUbicaciones(n.hijos ?? [], nivel + 1),
  ]);
}

/** Breadcrumb sede › espacio › mueble › nivel › contenedor (spec §7) hasta el
 * nodo indicado, recorriendo el árbol jerárquico devuelto por GET /ubicaciones. */
export function rutaUbicacion(id: string | null, arbol: UbicacionFisica[]): string[] {
  if (!id) return [];
  function buscar(nodos: UbicacionFisica[], camino: string[]): string[] | null {
    for (const nodo of nodos) {
      const siguienteCamino = [...camino, nodo.nombre];
      if (nodo.id === id) return siguienteCamino;
      const enHijos = buscar(nodo.hijos ?? [], siguienteCamino);
      if (enHijos) return enHijos;
    }
    return null;
  }
  return buscar(arbol, []) ?? [];
}
