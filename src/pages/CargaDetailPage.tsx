import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { datosApi, extraerMensajeError } from "../lib/api";
import { CLASIFICACIONES, ESTADOS_CARGA, prepararRevision, subirExcel, validarArchivoExcel, valorLegible, type SeleccionRevision } from "../lib/importacion";
import { usePermisos } from "../hooks/usePermisos";
import type { CargaExcel, FilaImportacion, FilaImportacionPagina } from "../types";

interface DecisionFila { estado?: "aprobado" | "rechazado"; motivoRechazo?: string; datosCorregidos?: Record<string, unknown>; piezaCoincidenteId?: string; curacionPendiente?: boolean; }

export function CargaDetailPage() {
  const { cargaId } = useParams<{ cargaId: string }>();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const permisos = usePermisos();
  const inputCorregido = useRef<HTMLInputElement>(null);
  const [pagina, setPagina] = useState(1);
  const [clasificacion, setClasificacion] = useState("");
  const [estado, setEstado] = useState("");
  const [soloErrores, setSoloErrores] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [edicion, setEdicion] = useState<FilaImportacion | null>(null);
  const [cierre, setCierre] = useState<{ accion: "rechazar" | "cancelar" | "fila"; filaId?: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [seleccion, setSeleccion] = useState<SeleccionRevision | null>(null);
  const [duplicados, setDuplicados] = useState(false);
  const [actualizaciones, setActualizaciones] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const tamano = 50;
  const puedeRevisar = permisos.puede("importacion.cargar");
  const cargaQuery = useQuery({ queryKey: ["carga", cargaId], retry: false,
    queryFn: async () => (await datosApi.get<CargaExcel>(`/importacion/cargas/${cargaId}`)).data });
  const carga = cargaQuery.data;
  const abierta = carga?.estado === "en_revision" || carga?.estado === "pendiente_aprobacion";
  const filasQuery = useQuery({ queryKey: ["carga-filas", cargaId, pagina, clasificacion, estado, soloErrores], enabled: !!carga,
    queryFn: async () => (await datosApi.get<FilaImportacionPagina>(`/importacion/cargas/${cargaId}/filas`, {
      params: { pagina, tamano, clasificacion: clasificacion || undefined, estado: estado || undefined, soloErrores },
    })).data });
  const pendientes = useQuery({ queryKey: ["carga-pendientes", cargaId], enabled: !!carga && abierta,
    queryFn: async () => (await datosApi.get<FilaImportacionPagina>(`/importacion/cargas/${cargaId}/filas`, { params: { estado: "pendiente", tamano: 1 } })).data.total });
  function invalidar() {
    for (const key of ["carga", "carga-filas", "carga-pendientes"]) void cache.invalidateQueries({ queryKey: [key, cargaId] });
    void cache.invalidateQueries({ queryKey: ["cargas"] });
  }
  function fallo(e: unknown) { setError(extraerMensajeError(e)); setAviso(""); }
  const revisarFila = useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DecisionFila }) => datosApi.patch(`/importacion/cargas/${cargaId}/filas/${id}`, datos),
    onSuccess: () => { setError(""); setEdicion(null); setAviso("Revisión de fila guardada."); invalidar(); }, onError: fallo,
  });
  const preparar = useMutation({
    mutationFn: () => prepararRevision(cargaId!),
    onSuccess: (data) => { setSeleccion(data); setDuplicados(false); setActualizaciones(false); setConfirmacion(false); setError(""); },
    onError: fallo,
  });
  const ids = seleccion ? [...seleccion.nuevas, ...(actualizaciones ? seleccion.actualizaciones : []), ...(duplicados ? seleccion.duplicados : [])].slice(0, 10000) : [];
  const revisarVarias = useMutation({
    mutationFn: async () => (await datosApi.patch<{ filasRevisadas: number }>(`/importacion/cargas/${cargaId}/filas`, {
      filasIds: ids, estado: "aprobado", confirmarDuplicados: duplicados, confirmarActualizaciones: actualizaciones,
    })).data,
    onSuccess: (data) => { setSeleccion(null); setConfirmacion(false); setPagina(1); setError(""); setAviso(`${data.filasRevisadas} filas revisadas. La carga aún no se ha aplicado al catálogo.`); invalidar(); },
    onError: (e) => { fallo(e); setSeleccion(null); invalidar(); },
  });
  const aplicar = useMutation({ mutationFn: () => datosApi.post(`/importacion/cargas/${cargaId}/aprobar`),
    onSuccess: () => { setError(""); setAviso("Carga aplicada al catálogo. Las fichas conservan su estado de borrador para la revisión habitual."); invalidar(); }, onError: fallo });
  const cerrar = useMutation({
    mutationFn: async () => {
      if (cierre!.accion === "fila") await datosApi.patch(`/importacion/cargas/${cargaId}/filas/${cierre!.filaId}`, { estado: "rechazado", motivoRechazo: motivo });
      else await datosApi.post(`/importacion/cargas/${cargaId}/${cierre!.accion}`, { motivo });
    },
    onSuccess: () => { setError(""); setAviso("Decisión guardada."); setCierre(null); setMotivo(""); invalidar(); }, onError: fallo,
  });
  const reporte = useMutation({
    mutationFn: async () => (await datosApi.get(`/importacion/cargas/${cargaId}/reporte-errores`, { responseType: "blob" })).data as Blob,
    onSuccess: (blob) => {
      setError(""); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `errores_${cargaId}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, onError: fallo,
  });
  const recargar = useMutation({
    mutationFn: (archivo: File) => subirExcel(archivo, carga?.hojaNombre ?? null, carga?.plantillaMapeoId ?? null),
    onSuccess: (nueva) => {
      setSeleccion(null); setEdicion(null); setCierre(null); setPagina(1); setError(""); setAviso("");
      setClasificacion(""); setEstado(""); setSoloErrores(false);
      void cache.invalidateQueries({ queryKey: ["cargas"] }); navigate(`/importacion/${nueva.id}`);
    }, onError: fallo,
  });
  const ocupado = revisarFila.isPending || revisarVarias.isPending || aplicar.isPending || cerrar.isPending || recargar.isPending || preparar.isPending;
  const filas = filasQuery.data;
  const paginas = Math.max(1, Math.ceil((filas?.total ?? 0) / tamano));
  function abrirCierre(accion: "rechazar" | "cancelar" | "fila", filaId?: string) { setCierre({ accion, filaId }); setMotivo(""); setError(""); }

  if (cargaQuery.isLoading) return <p role="status">Cargando inventario…</p>;
  if (!carga) return <div className="space-y-3"><Link to="/importacion">Volver a importación</Link><p role="alert">{extraerMensajeError(cargaQuery.error)}</p><button className="btn-glass" onClick={() => { void cargaQuery.refetch(); }}>Reintentar</button></div>;
  return <div className="space-y-5">
    <header><Link to="/importacion" className="text-clay-700 underline">Volver a importación</Link>
      <h1 className="mt-2 break-words">{carga.archivoNombre}</h1><p>Hoja: <strong>{carga.hojaNombre}</strong> · <strong>{ESTADOS_CARGA[carga.estado]}</strong></p>
      <p>{carga.totalFilas} filas · {carga.filasConError} con errores · {carga.filasRechazadas} rechazadas</p>
      {carga.motivoRechazo && <p>Motivo: {carga.motivoRechazo}</p>}
    </header>
    {error && <p role="alert" className="rounded-xl border border-rojo p-3">{error}</p>}
    {aviso && <p role="status" className="rounded-xl border border-ink-200 p-3">{aviso}</p>}
    {filas && <p>{filas.resumen.nuevo} nuevas · {filas.resumen.actualizacion} actualizaciones · {filas.resumen.duplicado} posibles duplicados · {filas.resumen.conflicto} conflictos</p>}

    <div className="flex flex-wrap gap-3">
      <button className="btn-glass" onClick={() => reporte.mutate()} disabled={reporte.isPending}>Descargar reporte de errores</button>
      {abierta && puedeRevisar && <>
        <button className="btn-glass" onClick={() => inputCorregido.current?.click()} disabled={ocupado}>Cargar archivo corregido</button>
        <input ref={inputCorregido} type="file" accept=".xlsx" aria-label="Archivo corregido" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0]; if (file) { const invalido = validarArchivoExcel(file); if (invalido) setError(invalido); else recargar.mutate(file); }
          e.target.value = "";
        }} />
        <button className="btn-glass" disabled={ocupado || pendientes.data === 0} onClick={() => preparar.mutate()}>{preparar.isPending ? "Preparando filas…" : "Revisar varias filas pendientes"}</button>
      </>}
    </div>
    {recargar.isPending && <p role="status">Validando la misma hoja del archivo corregido con el mismo formato de columnas…</p>}

    {seleccion && abierta && <form aria-label="Revisión conjunta" className="glass-panel p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); revisarVarias.mutate(); }}>
      <h2 className="section-title">Revisión conjunta de filas pendientes</h2>
      <p>{seleccion.nuevas.length} filas nuevas sin errores. Esta selección corresponde a toda la carga, independientemente de los filtros de la tabla.</p>
      {seleccion.actualizaciones.length > 0 && <label className="block"><input type="checkbox" checked={actualizaciones} onChange={(e) => setActualizaciones(e.target.checked)} disabled={ocupado} /> Incluir {seleccion.actualizaciones.length} actualizaciones de piezas existentes</label>}
      {seleccion.duplicados.length > 0 && <label className="block"><input type="checkbox" checked={duplicados} onChange={(e) => setDuplicados(e.target.checked)} disabled={ocupado} /> Incluir {seleccion.duplicados.length} posibles duplicados como registros distintos</label>}
      <p>{seleccion.excluidas} filas requieren corrección o revisión individual por errores, conflictos o códigos repetidos.</p>
      <p>Se marcarán {ids.length} filas como revisadas. Revisa sus datos, coincidencias y cambios antes de confirmar. Cada operación admite hasta 10.000 filas.</p>
      <label className="block font-semibold"><input type="checkbox" checked={confirmacion} onChange={(e) => setConfirmacion(e.target.checked)} disabled={ocupado} /> Confirmo que revisé las filas seleccionadas y las decisiones indicadas</label>
      <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={ocupado || !confirmacion || !ids.length}>Marcar {ids.length} filas como revisadas</button>
        <button type="button" className="btn-glass" disabled={ocupado} onClick={() => setSeleccion(null)}>Cancelar revisión conjunta</button></div>
    </form>}

    {abierta && <section aria-label="Decisión de la carga" className="glass-panel p-4 space-y-3">
      <p role="status">{pendientes.isLoading ? "Contando filas pendientes…" : `${pendientes.data ?? "—"} filas pendientes de revisión en la carga.`}</p>
      {pendientes.isError && <p role="alert">{extraerMensajeError(pendientes.error)}</p>}
      <p className="text-sm">Las piezas se registran solo al aprobar la carga completa. Las filas rechazadas se conservan como antecedente.</p>
      <div className="flex flex-wrap gap-3">
        {(carga.puedeAprobar ?? permisos.puede("importacion.aprobar")) && <button className="btn-primary" disabled={ocupado || pendientes.data !== 0 || pendientes.isFetching} onClick={() => aplicar.mutate()}>{aplicar.isPending ? "Aplicando la carga…" : "Aprobar carga completa"}</button>}
        {permisos.puede("importacion.rechazar") && <button className="btn-glass" disabled={ocupado} onClick={() => abrirCierre("rechazar")}>Rechazar carga</button>}
        {puedeRevisar && (carga.usuarioId === permisos.sesion?.usuario.id || permisos.puede("importacion.rechazar")) && <button className="btn-glass" disabled={ocupado} onClick={() => abrirCierre("cancelar")}>Cancelar carga</button>}
      </div>
    </section>}
    {cierre && <form aria-label="Motivo de la decisión" className="glass-panel p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); cerrar.mutate(); }}>
      <label className="block font-semibold" htmlFor="motivo-importacion">Motivo de la decisión</label><textarea id="motivo-importacion" required value={motivo} onChange={(e) => setMotivo(e.target.value)} className="glass-input w-full" />
      <div className="flex gap-3"><button className="btn-primary" disabled={ocupado || !motivo.trim()}>{cierre.accion === "cancelar" ? "Confirmar cancelación" : "Confirmar rechazo"}</button><button type="button" className="btn-glass" onClick={() => setCierre(null)} disabled={ocupado}>Volver a la revisión</button></div>
    </form>}
    {edicion && abierta && <EditorFila key={edicion.id} fila={edicion} ocupado={ocupado} guardar={(datos) => revisarFila.mutate({ id: edicion.id, datos })} cerrar={() => setEdicion(null)} />}

    <section aria-label="Filas del inventario" className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label>Clasificación<select aria-label="Filtrar clasificación" className="glass-input block" value={clasificacion} onChange={(e) => { setClasificacion(e.target.value); setPagina(1); }}><option value="">Todas</option>{Object.entries(CLASIFICACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Estado de revisión<select aria-label="Filtrar estado de revisión" className="glass-input block" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}><option value="">Todos</option><option value="pendiente">Pendientes</option><option value="aprobado">Revisadas</option><option value="rechazado">Rechazadas</option></select></label>
        <label><input type="checkbox" checked={soloErrores} onChange={(e) => { setSoloErrores(e.target.checked); setPagina(1); }} /> Solo filas con errores</label>
      </div>
      {filasQuery.isFetching && <p role="status">Cargando filas…</p>}{filasQuery.isError && <p role="alert">{extraerMensajeError(filasQuery.error)}</p>}
      <div className="glass-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{["Fila", "Pieza y datos", "Clasificación", "Revisión", "Acciones"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody>{filas?.items.map((fila) => <tr key={fila.id} className="border-t border-ink-100 align-top" data-fila={fila.numeroFila}>
          <td className="p-4">{fila.numeroFila}</td>
          <td className="p-4 min-w-64 max-w-xl"><strong>{valorLegible(Object.entries(fila.datosOriginales).find(([k]) => /t[ií]tulo|denominaci[oó]n/i.test(k))?.[1])}</strong>
            <p className="text-ink-500">{fila.identificadores.slice(0, 3).map((c) => c.valor).join(" · ")}</p>
            <details className="mt-2"><summary className="cursor-pointer">Ver datos y cambios</summary>
              <dl className="max-h-80 overflow-auto space-y-2 mt-2">{Object.entries(fila.datosOriginales).map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="whitespace-pre-wrap break-words">{valorLegible(v)}</dd></div>)}</dl>
              {fila.cambios.length > 0 && <div className="mt-3 space-y-2"><h3 className="font-semibold">Cambios propuestos en la pieza</h3>{fila.cambios.map((c) => <p key={c.campo}>{c.etiqueta}: {valorLegible(c.valorActual)} → {valorLegible(c.valorNuevo)}</p>)}</div>}
              {Object.keys(fila.camposNoMapeados).length > 0 && <p className="mt-3">Otros datos conservados en el origen: {Object.keys(fila.camposNoMapeados).join(", ")}.</p>}
            </details>
            {fila.errores.map((e, i) => <p key={i} className="text-rojo mt-2">{e.columna ?? e.campo}: {e.mensaje}</p>)}
            {fila.datosNormalizados?.advertencias?.map((e, i) => <p key={i} className="mt-2">Pendiente de revisión: {e.columna ?? e.campo}: {e.mensaje}</p>)}
            {fila.candidatos.map((c, i) => <p key={i} className="mt-2">{c.explicacion}{c.piezaId && permisos.puede("piezas.ver") && <> <Link className="underline" to={`/coleccion/${c.piezaId}`}>Consultar pieza</Link></>}</p>)}
          </td>
          <td className="p-4">{CLASIFICACIONES[fila.clasificacion]}</td>
          <td className="p-4">{fila.estado === "aprobado" ? "Revisada" : fila.estado === "rechazado" ? "Rechazada" : "Pendiente"}{fila.motivoRechazo && <p>{fila.motivoRechazo}</p>}{fila.curacionPendiente && <p className="mt-2 font-semibold">{abierta ? "Irá a la cola de curación al aprobar la carga" : "Quedó en la cola de curación"}</p>}{fila.piezaResultanteId && permisos.puede("piezas.ver") && <Link className="block underline mt-2" to={`/coleccion/${fila.piezaResultanteId}`}>Ver pieza registrada</Link>}</td>
          <td className="p-4 min-w-36">{abierta && puedeRevisar && <div className="flex flex-col items-start gap-3">
            <button disabled={ocupado || !!fila.errores.length || fila.clasificacion === "conflicto" || fila.estado === "aprobado"} className="text-emerald-700 underline disabled:opacity-40" onClick={() => revisarFila.mutate({ id: fila.id, datos: { estado: "aprobado" } })}>Marcar revisada</button>
            <button disabled={ocupado} className="underline" onClick={() => setEdicion(fila)}>Corregir fila</button>
            <button disabled={ocupado || fila.estado === "rechazado"} className="underline" onClick={() => abrirCierre("fila", fila.id)}>Rechazar fila</button>
            <button disabled={ocupado || fila.estado === "rechazado"} aria-pressed={fila.curacionPendiente} className="underline"
              onClick={() => revisarFila.mutate({ id: fila.id, datos: { curacionPendiente: !fila.curacionPendiente } })}>
              {fila.curacionPendiente ? "Quitar de curación" : "Enviar a curación"}</button>
            {fila.clasificacion === "conflicto" && <ResolverConflicto fila={fila} ocupado={ocupado} guardar={(id) => revisarFila.mutate({ id: fila.id, datos: { piezaCoincidenteId: id } })} />}
          </div>}</td>
        </tr>)}</tbody>
      </table>{filas?.total === 0 && <p className="p-4">No hay filas con estos filtros.</p>}</div>
      <nav aria-label="Páginas de filas" className="flex flex-wrap items-center gap-4">
        <button className="btn-glass" disabled={pagina === 1 || filasQuery.isFetching || ocupado} onClick={() => setPagina((p) => p - 1)}>Página anterior</button>
        <span>Página {pagina} de {paginas} · {filas?.total ?? 0} filas</span>
        <button className="btn-glass" disabled={pagina >= paginas || filasQuery.isFetching || ocupado} onClick={() => setPagina((p) => p + 1)}>Página siguiente</button>
      </nav>
    </section>
  </div>;
}

function ResolverConflicto({ fila, ocupado, guardar }: { fila: FilaImportacion; ocupado: boolean; guardar: (id: string) => void }) {
  const [id, setId] = useState("");
  const candidatas = [...new Map(fila.candidatos.filter((c) => c.regla === "identificador_exacto" && c.piezaId).map((c) => [c.piezaId!, c])).entries()];
  return <div className="space-y-2"><label>Elegir pieza coincidente<select aria-label={`Pieza coincidente de fila ${fila.numeroFila}`} className="glass-input w-full" value={id} onChange={(e) => setId(e.target.value)}><option value="">Elegir pieza</option>{candidatas.map(([key, c]) => <option key={key} value={key}>{c.piezaDenominacion ?? "Pieza candidata"}</option>)}</select></label>
    <button className="btn-glass" disabled={!id || ocupado} onClick={() => guardar(id)}>Resolver coincidencia</button></div>;
}

function EditorFila({ fila, ocupado, guardar, cerrar }: { fila: FilaImportacion; ocupado: boolean; guardar: (datos: DecisionFila) => void; cerrar: () => void }) {
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const columnas = fila.datosNormalizados?.columnas ?? {};
  return <form aria-label={`Corrección de fila ${fila.numeroFila}`} className="glass-panel p-5 space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); guardar({ datosCorregidos: valores }); }}>
    <h2 className="section-title">Corregir fila {fila.numeroFila}</h2><p>Los valores anteriores se conservan en el registro de importación.</p>
    <div className="max-h-96 overflow-auto grid gap-4 md:grid-cols-2">{Object.entries(columnas).map(([destino, etiqueta]) => <div key={destino}>
      <label htmlFor={`correccion-${destino}`} className="block">{etiqueta}</label><textarea id={`correccion-${destino}`} className="glass-input block w-full" value={String(valores[destino] ?? fila.datosNormalizados?.mapeados?.[destino] ?? "")} onChange={(e) => setValores((prev) => ({ ...prev, [destino]: e.target.value }))} />
    </div>)}</div>
    <div className="flex gap-3"><button className="btn-primary" disabled={ocupado || !Object.keys(valores).length}>Guardar corrección</button><button type="button" className="btn-glass" onClick={cerrar} disabled={ocupado}>Cerrar corrección</button></div>
  </form>;
}
