import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { CampoFicha, Pieza } from "../types";

export const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export function useCamposFicha() {
  return useQuery({ queryKey: ["campos-ficha"], queryFn: async () => (await api.get<CampoFicha[]>("/campos-ficha")).data, staleTime: 0 });
}
export function valorCampo(pieza: Pieza, campo: CampoFicha): unknown {
  return campo.almacenamiento === "adicional" ? pieza.camposAdicionales?.[campo.clave] : (pieza as unknown as Record<string, unknown>)[camel(campo.clave)];
}
