import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MensajeError } from "../components/MensajeError";
import { api, extraerMensajeError } from "../lib/api";
import type { CargaExcel, FilaImportacion, FilaImportacionPagina } from "../types";

const etiquetaClasificacion: Record<FilaImportacion["clasificacion"], string> = {
  nuevo: "Nuevo",
  actualizacion: "Actualización",
  duplicado: "Posible duplicado",
  conflicto: "Conflicto",
};

const TAMANO_PAGINA = 200;

const etiquetaEstadoCarga: Record<CargaExcel["estado"], string> = {
  en_revision: "En revisión",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const etiquetaEstadoFila: Record<FilaImportacion["estado"], string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
};

export function CargaDetailPage() {
  const { cargaId } = useParams<{ cargaId: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [soloConErrores, setSoloConErrores] = useState(false);

  const cargaQuery = useQuery({
    queryKey: ["carga", cargaId],
    queryFn: async () => (await api.get<CargaExcel>(`/importacion/cargas/${cargaId}`)).data,
  });

  const filasQuery = useQuery({
    queryKey: ["carga-filas", cargaId, soloConErrores],
    queryFn: async () =>
      (
        await api.get<FilaImportacionPagina>(`/importacion/cargas/${cargaId}/filas`, {
          params: { page_size: TAMANO_PAGINA, con_errores: soloConErrores || undefined },
        })
      ).data,
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

  if (cargaQuery.isLoading) return <p className="text-sm text-gris-2">Cargando...</p>;
  const carga = cargaQuery.data;
  const filas = filasQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/importacion" className="text-sm text-rojo-oscuro hover:underline">
          ← Volver a importación
        </Link>
        <h1 className="mt-1">{carga?.archivoNombre}</h1>
        {carga && <span className="chip mt-1">{etiquetaEstadoCarga[carga.estado]}</span>}
      </div>

      {error && <MensajeError>{error}</MensajeError>}

      {filas && (
        <p className="text-sm text-texto">
          Resumen: {filas.resumen.nuevo} nuevas · {filas.resumen.actualizacion} actualizaciones ·{" "}
          {filas.resumen.duplicado} posibles duplicados · {filas.resumen.conflicto} conflictos
          {filas.resumen.conErrores > 0 && (
            <strong className="text-rojo-oscuro"> · {filas.resumen.conErrores} con errores por corregir</strong>
          )}
        </p>
      )}

      {filas && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-texto min-h-[44px]">
            <input
              type="checkbox"
              checked={soloConErrores}
              onChange={(e) => setSoloConErrores(e.target.checked)}
              className="accent-rojo h-5 w-5"
            />
            Solo filas con errores
          </label>
          <p className="text-sm text-gris-2">
            Mostrando {filas.items.length} de {filas.total} filas
            {filas.total > filas.items.length && " (las primeras en orden de fila)"}.
          </p>
        </div>
      )}

      {carga?.estado === "en_revision" && (
        <div className="flex gap-3">
          <button onClick={() => aprobarCarga.mutate()} disabled={aprobarCarga.isPending} className="btn-primary">
            Aprobar carga completa
          </button>
          <button onClick={() => rechazarCarga.mutate()} disabled={rechazarCarga.isPending} className="btn-glass">
            Rechazar carga
          </button>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gris-2 text-xs uppercase tracking-wide">
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
                  <td className="px-5 py-3 text-texto">{fila.numeroFila}</td>
                  <td className="px-5 py-3">
                    <span className="chip">{etiquetaClasificacion[fila.clasificacion]}</span>
                  </td>
                  <td className="px-5 py-3 max-w-xs">
                    <p className="font-mono text-xs text-gris-2 truncate">{JSON.stringify(fila.datosOriginales)}</p>
                    {fila.errores.length > 0 && (
                      <ul className="mt-1 text-xs text-rojo-oscuro list-disc pl-4">
                        {fila.errores.map((e) => (
                          <li key={e.campo}>
                            <strong>{e.campo}</strong>: {e.motivo}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-5 py-3 text-texto">{etiquetaEstadoFila[fila.estado]}</td>
                  <td className="px-5 py-3 text-right space-x-3">
                    {fila.estado === "pendiente" && carga?.estado === "en_revision" && (
                      <>
                        <button
                          onClick={() => revisarFila.mutate({ filaId: fila.id, estado: "aprobado" })}
                          disabled={fila.errores.length > 0}
                          title={fila.errores.length > 0 ? "Tiene errores: exclúyela (RF-30)" : undefined}
                          className="text-azul hover:underline text-sm disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => revisarFila.mutate({ filaId: fila.id, estado: "rechazado" })}
                          className="text-rojo-oscuro hover:underline text-sm"
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
