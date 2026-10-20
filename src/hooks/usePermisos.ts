import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { api, TOKEN_STORAGE_KEY } from "../lib/api";
import type { SesionV3 } from "../types";

/** Adaptador F0/F9. El servidor es la autoridad; no se extraen permisos del JWT. */
export function usePermisos() {
  const { isAuthenticated, usuarioId, rol: rolLegado } = useAuth();
  const firmaSesion = localStorage.getItem(TOKEN_STORAGE_KEY)?.slice(-12) ?? "";
  const consulta = useQuery({
    queryKey: ["sesion-v3", usuarioId, firmaSesion],
    enabled: isAuthenticated,
    queryFn: async () => (await api.get<SesionV3>("/auth/sesion")).data,
    staleTime: 0,
    retry: false,
  });
  const sesion = isAuthenticated ? consulta.data : undefined;
  return {
    ...consulta, sesion,
    rol: sesion?.usuario.rol.nombre ?? rolLegado ?? null,
    puede: (permiso: string) => Boolean(sesion?.permisos.includes(permiso)),
  };
}
