import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import type { CargaExcel, FilaImportacion, FilaImportacionPagina } from "../types";

const etiquetaClasificacion: Record<FilaImportacion["clasificacion"], string> = {
  nuevo: "Nuevo",
  actualizacion: "Actualización",
  duplicado: "Posible duplicado",
  conflicto: "Conflicto",
};

export function CargaDetailPage() {
  const { cargaId } = useParams<{ cargaId: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const cargaQuery = useQuery({
    queryKey: ["carga", cargaId],
    queryFn: async () => (await api.get<CargaExcel>(`/importacion/cargas/${cargaId}`)).data,
  });

  const filasQuery = useQuery({
    queryKey: ["carga-filas", cargaId],
    queryFn: async () =>
      (await api.get<FilaImportacionPagina>(`/importacion/cargas/${cargaId}/filas`, { params: { pageSize: 200 } })).data,
  });

  const invalidarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ["carga", cargaId] });
    queryClient.invalidateQueries({ queryKey: ["carga-filas", cargaId] });
    queryClient.invalidateQueries({ queryKey: ["cargas"] });
  };

  const revisarFila = useMutation({
    mutationFn: async ({ filaId, estado }: { filaId: string; estado: "aprobado" | "rechazado" }) =>
      (await api.patch(`/importacion/cargas/${cargaId}/filas/${filaId}`, { estado })).data,
    onSuccess: invalidarTodo,
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const aprobarCarga = useMutation({
    mutationFn: async () => (await api.post(`/importacion/cargas/${cargaId}/aprobar`)).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const rechazarCarga = useMutation({
    mutationFn: async () => (await api.post(`/importacion/cargas/${cargaId}/rechazar`)).data,
    onSuccess: invalidarTodo,
    onError: (err) => setError(extraerMensajeError(err)),
  });

  if (cargaQuery.isLoading) return <p className="text-sm text-ink-400">Cargando...</p>;
  const carga = cargaQuery.data;
  const filas = filasQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/importacion" className="text-sm text-clay-700 hover:underline">
          ← Volver a importación
        </Link>
        <h2 className="font-display text-2xl font-semibold text-ink-800 mt-1">{carga?.archivoNombre}</h2>
        <span className="chip mt-1">{carga?.estado}</span>
      </div>

      {error && <p className="text-sm text-clay-800 bg-clay-50/80 border border-clay-200 rounded-xl px-3 py-2">{error}</p>}

      {filas && (
        <p className="text-sm text-ink-600">
          Resumen: {filas.resumen.nuevo} nuevas · {filas.resumen.actualizacion} actualizaciones ·{" "}
          {filas.resumen.duplicado} posibles duplicados · {filas.resumen.conflicto} conflictos
        </p>
      )}

      {carga?.estado === "en_revision" && (
        <div className="flex gap-3">
          <button onClick={() => aprobarCarga.mutate()} disabled={aprobarCarga.isPending} className="btn-primary">
            Aprobar carga completa (RF-027)
          </button>
          <button onClick={() => rechazarCarga.mutate()} disabled={rechazarCarga.isPending} className="btn-glass">
            Rechazar carga
          </button>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 font-medium">Fila</th>
                <th className="px-5 py-3 font-medium">Clasificación</th>
                <th className="px-5 py-3 font-medium">Datos originales</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {filas?.items.map((fila) => (
                <tr key={fila.id} className="hover:bg-white/40 transition">
                  <td className="px-5 py-3 text-ink-600">{fila.numeroFila}</td>
                  <td className="px-5 py-3">
                    <span className="chip">{etiquetaClasificacion[fila.clasificacion]}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-400 max-w-xs truncate">
                    {JSON.stringify(fila.datosOriginales)}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{fila.estado}</td>
                  <td className="px-5 py-3 text-right space-x-3">
                    {fila.estado === "pendiente" && carga?.estado === "en_revision" && (
                      <>
                        <button
                          onClick={() => revisarFila.mutate({ filaId: fila.id, estado: "aprobado" })}
                          className="text-emerald-700 hover:underline text-sm"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => revisarFila.mutate({ filaId: fila.id, estado: "rechazado" })}
                          className="text-clay-700 hover:underline text-sm"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
