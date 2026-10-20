import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { TOKEN_STORAGE_KEY } from "../lib/api";

/** La caché F0 no se comparte entre cuentas/sesiones aunque AuthContext siga legado. */
export function useConsultaF0<T>(opciones: UseQueryOptions<T>) {
  const { usuarioId } = useAuth();
  const firma = localStorage.getItem(TOKEN_STORAGE_KEY)?.slice(-12) ?? "";
  return useQuery({ ...opciones, queryKey: [...opciones.queryKey, usuarioId, firma] });
}
