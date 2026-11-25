import type { UbicacionFisica } from "../types";

export interface UbicacionPlana {
  id: string;
  nombre: string;
  nivelTipo: UbicacionFisica["nivelTipo"];
  etiqueta: string;
}

export function aplanarUbicaciones(nodos: UbicacionFisica[], nivel = 0): UbicacionPlana[] {
  return nodos.flatMap((n) => [
    { id: n.id, nombre: n.nombre, nivelTipo: n.nivelTipo, etiqueta: `${"— ".repeat(nivel)}${n.nombre}` },
    ...aplanarUbicaciones(n.hijos ?? [], nivel + 1),
  ]);
}

/** Ruta legible de una sede o ubicación, conservando los identificadores del catálogo. */
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

export interface DatosUbicacion {
  nivelTipo: "sede" | "ubicacion";
  parentId: string | null;
  nombre: string;
  codigo: string;
  direccion: string;
}

/** La sede raíz no tiene padre. Todo dato que se solicita en el editor es obligatorio. */
export function validarUbicacion(datos: DatosUbicacion): Partial<Record<keyof DatosUbicacion, string>> {
  return {
    ...(!datos.nombre.trim() && { nombre: "Escribe el nombre de la sede o ubicación." }),
    ...(!datos.codigo.trim() && { codigo: "Escribe el código de la ubicación." }),
    ...(!datos.direccion.trim() && { direccion: "Completa la dirección de la ubicación." }),
    ...(datos.nivelTipo === "ubicacion" && !datos.parentId && { parentId: "Selecciona la sede a la que pertenece." }),
  };
}

export function normalizarUbicacion(datos: DatosUbicacion): DatosUbicacion {
  return { ...datos, parentId: datos.nivelTipo === "sede" ? null : datos.parentId, nombre: datos.nombre.trim(), codigo: datos.codigo.trim(), direccion: datos.direccion.trim() };
}
