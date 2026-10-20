import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { api, TOKEN_STORAGE_KEY } from "../lib/api";
import type { SesionV3 } from "../types";

/** Sesión del servidor: es la autoridad de permisos y de campos ocultos; no se extraen del JWT.
 * `rol` es solo el nombre para mostrar: la autorización siempre es por permiso (RNF-08). */
export function usePermisos() {
  const { isAuthenticated, usuarioId } = useAuth();
  const firmaSesion = localStorage.getItem(TOKEN_STORAGE_KEY)?.slice(-12) ?? "";
  const consulta = useQuery({
    queryKey: ["sesion-v3", usuarioId, firmaSesion],
    enabled: isAuthenticated,
    queryFn: async () => (await api.get<SesionV3>("/auth/sesion")).data,
    staleTime: 0,
    retry: false,
  });
  const sesion = isAuthenticated ? consulta.data : undefined;
  const permisos = new Set(sesion?.permisos ?? []);
  return {
    ...consulta, sesion,
    rol: sesion?.usuario.rol.nombre ?? null,
    puede: (permiso: string) => permisos.has(permiso),
    /** Basta uno de los permisos. Lista vacía: cualquier usuario con sesión. */
    puedeAlguno: (...lista: string[]) => lista.length === 0 || lista.some((p) => permisos.has(p)),
  };
}
