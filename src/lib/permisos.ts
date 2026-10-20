// F9 · Permisos por funcionalidad (RF-52). La autorización real siempre la valida el backend;
// esto solo arma la pantalla de roles y mantiene coherentes las combinaciones (editar exige ver).
//
// Cada funcionalidad se muestra con un desplegable de nivel de acceso (sin acceso / solo ver / ver y editar).
// Las acciones que no son ver ni editar (aprobar, exportar, dar de baja…) quedan como «acciones adicionales».

import type { Permiso } from "../types";

export const ETIQUETA_MODULO: Record<string, string> = {
  piezas: "Fichas de piezas",
  identificadores: "Códigos y tenencia",
  ubicacion: "Ubicación y estado",
  importacion: "Importación de Excel",
  ia: "Asistente de IA",
  reportes: "Reportes y exportación",
  configuracion: "Configuración",
  acceso: "Usuarios y seguridad",
};

export const ETIQUETA_RECURSO: Record<string, string> = {
  piezas: "Fichas",
  fotos: "Fotografías",
  documentos: "Documentos",
  colecciones: "Colecciones y subcolecciones",
  codigos: "Códigos del museo",
  tenencias: "Tenencias y préstamos",
  propietarios: "Propietarios y contrapartes",
  ubicaciones: "Árbol de ubicaciones",
  movimientos: "Movimientos de ubicación",
  estados: "Estado de la pieza",
  importacion: "Cargas de Excel",
  plantillas: "Plantillas y equivalencias",
  procedencia: "Procedencia de los datos",
  ia: "Sugerencias de IA",
  reportes: "Reportes",
  campos: "Campos de la ficha",
  listas: "Listas de valores",
  tipos_codigo: "Tipos de código y regímenes",
  visibilidad: "Campos visibles por rol",
  institucion: "Institución y parámetros",
  usuarios: "Usuarios",
  roles: "Roles y permisos",
  auditoria: "Bitácora de auditoría",
};

/** Nombre corto de las acciones adicionales (todo lo que no es ver, crear ni editar). */
export const ETIQUETA_PERMISO: Record<string, string> = {
  "piezas.aprobar_ficha": "Aprobar o rechazar fichas",
  "piezas.ver_no_aprobadas": "Ver fichas no aprobadas",
  "piezas.baja": "Dar de baja",
  "piezas.restaurar": "Restaurar y ver dadas de baja",
  "codigos.corregir_inmutable": "Corregir código inmutable",
  "importacion.aprobar": "Aprobar cargas",
  "importacion.rechazar": "Rechazar cargas",
  "ia.ejecutar_lote": "Ejecutar en lote",
  "ia.fusionar": "Fusionar duplicados",
  "reportes.exportar": "Exportar búsquedas y reportes",
  "reportes.exportar_total": "Exportar todo el catálogo",
};

/** Catálogos de apoyo a los formularios: los ve cualquier usuario con sesión, no tienen permiso «ver». */
export const LECTURA_ABIERTA = new Set(["colecciones", "listas", "tipos_codigo", "ubicaciones"]);

export type Nivel = "sin" | "ver" | "editar";
/** `personalizado`: combinación que ninguna opción del desplegable representa (p. ej. crear sin editar). */
export type NivelActual = Nivel | "personalizado";

export interface FilaMatriz {
  recurso: string;
  etiqueta: string;
  /** Permisos de lectura propios de la funcionalidad. Vacío: no hay permiso «ver» (ver es abierto o va con la ficha). */
  ver: Permiso[];
  /** Crear y editar: el nivel «Ver y editar» los marca todos. */
  modificar: Permiso[];
  /** Aprobar, exportar y las demás: se marcan una a una. */
  adicionales: Permiso[];
  lecturaAbierta: boolean;
  /** Otras funcionalidades que esta necesita (p. ej. editar fotografías necesita ver fichas). */
  necesita: string[];
}

export interface ModuloMatriz {
  modulo: string;
  etiqueta: string;
  filas: FilaMatriz[];
}

/** Agrupa el catálogo por módulo y funcionalidad respetando el orden del servidor. */
export function armarMatriz(permisos: Permiso[]): ModuloMatriz[] {
  const modulos = new Map<string, ModuloMatriz>();
  const porClave = new Map(permisos.map((p) => [p.clave, p]));
  for (const permiso of [...permisos].sort((a, b) => a.orden - b.orden)) {
    let modulo = modulos.get(permiso.modulo);
    if (!modulo) {
      modulo = { modulo: permiso.modulo, etiqueta: ETIQUETA_MODULO[permiso.modulo] ?? permiso.modulo, filas: [] };
      modulos.set(permiso.modulo, modulo);
    }
    let fila = modulo.filas.find((f) => f.recurso === permiso.recurso);
    if (!fila) {
      fila = {
        recurso: permiso.recurso, etiqueta: ETIQUETA_RECURSO[permiso.recurso] ?? permiso.recurso,
        ver: [], modificar: [], adicionales: [], lecturaAbierta: LECTURA_ABIERTA.has(permiso.recurso), necesita: [],
      };
      modulo.filas.push(fila);
    }
    if (permiso.accion === "ver") fila.ver.push(permiso);
    else if (permiso.accion === "crear" || permiso.accion === "editar") fila.modificar.push(permiso);
    else fila.adicionales.push(permiso);

    const previo = permiso.requiere ? porClave.get(permiso.requiere) : undefined;
    if (previo && previo.recurso !== permiso.recurso) {
      const nombre = ETIQUETA_RECURSO[previo.recurso] ?? previo.recurso;
      if (!fila.necesita.includes(nombre)) fila.necesita.push(nombre);
    }
  }
  return [...modulos.values()];
}

export function etiquetaPermiso(p: Permiso): string {
  return ETIQUETA_PERMISO[p.clave] ?? p.descripcion ?? p.clave;
}

/** Opciones del desplegable de una funcionalidad. Sin permiso «ver» propio no hay «solo ver»: se distingue editar de no editar. */
export function opcionesNivel(fila: FilaMatriz): { valor: Nivel; etiqueta: string }[] {
  const conEdicion = fila.modificar.length > 0;
  if (fila.ver.length === 0) {
    return [{ valor: "sin", etiqueta: "Sin edición" }, { valor: "editar", etiqueta: "Puede editar" }];
  }
  return [
    { valor: "sin", etiqueta: "Sin acceso" },
    { valor: "ver", etiqueta: "Solo ver" },
    ...(conEdicion ? [{ valor: "editar" as const, etiqueta: "Ver y editar" }] : []),
  ];
}

/** Nivel de acceso que representa la selección actual en esa funcionalidad. */
export function nivelDe(fila: FilaMatriz, seleccion: ReadonlySet<string>): NivelActual {
  const marcado = (p: Permiso) => seleccion.has(p.clave);
  const hayVer = fila.ver.some(marcado);
  const hayModificar = fila.modificar.some(marcado);
  if (!hayVer && !hayModificar) return "sin";
  if (!hayModificar) return "ver";
  const completo = fila.modificar.every(marcado) && fila.ver.every(marcado);
  return completo ? "editar" : "personalizado";
}

/** Permisos que hay que tener antes que `clave`, en cadena (editar → ver). */
export function prerrequisitos(permisos: Permiso[], clave: string): string[] {
  const porClave = new Map(permisos.map((p) => [p.clave, p]));
  const resultado: string[] = [];
  let actual = porClave.get(clave)?.requiere ?? null;
  while (actual && !resultado.includes(actual)) {
    resultado.push(actual);
    actual = porClave.get(actual)?.requiere ?? null;
  }
  return resultado;
}

/** Permisos que dejan de tener sentido si se quita `clave`, en cadena. */
export function dependientes(permisos: Permiso[], clave: string): string[] {
  const resultado = new Set<string>();
  const pendientes = [clave];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    for (const p of permisos) {
      if (p.requiere === actual && !resultado.has(p.clave)) {
        resultado.add(p.clave);
        pendientes.push(p.clave);
      }
    }
  }
  return [...resultado];
}

/** Marca o desmarca un permiso conservando la coherencia: marcar agrega sus prerrequisitos; desmarcar quita sus dependientes. */
export function alternar(permisos: Permiso[], seleccion: ReadonlySet<string>, clave: string, activar: boolean): Set<string> {
  const siguiente = new Set(seleccion);
  if (activar) {
    siguiente.add(clave);
    prerrequisitos(permisos, clave).forEach((c) => siguiente.add(c));
  } else {
    siguiente.delete(clave);
    dependientes(permisos, clave).forEach((c) => siguiente.delete(c));
  }
  return siguiente;
}

/** Aplica un nivel de acceso a una funcionalidad. Quitar el acceso quita también lo que depende de él, incluso en otras funcionalidades. */
export function aplicarNivel(permisos: Permiso[], fila: FilaMatriz, seleccion: ReadonlySet<string>, nivel: Nivel): Set<string> {
  let siguiente = new Set(seleccion);
  const poner = (ps: Permiso[]) => ps.forEach((p) => { siguiente = alternar(permisos, siguiente, p.clave, true); });
  const quitar = (ps: Permiso[]) => ps.forEach((p) => { siguiente = alternar(permisos, siguiente, p.clave, false); });
  if (nivel === "sin") { quitar(fila.ver); quitar(fila.modificar); }
  else if (nivel === "ver") { poner(fila.ver); quitar(fila.modificar); }
  else { poner(fila.ver); poner(fila.modificar); }
  return siguiente;
}

/** Funcionalidades (distintas de `recurso`) cuyos permisos cambiaron entre dos selecciones: para avisar de los efectos en cadena. */
export function efectosEnOtras(permisos: Permiso[], antes: ReadonlySet<string>, despues: ReadonlySet<string>, recurso: string) {
  const activadas = new Set<string>();
  const quitadas = new Set<string>();
  for (const p of permisos) {
    if (p.recurso === recurso || antes.has(p.clave) === despues.has(p.clave)) continue;
    (despues.has(p.clave) ? activadas : quitadas).add(ETIQUETA_RECURSO[p.recurso] ?? p.recurso);
  }
  return { activadas: [...activadas], quitadas: [...quitadas] };
}

export function mismoConjunto(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((c) => b.has(c));
}
