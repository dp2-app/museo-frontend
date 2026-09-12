import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import type { Pieza, ReporteCalidadDatos, SugerenciaIA } from "../types";

const etiquetaTipo: Record<SugerenciaIA["tipo"], string> = {
  "RIA-01-extraccion-observaciones": "RIA-01 · Extracción de observaciones",
  "RIA-02-duplicados-similitud": "RIA-02 · Posible duplicado",
  "RIA-03-categoria-sugerida": "RIA-03 · Categoría sugerida",
  "RIA-04-descripcion-preliminar": "RIA-04 · Descripción preliminar",
  "RIA-05-consulta-catalogo": "RIA-05 · Consulta al catálogo",
};

function TarjetaKpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{etiqueta}</p>
      <p className="font-display text-3xl font-semibold text-ink-800">{valor}</p>
      {detalle && <p className="text-xs text-ink-400 mt-0.5">{detalle}</p>}
    </div>
  );
}

/** Nombre legible de una pieza a partir de su id, para no mostrar solo un UUID
 * en la comparación de posibles duplicados (RIA-02). */
function NombrePieza({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["pieza", id, "nombre"],
    queryFn: async () => (await api.get<Pieza>(`/piezas/${id}`)).data,
    staleTime: 60_000,
  });
  return (
    <Link to={`/piezas/${id}`} className="text-clay-700 hover:underline font-medium">
      {data?.denominacion || "(cargando...)"}
    </Link>
  );
}

export function IASugerenciasPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: reporte } = useQuery({
    queryKey: ["calidad-datos"],
    queryFn: async () => (await api.get<ReporteCalidadDatos>("/reportes/calidad-datos")).data,
  });

  const { data: sugerencias, isLoading } = useQuery({
    queryKey: ["sugerencias-ia"],
    queryFn: async () => (await api.get<SugerenciaIA[]>("/ia/sugerencias", { params: { estado: "pendiente" } })).data,
  });

  const invalidarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ["sugerencias-ia"] });
    queryClient.invalidateQueries({ queryKey: ["calidad-datos"] });
  };

  const detectarDuplicados = useMutation({
    mutationFn: async () => (await api.post("/ia/deteccion-duplicados")).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const extraerEnLote = useMutation({
    mutationFn: async () => (await api.post("/ia/extraccion-observaciones/lote")).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const resolver = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: "aceptado" | "rechazado" }) =>
      (await api.patch(`/ia/sugerencias/${id}`, { estado })).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-800">Asistente de Calidad de Datos</h2>
        <p className="text-sm text-ink-400 max-w-2xl">
          Un solo lugar para ver qué tan completo está el catálogo y ejecutar RIA-01/RIA-02 sobre él. RN-009: ninguna
          sugerencia se aplica sin que un usuario de catalogación la acepte explícitamente.
        </p>
      </div>

      {reporte && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TarjetaKpi etiqueta="Catálogo completo" valor={`${reporte.porcentajeCompleto}%`} detalle={`${reporte.piezasCompletas}/${reporte.totalPiezas} piezas`} />
          <TarjetaKpi etiqueta="Piezas incompletas" valor={String(reporte.piezasIncompletas)} detalle="RF-035 · falta código I, foto o ubicación" />
          <TarjetaKpi etiqueta="Duplicados por revisar" valor={String(reporte.sugerenciasPendientes.ria02)} detalle="RIA-02 · cola pendiente" />
          <TarjetaKpi
            etiqueta="Observaciones por analizar"
            valor={String(reporte.sugerenciasPendientes.ria01)}
            detalle={`RIA-01 · ${reporte.piezasElegiblesParaRia01} piezas elegibles`}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-start">
        <button onClick={() => detectarDuplicados.mutate()} disabled={detectarDuplicados.isPending} className="btn-primary">
          {detectarDuplicados.isPending ? "Analizando..." : "Ejecutar detección de duplicados (RIA-02)"}
        </button>
        <div>
          <button
            onClick={() => extraerEnLote.mutate()}
            disabled={extraerEnLote.isPending || reporte?.ria01Configurado === false}
            className="btn-primary"
          >
            {extraerEnLote.isPending ? "Analizando..." : "Extraer observaciones en lote (RIA-01)"}
          </button>
          {reporte?.ria01Configurado === false && (
            <p className="text-xs text-ink-400 mt-1.5">
              RIA-01 no está configurado (falta GEMMA_API_KEY/GEMMA_API_URL en el backend).
            </p>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-clay-700">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-400">Cargando cola de revisión...</p>
      ) : (
        <ul className="space-y-3">
          {sugerencias?.map((s) => (
            <li key={s.id} className="glass-panel-sm p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="chip mb-1.5">{etiquetaTipo[s.tipo]}</p>
                {s.tipo === "RIA-02-duplicados-similitud" && s.piezaId && s.piezaRelacionadaId ? (
                  <p className="text-sm text-ink-600">
                    <NombrePieza id={s.piezaId} /> <span className="text-clay-400">⟷</span>{" "}
                    <NombrePieza id={s.piezaRelacionadaId} />
                    {s.confianza !== null && (
                      <span className="text-xs text-ink-400"> · similitud {(s.confianza * 100).toFixed(0)}%</span>
                    )}
                  </p>
                ) : (
                  <>
                    {s.piezaId && (
                      <p className="text-sm text-ink-600">
                        Pieza: <NombrePieza id={s.piezaId} />
                      </p>
                    )}
                    <p className="text-xs text-ink-400 mt-0.5">Modelo: {s.modeloUsado}</p>
                    <pre className="text-xs text-ink-600 bg-white/50 rounded-xl p-2.5 mt-2 max-w-xl overflow-x-auto border border-white/60">
                      {JSON.stringify(s.payloadSugerido, null, 2)}
                    </pre>
                  </>
                )}
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => resolver.mutate({ id: s.id, estado: "aceptado" })} className="text-emerald-700 hover:underline text-sm font-medium">
                  Aceptar
                </button>
                <button onClick={() => resolver.mutate({ id: s.id, estado: "rechazado" })} className="text-clay-700 hover:underline text-sm font-medium">
                  Rechazar
                </button>
              </div>
            </li>
          ))}
          {sugerencias?.length === 0 && <li className="text-sm text-ink-400">No hay sugerencias pendientes de revisión.</li>}
        </ul>
      )}
    </div>
  );
}
