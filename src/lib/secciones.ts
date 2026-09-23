// Mapa de navegación (spec de diseño §6, matriz sección×rol) usando los
// nombres de rol REALES del backend (app/core/roles.py) — nunca los nombres
// "amigables" del spec (Curador, Conservador...) como clave de autorización.
// Esos nombres amigables solo se usan como texto de UI (ver ROL_ETIQUETA).

import type { ComponentType } from "react";
import {
  Bot,
  LayoutDashboard,
  Search,
  Settings,
  Upload,
  Warehouse,
  type LucideProps,
} from "lucide-react";
import { IconoRetablo } from "../components/IconoRetablo";

export const ADMINISTRADOR = "Administrador";
export const GESTOR_COLECCIONES = "Gestor de colecciones";
export const CATALOGADOR = "Catalogador/practicante";
export const CONSERVACION = "Conservación";
export const CONSULTA_INTERNA = "Consulta interna";
export const CONSULTA_EXTERNA = "Consulta externa";

/** Nombres amigables del spec de diseño (§0, §5) para mostrar en la UI —
 * la Matriz de Requerimientos usa los nombres técnicos de arriba (ver
 * docs/historias-usuario.md del prototipo: "La Matriz... lo llama..."). */
export const ROL_ETIQUETA: Record<string, string> = {
  [ADMINISTRADOR]: "Administrador",
  [GESTOR_COLECCIONES]: "Curador",
  [CATALOGADOR]: "Catalogador",
  [CONSERVACION]: "Conservador",
  [CONSULTA_INTERNA]: "Consulta",
  [CONSULTA_EXTERNA]: "Consulta externa",
};

export interface Seccion {
  ruta: string;
  nombre: string;
  Icono: ComponentType<LucideProps> | typeof IconoRetablo;
  roles: string[];
}

export const SECCIONES: Seccion[] = [
  {
    ruta: "/",
    nombre: "Panel principal",
    Icono: LayoutDashboard,
    roles: [ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR, CONSERVACION, CONSULTA_INTERNA],
  },
  {
    ruta: "/coleccion",
    nombre: "Colección",
    Icono: IconoRetablo,
    roles: [ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR, CONSULTA_INTERNA],
  },
  {
    ruta: "/ubicacion-y-movimientos",
    nombre: "Ubicación y movimientos",
    Icono: Warehouse,
    roles: [ADMINISTRADOR, CONSERVACION],
  },
  {
    ruta: "/importacion",
    nombre: "Importación",
    Icono: Upload,
    roles: [ADMINISTRADOR, CATALOGADOR],
  },
  {
    ruta: "/consultas-y-reportes",
    nombre: "Consultas y reportes",
    Icono: Search,
    roles: [ADMINISTRADOR, GESTOR_COLECCIONES, CONSULTA_INTERNA],
  },
  {
    ruta: "/asistente-ia",
    nombre: "Asistente IA",
    Icono: Bot,
    roles: [ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR],
  },
  {
    ruta: "/administracion",
    nombre: "Administración",
    Icono: Settings,
    roles: [ADMINISTRADOR],
  },
];

export function seccionesPara(rol: string | null): Seccion[] {
  if (!rol) return [];
  return SECCIONES.filter((s) => s.roles.includes(rol));
}

export function rutaPermitida(ruta: string, rol: string | null): boolean {
  const seccion = SECCIONES.find((s) => s.ruta === ruta);
  if (!seccion) return true; // rutas hijas (p. ej. /coleccion/:id) se validan por su padre
  return rol !== null && seccion.roles.includes(rol);
}
