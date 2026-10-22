import { useConsultaF0 } from "./useConsultaF0";
import { api } from "../lib/api";
import type { Propietario, Regimen, TipoCodigo } from "../types/f1";

/** Catálogos de F1. Comparten la caché por cuenta de F0 (`useConsultaF0`) y la clave `["f1", …]`. */
export function useTiposCodigo(incluirInactivos = false) {
  return useConsultaF0({
    queryKey: ["f1", "tipos-codigo", incluirInactivos],
    queryFn: async () => (await api.get<TipoCodigo[]>("/tipos-codigo", { params: { incluirInactivos } })).data,
  });
}

export function useRegimenes() {
  return useConsultaF0({ queryKey: ["f1", "regimenes"], queryFn: async () => (await api.get<Regimen[]>("/regimenes")).data });
}

/** Propietarios y contrapartes: datos personales, exigen `propietarios.ver` (RN-06, Ley 29733). */
export function usePropietarios(habilitado: boolean) {
  return useConsultaF0({
    queryKey: ["f1", "propietarios"],
    enabled: habilitado,
    queryFn: async () => (await api.get<Propietario[]>("/propietarios")).data,
  });
}
