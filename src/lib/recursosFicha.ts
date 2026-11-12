import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extraerMensajeError } from "./api";
import { useConsultaF0 } from "../hooks/useConsultaF0";

export const get = async <T,>(ruta: string, params?: Record<string, unknown>): Promise<T> => (await api.get<T>(ruta, { params })).data;
/** `inicial`: datos que la pantalla ya tiene (p. ej. de `ficha-completa`); se usan sin volver a pedirlos hasta que algo los invalide. */
export function useRecurso<T>(key: string, ruta: string, enabled = true, params?: Record<string, unknown>, inicial?: T) {
  return useConsultaF0<T>({ queryKey: [key, ruta, params], enabled, queryFn: () => get<T>(ruta, params),
    ...(inicial !== undefined ? { initialData: inicial, staleTime: 5 * 60_000 } : {}) });
}
export function useOperacion() {
  const cache = useQueryClient();
  const [mensaje, setMensaje] = useState("");
  const operacion = useMutation({ mutationFn: async (accion: () => Promise<unknown>) => accion(),
    // Si la acción devuelve un texto, ese es el aviso (p. ej. el I asignado al aprobar, museo-backend#170).
    onSuccess: async (r) => { setMensaje(typeof r === "string" ? r : "Operación guardada."); await cache.invalidateQueries(); },
    onError: (e) => setMensaje(e instanceof Error && !("response" in e) ? e.message : extraerMensajeError(e)),
  });
  return { ejecutar: operacion.mutate, pendiente: operacion.isPending, mensaje, setMensaje };
}
