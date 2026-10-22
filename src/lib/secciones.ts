// Mapa de navegación (spec de diseño §6). Cada sección se muestra si el usuario tiene AL MENOS UNO de sus
// permisos (F9, RF-52): la autorización nunca depende del nombre del rol. Los nombres amigables del spec
// (Curador, Conservador...) solo se usan como texto de UI (ver ROL_ETIQUETA).

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

/** Nombres amigables del spec de diseño (§0, §5) para mostrar en la UI. */
export const ROL_ETIQUETA: Record<string, string> = {
  Administrador: "Administrador",
  "Gestor de colecciones": "Curador",
  "Catalogador/practicante": "Catalogador",
  Conservación: "Conservador",
  "Consulta interna": "Consulta",
  "Consulta externa": "Consulta externa",
};

export interface Seccion {
  ruta: string;
  nombre: string;
  Icono: ComponentType<LucideProps> | typeof IconoRetablo;
  /** Basta uno. Lista vacía: cualquier usuario con sesión. */
  permisos: string[];
}

/** Permisos que dan acceso a cada pantalla de Administración (ver AdministracionPage). */
export const PERMISOS_ADMINISTRACION = [
  "config.campos.ver", "config.listas", "config.institucion.ver",
  "config.codigos_tenencia",
  "usuarios.ver", "roles.ver", "auditoria.ver",
];

export const SECCIONES: Seccion[] = [
  { ruta: "/", nombre: "Panel principal", Icono: LayoutDashboard, permisos: [] },
  { ruta: "/coleccion", nombre: "Colección", Icono: IconoRetablo, permisos: ["piezas.ver"] },
  {
    ruta: "/ubicacion-y-movimientos",
    nombre: "Ubicación y movimientos",
    Icono: Warehouse,
    permisos: ["movimientos.registrar", "estados.cambiar", "ubicaciones.gestionar"],
  },
  { ruta: "/importacion", nombre: "Importación", Icono: Upload, permisos: ["importacion.ver", "importacion.cargar"] },
  { ruta: "/consultas-y-reportes", nombre: "Consultas y reportes", Icono: Search, permisos: ["reportes.ver"] },
  { ruta: "/asistente-ia", nombre: "Asistente IA", Icono: Bot, permisos: ["ia.usar"] },
  { ruta: "/administracion", nombre: "Administración", Icono: Settings, permisos: PERMISOS_ADMINISTRACION },
];

type PuedeAlguno = (...permisos: string[]) => boolean;

export function seccionesPara(puedeAlguno: PuedeAlguno): Seccion[] {
  return SECCIONES.filter((s) => puedeAlguno(...s.permisos));
}
