import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, extraerMensajeError } from "../lib/api";
import { ADMINISTRADOR, GESTOR_COLECCIONES } from "../lib/secciones";
import type { CargaExcel, FilaImportacion, FilaImportacionPagina } from "../types";

const etiquetaClasificacion: Record<FilaImportacion["clasificacion"], string> = {
  nuevo: "Nuevo",
  actualizacion: "Actualización",
  duplicado: "Posible duplicado",
  conflicto: "Conflicto",
};

const etiquetaEstadoCarga: Record<CargaExcel["estado"], string> = {
  en_revision: "En revisión",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

type Cierre = "rechazar" | "cancelar";

export function CargaDetailPage() {
  const { cargaId } = useParams<{ cargaId: string }>();
  const { rol } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [motivoCierre, setMotivoCierre] = useState("");
  const [filaRechazando, setFilaRechazando] = useState<string | null>(null);
  const [motivoFila, setMotivoFila] = useState("");
  const [eleccion, setEleccion] = useState<Record<string, string>>({});

  const cargaQuery = useQuery({
    queryKey: ["carga", cargaId],
    queryFn: async () => (await api.get<CargaExcel>(`/importacion/cargas/${cargaId}`)).data,
  });

  const filasQuery = useQuery({
    queryKey: ["carga-filas", cargaId],
    queryFn: async () =>
      (await api.get<FilaImportacionPagina>(`/importacion/cargas/${cargaId}/filas`, { params: { page_size: 1000 } })).data,
  });

  const invalidarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ["carga", cargaId] });
    queryClient.invalidateQueries({ queryKey: ["carga-filas", cargaId] });
    queryClient.invalidateQueries({ queryKey: ["cargas"] });
  };

  const revisarFila = useMutation({
    mutationFn: async ({ filaId, cuerpo }: { filaId: string; cuerpo: Record<string, string> }) =>
      (await api.patch(`/importacion/cargas/${cargaId}/filas/${filaId}`, cuerpo)).data,
    onSuccess: () => {
      setError(null);
      setFilaRechazando(null);
      setMotivoFila("");
      invalidarTodo();
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

  const cerrarCarga = useMutation({
    mutationFn: async ({ accion, motivo }: { accion: Cierre; motivo: string }) =>
      (await api.post(`/importacion/cargas/${cargaId}/${accion}`, { motivo })).data,
    onSuccess: () => {
      setError(null);
      setCierre(null);
      setMotivoCierre("");
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  if (cargaQuery.isLoading) return <p className="text-sm text-gris-2">Cargando...</p>;
  const carga = cargaQuery.data;
  const filas = filasQuery.data;
  const abierta = carga?.estado === "en_revision" || carga?.estado === "pendiente_aprobacion";
  const puedeDecidir = rol === ADMINISTRADOR || rol === GESTOR_COLECCIONES;
  const hayConflictos = (filas?.resumen.conflicto ?? 0) > 0;

  function onCerrar(e: FormEvent) {
    e.preventDefault();
    if (cierre) cerrarCarga.mutate({ accion: cierre, motivo: motivoCierre });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/importacion" className="text-sm text-azul hover:underline">
          ← Volver a importación
        </Link>
        <h1 className="text-2xl md:text-3xl mt-1">{carga?.archivoNombre}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {carga && <span className="chip">{etiquetaEstadoCarga[carga.estado]}</span>}
          {carga?.hojaNombre && <span className="text-xs text-gris-2">Hoja: {carga.hojaNombre}</span>}
        </div>
      </div>

      {carga?.motivoRechazo && (
        <div className="glass-panel-sm p-4 border-l-4 !border-l-rojo">
          <p className="text-xs font-semibold uppercase tracking-wide text-gris-2">
            Motivo del {carga.estado === "cancelada" ? "cierre (cancelación)" : "rechazo"} de la carga
          </p>
          <p className="text-sm text-texto mt-1">{carga.motivoRechazo}</p>
          {carga.rechazadaEn && (
            <p className="text-xs text-gris-2 mt-1">{new Date(carga.rechazadaEn).toLocaleString("es-PE", { hour12: true })}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rojo bg-rojo/10 border border-rojo/30 rounded-btn px-3 py-2">{error}</p>}

      {filas && (
        <p className="text-sm text-texto">
          Resumen: {filas.resumen.nuevo} nuevas · {filas.resumen.actualizacion} actualizaciones ·{" "}
          {filas.resumen.duplicado} posibles duplicados · {filas.resumen.conflicto} conflictos
          {carga && carga.filasRechazadas > 0 && <> · {carga.filasRechazadas} filas rechazadas</>}
        </p>
      )}
      {hayConflictos && abierta && (
        <p className="text-sm text-texto bg-fondo-suave border border-linea rounded-btn px-3 py-2">
          Hay filas que coinciden con varias piezas. Elija a cuál corresponde cada una o recházala con un motivo antes
          de aprobar la carga (RF-33).
        </p>
      )}

      {abierta && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => aprobarCarga.mutate()}
              disabled={aprobarCarga.isPending || !puedeDecidir}
              title={puedeDecidir ? undefined : "Solo Administrador o Gestor de colecciones aprueban cargas"}
              className="btn-primary"
            >
              Aprobar carga completa (RF-027)
            </button>
            <button
              onClick={() => setCierre(cierre === "rechazar" ? null : "rechazar")}
              disabled={!puedeDecidir}
              title={puedeDecidir ? undefined : "Solo Administrador o Gestor de colecciones rechazan cargas"}
              className="btn-glass"
            >
              Rechazar carga
            </button>
            <button onClick={() => setCierre(cierre === "cancelar" ? null : "cancelar")} className="btn-glass">
              Cancelar carga
            </button>
          </div>
          {cierre && (
            <form onSubmit={onCerrar} className="glass-panel-sm p-4 space-y-2 max-w-xl">
              <label className="form-label" htmlFor="motivo-cierre">
                Motivo del {cierre === "rechazar" ? "rechazo" : "cierre"} (obligatorio)
              </label>
              <textarea
                id="motivo-cierre"
                required
                rows={2}
                value={motivoCierre}
                onChange={(e) => setMotivoCierre(e.target.value)}
                className="glass-input"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setCierre(null)} className="btn-danger-text">
                  Volver
                </button>
                <button type="submit" disabled={cerrarCarga.isPending || !motivoCierre.trim()} className="btn-primary !min-h-0 !py-1.5">
                  Confirmar {cierre === "rechazar" ? "rechazo" : "cancelación"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Fila</th>
                <th className="px-4 py-3 font-semibold">Clasificación</th>
                <th className="px-4 py-3 font-semibold">Identificadores y coincidencias</th>
                <th className="px-4 py-3 font-semibold">Datos originales</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea align-top">
              {filas?.items.map((fila) => {
                const candidatasPiezas = fila.candidatos.filter((c) => c.regla === "identificador_exacto" && c.piezaId);
                const opciones = [...new Map(candidatasPiezas.map((c) => [c.piezaId!, c])).values()];
                const sinMapear = Object.entries(fila.camposNoMapeados ?? {});
                return (
                  <tr key={fila.id} className="hover:bg-fondo-suave transition">
                    <td className="px-4 py-3 text-texto">{fila.numeroFila}</td>
                    <td className="px-4 py-3">
                      <span className="chip">{etiquetaClasificacion[fila.clasificacion]}</span>
                    </td>
                    <td className="px-4 py-3 space-y-1.5 min-w-[16rem]">
                      {fila.identificadores.length === 0 && <p className="text-xs text-gris-2">Sin identificadores</p>}
                      {fila.identificadores.map((i) => (
                        <p key={`${i.clave}-${i.normalizado}`} className="text-xs text-texto">
                          <span className="font-semibold">{i.tipo ?? i.clave}:</span> <span className="font-mono">{i.valor}</span>
                          {!i.tipoId && <span className="text-gris-2"> (tipo no configurado: no concilia)</span>}
                        </p>
                      ))}
                      {fila.candidatos.map((c, k) => (
                        <p key={k} className="text-xs text-texto bg-fondo-suave border border-linea rounded-btn px-2 py-1">
                          {c.explicacion}{" "}
                          {c.piezaId && (
                            <Link to={`/coleccion/${c.piezaId}`} className="text-azul underline">
                              Ver pieza
                            </Link>
                          )}
                        </p>
                      ))}
                      {fila.clasificacion === "conflicto" && fila.estado === "pendiente" && abierta && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <label className="sr-only" htmlFor={`elegir-${fila.id}`}>
                            Pieza a la que corresponde la fila {fila.numeroFila}
                          </label>
                          <select
                            id={`elegir-${fila.id}`}
                            value={eleccion[fila.id] ?? ""}
                            onChange={(e) => setEleccion((v) => ({ ...v, [fila.id]: e.target.value }))}
                            className="glass-input !w-auto text-xs"
                          >
                            <option value="">Elegir pieza…</option>
                            {opciones.map((c) => (
                              <option key={c.piezaId} value={c.piezaId}>
                                {c.piezaDenominacion || "(sin denominación)"}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={!eleccion[fila.id] || revisarFila.isPending}
                            onClick={() => revisarFila.mutate({ filaId: fila.id, cuerpo: { piezaCoincidenteId: eleccion[fila.id] } })}
                            className="btn-glass !min-h-0 !py-1 !px-2 !text-xs"
                          >
                            Resolver como actualización
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-mono text-xs text-gris-2 truncate" title={JSON.stringify(fila.datosOriginales)}>
                        {JSON.stringify(fila.datosOriginales)}
                      </p>
                      {sinMapear.length > 0 && (
                        <p className="text-xs text-texto mt-1">
                          <span className="font-semibold">Sin mapear (se conservan):</span> {sinMapear.map(([k]) => k).join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-texto">
                      {fila.estado}
                      {fila.estado === "rechazado" && fila.motivoRechazo && (
                        <p className="text-xs text-gris-2 mt-0.5">Motivo: {fila.motivoRechazo}</p>
                      )}
                      {fila.piezaResultanteId && (
                        <p className="text-xs mt-0.5">
                          <Link to={`/coleccion/${fila.piezaResultanteId}`} className="text-azul underline">
                            Pieza resultante
                          </Link>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-y-1.5">
                      {fila.estado === "pendiente" && abierta && (
                        <>
                          <div className="space-x-3">
                            <button
                              onClick={() => revisarFila.mutate({ filaId: fila.id, cuerpo: { estado: "aprobado" } })}
                              disabled={fila.clasificacion === "conflicto"}
                              title={fila.clasificacion === "conflicto" ? "Resuelva el conflicto primero" : undefined}
                              className="text-verde hover:underline text-sm font-medium disabled:opacity-40 disabled:no-underline"
                            >
                              Aprobar
                            </button>
                            <button onClick={() => setFilaRechazando(filaRechazando === fila.id ? null : fila.id)} className="text-rojo hover:underline text-sm font-medium">
                              Rechazar
                            </button>
                          </div>
                          {filaRechazando === fila.id && (
                            <form
                              onSubmit={(e: FormEvent) => {
                                e.preventDefault();
                                revisarFila.mutate({ filaId: fila.id, cuerpo: { estado: "rechazado", motivoRechazo: motivoFila } });
                              }}
                              className="flex gap-2 justify-end"
                            >
                              <label className="sr-only" htmlFor={`motivo-${fila.id}`}>
                                Motivo del rechazo de la fila {fila.numeroFila}
                              </label>
                              <input
                                id={`motivo-${fila.id}`}
                                required
                                value={motivoFila}
                                onChange={(e) => setMotivoFila(e.target.value)}
                                placeholder="Motivo (obligatorio)"
                                className="glass-input !w-44 text-xs"
                              />
                              <button type="submit" className="btn-primary !min-h-0 !py-1 !px-2 !text-xs">
                                Confirmar
                              </button>
                            </form>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
