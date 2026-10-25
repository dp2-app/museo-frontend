import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Propietario, Regimen, TipoCodigo, UbicacionFisica, ValorLista } from "../types";

/** Catálogos de F1/F6 que usa la ficha (alta y detalle). Cambian poco: se cachean 5 minutos. */
const fresco = 5 * 60 * 1000;

export function useTiposCodigo() {
  return useQuery({ queryKey: ["f2", "tipos-codigo"], staleTime: fresco,
    queryFn: async () => (await api.get<TipoCodigo[]>("/tipos-codigo")).data });
}

export function useRegimenes() {
  return useQuery({ queryKey: ["f2", "regimenes"], staleTime: fresco,
    queryFn: async () => (await api.get<Regimen[]>("/regimenes")).data.filter((r) => r.activo) });
}

export function usePropietarios(habilitado = true) {
  return useQuery({ queryKey: ["f2", "propietarios"], staleTime: fresco, enabled: habilitado,
    queryFn: async () => (await api.get<Propietario[]>("/propietarios")).data });
}

export function useUbicaciones() {
  return useQuery({ queryKey: ["ubicaciones"], staleTime: fresco,
    queryFn: async () => (await api.get<UbicacionFisica[]>("/ubicaciones")).data });
}

export function useValoresLista(clave: string) {
  return useQuery({ queryKey: ["f2", "lista", clave], staleTime: fresco,
    queryFn: async () => (await api.get<ValorLista[]>(`/listas/${clave}/valores`)).data });
}

export function usePersonas(habilitado = true) {
  return useQuery({ queryKey: ["f2", "personas"], staleTime: fresco, enabled: habilitado,
    queryFn: async () => (await api.get<{ id: string; nombreCompleto: string; activo: boolean }[]>("/personas")).data });
}
