import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extraerMensajeError } from "../lib/api";
import type { SugerenciaIA } from "../types";

export function IASugerenciasPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: sugerencias, isLoading } = useQuery({
    queryKey: ["sugerencias-ia"],
    queryFn: async () => (await api.get<SugerenciaIA[]>("/ia/sugerencias", { params: { estado: "pendiente" } })).data,
  });

  const detectarDuplicados = useMutation({
    mutationFn: async () => (await api.post("/ia/deteccion-duplicados")).data,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sugerencias-ia"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const resolver = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: "aceptado" | "rechazado" }) =>
      (await api.patch(`/ia/sugerencias/${id}`, { estado })).data,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sugerencias-ia"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const etiquetaTipo: Record<SugerenciaIA["tipo"], string> = {
    "RIA-01-extraccion-observaciones": "RIA-01 · Extracción de observaciones",
    "RIA-02-duplicados-similitud": "RIA-02 · Posible duplicado",
    "RIA-03-categoria-sugerida": "RIA-03 · Categoría sugerida",
    "RIA-04-descripcion-preliminar": "RIA-04 · Descripción preliminar",
    "RIA-05-consulta-catalogo": "RIA-05 · Consulta al catálogo",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Sugerencias de IA — cola de revisión</h2>
        <p className="text-sm text-stone-500">
          RN-009: ninguna sugerencia se aplica al catálogo sin que un usuario de catalogación la acepte explícitamente.
        </p>
      </div>

      <button
        onClick={() => detectarDuplicados.mutate()}
        disabled={detectarDuplicados.isPending}
        className="bg-stone-900 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
      >
        {detectarDuplicados.isPending ? "Analizando..." : "Ejecutar detección de duplicados (RIA-02)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-stone-500">Cargando cola de revisión...</p>
      ) : (
        <ul className="space-y-3">
          {sugerencias?.map((s) => (
            <li key={s.id} className="bg-white border border-stone-200 rounded-lg p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-stone-900">{etiquetaTipo[s.tipo]}</p>
                <p className="text-xs text-stone-500">Modelo: {s.modeloUsado}{s.confianza !== null && ` · confianza ${(s.confianza * 100).toFixed(0)}%`}</p>
                <pre className="text-xs text-stone-600 bg-stone-50 rounded p-2 mt-2 max-w-xl overflow-x-auto">
                  {JSON.stringify(s.payloadSugerido, null, 2)}
                </pre>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => resolver.mutate({ id: s.id, estado: "aceptado" })}
                  className="text-green-700 hover:underline text-sm"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => resolver.mutate({ id: s.id, estado: "rechazado" })}
                  className="text-red-600 hover:underline text-sm"
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
          {sugerencias?.length === 0 && (
            <li className="text-sm text-stone-500">No hay sugerencias pendientes de revisión.</li>
          )}
        </ul>
      )}
    </div>
  );
}
