// Mapa de navegación (spec de diseño §6). Cada sección se muestra si el usuario tiene AL MENOS UNO de sus
// permisos (F9, RF-52): la autorización nunca depende del nombre del rol. El nombre que se muestra
// siempre viene de la sesión; no se mantiene un segundo catálogo de alias en el frontend.

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
  "config.codigos_tenencia", "propietarios.ver",
  "usuarios.ver", "roles.ver", "auditoria.ver",
  "piezas.restaurar",
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
  // «Preguntar» (RIA-06) basta con piezas.ver; las demás pestañas del asistente piden ia.usar.
  { ruta: "/asistente-ia", nombre: "Asistente IA", Icono: Bot, permisos: ["ia.usar", "piezas.ver"] },
  { ruta: "/administracion", nombre: "Administración", Icono: Settings, permisos: PERMISOS_ADMINISTRACION },
];

type PuedeAlguno = (...permisos: string[]) => boolean;

export function seccionesPara(puedeAlguno: PuedeAlguno): Seccion[] {
  return SECCIONES.filter((s) => puedeAlguno(...s.permisos));
}
