import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, Upload } from "lucide-react";
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
  const navigate = useNavigate();
  const inputCorregido = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const cargaQuery = useQuery({
    queryKey: ["carga", cargaId],
    queryFn: async () => (await api.get<CargaExcel>(`/importacion/cargas/${cargaId}`)).data,
  });
  const carga = cargaQuery.data;

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

  const descargarReporte = useMutation({
    mutationFn: async () =>
      (await api.get(`/importacion/cargas/${cargaId}/reporte-errores`, { responseType: "blob" })).data as Blob,
    onSuccess: (blob) => {
      setError(null);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `errores_${cargaId}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const recargarCorregido = useMutation({
    mutationFn: async (archivo: File) => {
      const form = new FormData();
      form.append("archivo", archivo);
      if (carga?.plantillaMapeoId) form.append("plantilla_mapeo_id", carga.plantillaMapeoId);
      return (await api.post<CargaExcel>("/importacion/cargas", form)).data;
    },
    onSuccess: (nueva) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      navigate(`/importacion/${nueva.id}`);
    },
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
  const filas = filasQuery.data;
  const filasConError = filas?.items.filter((fila) => fila.errores.length > 0).length ?? 0;

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

      {carga && filasConError > 0 && (
        <div className="glass-panel-sm p-4 space-y-3">
          <p className="text-sm text-texto">
            {filasConError} fila(s) con errores de validación. Descarga el reporte, corrige el archivo original y vuelve a
            cargarlo: se usará el mismo mapeo.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => descargarReporte.mutate()}
              disabled={descargarReporte.isPending}
              className="btn-glass"
            >
              <Download size={16} aria-hidden="true" /> Descargar reporte de errores
            </button>
            <button
              type="button"
              onClick={() => inputCorregido.current?.click()}
              disabled={recargarCorregido.isPending}
              className="btn-primary"
            >
              <Upload size={16} aria-hidden="true" /> Cargar archivo corregido
            </button>
            <input
              ref={inputCorregido}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              aria-label="Archivo corregido"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) recargarCorregido.mutate(archivo);
                e.target.value = "";
              }}
            />
          </div>
        </div>
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
            <tbody className="divide-y divide-linea">
              {filas?.items.map((fila) => (
                <tr key={fila.id} className="hover:bg-fondo-suave transition">
                  <td className="px-5 py-3 text-ink-600">{fila.numeroFila}</td>
                  <td className="px-5 py-3">
                    <span className="chip">{etiquetaClasificacion[fila.clasificacion]}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-400 max-w-xs truncate">
                    {JSON.stringify(fila.datosOriginales)}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {fila.estado}
                    {fila.errores.map((e) => (
                      <p key={`${e.campo}-${e.mensaje}`} className="text-xs text-rojo mt-1">
                        {e.columna ?? e.campo}: {e.mensaje}
                        {e.valorOriginal != null && ` (valor: "${e.valorOriginal}")`}
                      </p>
                    ))}
                    {fila.advertencias.map((a) => (
                      <p key={`${a.campo}-${a.mensaje}`} className="text-xs text-gris-2 mt-1">
                        {a.columna ?? a.campo}: {a.mensaje}
                      </p>
                    ))}
                  </td>
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
