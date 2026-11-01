import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extraerMensajeError } from "./api";
import { useConsultaF0 } from "../hooks/useConsultaF0";

export const get = async <T,>(ruta: string, params?: Record<string, unknown>): Promise<T> => (await api.get<T>(ruta, { params })).data;
export function useRecurso<T>(key: string, ruta: string, enabled = true, params?: Record<string, unknown>) {
  return useConsultaF0<T>({ queryKey: [key, ruta, params], enabled, queryFn: () => get<T>(ruta, params) });
}
export function useOperacion() {
  const cache = useQueryClient();
  const [mensaje, setMensaje] = useState("");
  const operacion = useMutation({ mutationFn: async (accion: () => Promise<unknown>) => accion(),
    onSuccess: async () => { setMensaje("Operación guardada."); await cache.invalidateQueries(); },
    onError: (e) => setMensaje(e instanceof Error && !("response" in e) ? e.message : extraerMensajeError(e)),
  });
  return { ejecutar: operacion.mutate, pendiente: operacion.isPending, mensaje, setMensaje };
}
