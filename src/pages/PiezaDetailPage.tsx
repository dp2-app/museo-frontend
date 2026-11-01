import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FormularioFicha, CamposFaltantes } from "../components/f0/FormularioFicha";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { ArchivosFicha } from "../components/ArchivosFicha";
import { CodigosFicha } from "../components/IdentificacionFicha";
import { EstadoUbicacion } from "../components/EstadoUbicacion";
import { Aviso, ConMotivo, ErrorConsulta, Panel } from "../components/FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { usePermisos } from "../hooks/usePermisos";
import { api, extraerErroresApi } from "../lib/api";
import { cambiosFicha, datosFicha, nombreFicha, type Ficha } from "../lib/ficha";
import type { RegistroAuditoria } from "../types";

/** El editor conserva su instantánea y entradas cuando el servidor responde 409. */
function EditorFicha({ original, terminar }: { original: Ficha; terminar: () => void }) {
  const cache = useQueryClient(); const [conflicto, setConflicto] = useState(false); const [recarga, setRecarga] = useState(0); const [base, setBase] = useState(original);
  const op = useOperacion();
  const etiquetasActuales = Object.fromEntries([
    ...Object.entries(base.etiquetas).flatMap(([clave, etiqueta]) => etiqueta && base.campos[clave] ? [[String(base.campos[clave]), etiqueta]] : []),
    ...Object.values(base.listas).flat().filter((v) => v.etiqueta).map((v) => [v.id, v.etiqueta!]),
  ]);
  return <Panel titulo="Editar ficha"><p>Solo se enviarán los campos modificados.</p>
    {conflicto && <div role="alert"><p>Otra persona cambió esta pieza. Tus cambios siguen en el formulario. Copia lo que necesites antes de recargar la versión del servidor.</p><button className="btn-glass" disabled={op.pendiente} onClick={() => op.ejecutar(async () => { const p = (await api.get<Ficha>(`/piezas/${base.id}`)).data; setBase(p); setRecarga(recarga + 1); setConflicto(false); })}>Recargar ficha y descartar mis cambios</button></div>}
    <Aviso mensaje={op.mensaje} /><FormularioFicha key={recarga} edicion inicial={datosFicha(base)} etiquetasActuales={etiquetasActuales} onGuardar={async (datos) => {
      try { await api.patch(`/piezas/${base.id}`, { version: base.version, ...cambiosFicha(datosFicha(base), datos) }); await cache.invalidateQueries(); terminar(); }
      catch (e) { if (extraerErroresApi(e).some((x) => x.codigo === "conflicto_version")) setConflicto(true); throw e; }
    }} /><button className="btn-glass" onClick={terminar}>Cerrar edición</button>
  </Panel>;
}
export function PiezaDetailPage() {
  const { piezaId = "" } = useParams(); const navegar = useNavigate(); const { puede } = usePermisos(); const op = useOperacion();
  const detalle = useRecurso<Ficha>("pieza", `/piezas/${piezaId}`); const catalogo = useCatalogoFicha();
  const auditoria = useRecurso<RegistroAuditoria[]>("auditoria-pieza", `/piezas/${piezaId}/auditoria`, !!detalle.data);
  const [original, setOriginal] = useState<Ficha | null>(null);
  const p = detalle.data;
  if (!p) return <div><Link to="/coleccion">← Volver a Colección</Link><ErrorConsulta error={detalle.error} />{detalle.isPending && <p>Cargando ficha…</p>}</div>;
  const enviar = (accion: string, motivoRechazo?: string) => op.ejecutar(() => api.patch(`/piezas/${piezaId}/estado-ficha`, { accion, motivoRechazo }));
  return <div className="space-y-6"><Link to="/coleccion" className="text-azul underline">← Volver a Colección</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-accent italic">{nombreFicha(p)}</h1><ChipEstadoFicha estado={p.estadoFicha} /></div>{!original && <button className="btn-primary" disabled={!puede("piezas.editar")} onClick={() => setOriginal(p)}>Editar ficha</button>}</div>
    <Aviso mensaje={op.mensaje} />{p.motivoRechazo && <p className="text-rojo">Motivo de rechazo: {p.motivoRechazo}</p>}<CamposFaltantes incompleta={p.incompleta} camposFaltantes={p.camposFaltantes} />
    <Panel titulo="Revisión de la ficha"><div className="flex flex-wrap gap-3">
      {["borrador", "rechazada"].includes(p.estadoFicha) && <button className="btn-primary" disabled={!puede("piezas.editar") || op.pendiente || p.incompleta || !!original} onClick={() => enviar("enviar_revision")}>Enviar a revisión</button>}
      {p.estadoFicha === "en_revision" && <><button className="btn-primary" disabled={!puede("piezas.aprobar_ficha") || op.pendiente || !!original} onClick={() => enviar("aprobar")}>Aprobar ficha</button><ConMotivo etiqueta="Rechazar ficha" pendiente={!puede("piezas.aprobar_ficha") || op.pendiente || !!original} ejecutar={(motivo) => enviar("rechazar", motivo)} /></>}
      {p.estadoFicha === "en_revision" && <button className="btn-glass" disabled={!puede("piezas.editar") || op.pendiente || !!original} onClick={() => enviar("volver_borrador")}>Volver a borrador</button>}
    </div>{p.incompleta && <p>Completa los datos pendientes para enviar la ficha a revisión.</p>}<p className="text-sm">Creada por {p.creadoPor?.nombre || "Sin responsable"} · {new Date(p.creadoEn).toLocaleString("es-PE")}<br />Última actualización: {p.actualizadoPor?.nombre || "Sin responsable"} · {new Date(p.actualizadoEn).toLocaleString("es-PE")}</p></Panel>
    {original && <EditorFicha original={original} terminar={() => setOriginal(null)} />}
    <Panel titulo="Ficha de inventario"><ErrorConsulta error={catalogo.error} /><dl className="grid gap-4 sm:grid-cols-2">{catalogo.data?.filter((c) => c.activo && (c.clave in p.campos || c.clave in p.listas)).map((c) => <div key={c.id} className="border-b border-linea pb-2 min-w-0"><dt className="font-semibold text-azul">{c.etiqueta}</dt><dd className="whitespace-pre-wrap break-words">{p.listas[c.clave] ? p.listas[c.clave].map((v) => v.etiqueta || "Sin etiqueta").join(", ") || "Sin dato" : p.etiquetas[c.clave] ?? (p.campos[c.clave] == null || p.campos[c.clave] === "" ? "Sin dato" : typeof p.campos[c.clave] === "object" ? JSON.stringify(p.campos[c.clave]) : String(p.campos[c.clave]))}</dd></div>)}</dl><CodigosFicha pieza={p} /></Panel>
    <ArchivosFicha piezaId={piezaId} /><ArchivosFicha piezaId={piezaId} documentos /><EstadoUbicacion key={piezaId} pieza={p} />
    {puede("ia.usar") && Boolean(p.campos.observaciones) && <Panel titulo="Revisión de observaciones"><p>La extracción genera una sugerencia que debe revisarse antes de aplicarse.</p><button className="btn-glass" disabled={op.pendiente} onClick={() => op.ejecutar(() => api.post(`/ia/extraccion-observaciones/${piezaId}`))}>Extraer datos de observaciones</button><Link className="text-azul underline" to="/asistente-ia">Revisar sugerencias en Asistente IA</Link></Panel>}
    <Panel titulo="Historial de cambios"><ErrorConsulta error={auditoria.error} /><ul className="space-y-2 text-sm">{auditoria.data?.map((r, i) => <li key={i} className="border-b border-linea pb-2"><p>{r.fecha ? new Date(r.fecha).toLocaleString("es-PE") : ""} · {r.accion} · {r.campo}</p><p className="break-words">{r.valorAnterior ?? "Sin dato"} → {r.valorNuevo ?? "Sin dato"}</p></li>)}</ul>{auditoria.data?.length === 0 && <p>Sin cambios registrados.</p>}</Panel>
    <Panel titulo="Baja de la pieza"><p>La ficha y sus historiales se conservan. La restauración está disponible en Administración.</p><ConMotivo etiqueta="Dar de baja" pendiente={!puede("piezas.baja") || op.pendiente || !!original} ejecutar={(motivo) => op.ejecutar(async () => { await api.post(`/piezas/${piezaId}/baja`, { motivo }); navegar("/coleccion"); })} /></Panel>
  </div>;
}
