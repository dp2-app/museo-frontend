import { useEffect, useMemo, useState } from "react";
import { useConsultaF0 } from "./useConsultaF0";
import { api } from "../lib/api";
import { usePermisos } from "./usePermisos";
import type { ValidacionCodigos } from "../types/f1";

/** Valor con un retraso: evita una validación por tecla. Compara por contenido (JSON), no por identidad:
 * quien llama arma un objeto nuevo en cada render y eso redibujaba el formulario cada 400 ms (ASZ-H02, #59). */
function useRetrasado<T>(valor: T, ms = 400) {
  const clave = JSON.stringify(valor);
  const [retrasado, setRetrasado] = useState(clave);
  useEffect(() => { const t = setTimeout(() => setRetrasado(clave), ms); return () => clearTimeout(t); }, [clave, ms]);
  return useMemo(() => JSON.parse(retrasado) as T, [retrasado]);
}

/** F1-D1: valida un código sin guardarlo (`POST /codigos/validar`, modo manual) mientras se escribe.
 * `piezaId` vacío = pieza nueva; `regimenId` vacío = el régimen vigente de la pieza. */
export function useValidarCodigo({ tipoCodigoId, valor, piezaId, regimenId }: { tipoCodigoId: string; valor: string; piezaId?: string | null; regimenId?: string | null }) {
  const puede = usePermisos().puede("codigos.gestionar");
  const consulta = useRetrasado({ tipoCodigoId, valor: valor.trim(), piezaId: piezaId ?? null, regimenId: regimenId ?? null });
  return useConsultaF0({
    queryKey: ["f1", "validar", consulta],
    enabled: puede && Boolean(consulta.tipoCodigoId && consulta.valor),
    staleTime: 0,
    retry: false,
    queryFn: async () => (await api.post<ValidacionCodigos>("/codigos/validar", {
      modo: "manual", piezaId: consulta.piezaId, regimenId: consulta.regimenId,
      codigos: [{ tipoCodigoId: consulta.tipoCodigoId, valor: consulta.valor }],
    })).data.codigos[0],
  });
}

/** F1-D4: sugerencia del siguiente correlativo. Solo sugiere: no rellena huecos ni impide otro número. */
export function useSiguienteCorrelativo(tipoCodigoId: string, habilitado: boolean) {
  return useConsultaF0({
    queryKey: ["f1", "siguiente", tipoCodigoId],
    enabled: habilitado && Boolean(tipoCodigoId),
    staleTime: 0,
    queryFn: async () => (await api.get<{ valor: string | null }>(`/tipos-codigo/${tipoCodigoId}/siguiente`)).data.valor,
  });
}
