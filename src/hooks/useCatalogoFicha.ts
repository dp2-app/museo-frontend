import { useConsultaF0 as useQuery } from "./useConsultaF0";

import { api } from "../lib/api";
import type { CampoFicha } from "../types";

export function useCatalogoFicha() {
  return useQuery({ queryKey: ["f0", "campos-formulario"], queryFn: async () => (await api.get<CampoFicha[]>("/campos-ficha")).data });
}
