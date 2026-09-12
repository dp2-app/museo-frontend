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

  if (cargaQuery.isLoading) return <p className="text-sm text-stone-500">Cargando...</p>;
  const carga = cargaQuery.data;
  const filas = filasQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/importacion" className="text-sm text-amber-700 hover:underline">
          ← Volver a importación
        </Link>
        <h2 className="text-xl font-semibold text-stone-900 mt-1">{carga?.archivoNombre}</h2>
        <p className="text-sm text-stone-500">Estado: {carga?.estado}</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {filas && (
        <p className="text-sm text-stone-600">
          Resumen: {filas.resumen.nuevo} nuevas · {filas.resumen.actualizacion} actualizaciones ·{" "}
          {filas.resumen.duplicado} posibles duplicados · {filas.resumen.conflicto} conflictos
        </p>
      )}

      {carga?.estado === "en_revision" && (
        <div className="flex gap-2">
          <button
            onClick={() => aprobarCarga.mutate()}
            disabled={aprobarCarga.isPending}
            className="bg-green-700 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            Aprobar carga completa (RF-027)
          </button>
          <button
            onClick={() => rechazarCarga.mutate()}
            disabled={rechazarCarga.isPending}
            className="bg-stone-200 text-stone-700 rounded px-4 py-1.5 text-sm font-medium hover:bg-stone-300"
          >
            Rechazar carga
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-stone-600 text-left">
            <tr>
              <th className="px-4 py-2">Fila</th>
              <th className="px-4 py-2">Clasificación</th>
              <th className="px-4 py-2">Datos originales</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filas?.items.map((fila) => (
              <tr key={fila.id}>
                <td className="px-4 py-2">{fila.numeroFila}</td>
                <td className="px-4 py-2">{etiquetaClasificacion[fila.clasificacion]}</td>
                <td className="px-4 py-2 font-mono text-xs text-stone-500 max-w-xs truncate">
                  {JSON.stringify(fila.datosOriginales)}
                </td>
                <td className="px-4 py-2">{fila.estado}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  {fila.estado === "pendiente" && carga?.estado === "en_revision" && (
                    <>
                      <button
                        onClick={() => revisarFila.mutate({ filaId: fila.id, estado: "aprobado" })}
                        className="text-green-700 hover:underline"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => revisarFila.mutate({ filaId: fila.id, estado: "rechazado" })}
                        className="text-red-600 hover:underline"
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
  );
}
