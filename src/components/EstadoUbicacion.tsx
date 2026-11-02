import { useState } from "react";
import { usePermisos } from "../hooks/usePermisos";
import { api } from "../lib/api";
import { ubicacionesPlanas, type Ficha, type Ubicacion } from "../lib/ficha";
import type { ValorLista } from "../types";
import { Aviso, ErrorConsulta, Panel } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";

interface Historial { id: string; fecha: string; responsable: string; motivo: string | null; ubicacionAnterior?: string; ubicacionNueva?: string; estadoAnterior?: string; estadoNuevo?: string; }
export function EstadoUbicacion({ pieza }: { pieza: Ficha }) {
  const { puede, sesion } = usePermisos();
  const veUbicacion = Boolean(sesion) && !sesion?.camposOcultos.includes("ubicacion_actual_id");
  const veEstado = Boolean(sesion) && !sesion?.camposOcultos.includes("estado_pieza_id");
  const movimientos = useRecurso<Historial[]>("movimientos", `/piezas/${pieza.id}/movimientos`, veUbicacion);
  const estados = useRecurso<Historial[]>("estados", `/piezas/${pieza.id}/estados`, veEstado);
  const ubicaciones = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", veUbicacion);
  const lista = useRecurso<ValorLista[]>("estado-pieza", "/listas/estado_pieza/valores", veEstado);
  const tipos = useRecurso<ValorLista[]>("tipo-movimiento", "/listas/tipo_movimiento/valores", veUbicacion && puede("movimientos.registrar"));
  const [destino, setDestino] = useState(""); const [estado, setEstado] = useState("");
  const [motivoMov, setMotivoMov] = useState(""); const [motivoEst, setMotivoEst] = useState(""); const [tipo, setTipo] = useState("");
  const op = useOperacion();
  return <Panel titulo="Estado y ubicación"><Aviso mensaje={op.mensaje} />
    <p>Los cambios de estado y ubicación se registran por separado, con fecha y responsable.</p>
    {veUbicacion && !puede("movimientos.registrar") && <button className="btn-primary" disabled title="Tu rol solo puede consultar los movimientos">Registrar traslado</button>}
    {veEstado && !puede("estados.cambiar") && <button className="btn-primary" disabled title="Tu rol solo puede consultar los estados">Cambiar estado</button>}
    {veUbicacion && <div className="space-y-3"><h3 className="font-semibold">Ubicación actual: {pieza.etiquetas.ubicacion_actual_id || "Sin asignar"}</h3>
      {puede("movimientos.registrar") && <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => { await api.post(`/piezas/${pieza.id}/movimientos`, { ubicacionNuevaId: destino, motivo: motivoMov.trim() || null, tipoMovimientoId: tipo || null }); setDestino(""); setMotivoMov(""); }); }}>
        <label>Nueva ubicación<select aria-label="Nueva ubicación" required className="glass-input" value={destino} onChange={(e) => setDestino(e.target.value)}><option value="">Seleccionar…</option>{ubicacionesPlanas(ubicaciones.data ?? []).map((u) => <option key={u.id} value={u.id} disabled={u.id === pieza.campos.ubicacion_actual_id}>{u.etiqueta}</option>)}</select></label>
        <label>Tipo de movimiento<select aria-label="Tipo de movimiento" className="glass-input" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Sin especificar</option>{tipos.data?.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}</select></label>
        <label>Motivo del traslado<input className="glass-input" value={motivoMov} onChange={(e) => setMotivoMov(e.target.value)} /></label>
        <button className="btn-primary self-end" disabled={op.pendiente || !destino}>Registrar traslado</button>
      </form>}<ErrorConsulta error={ubicaciones.error || tipos.error} /><HistorialVista titulo="Historial de ubicaciones" registros={movimientos.data} error={movimientos.error} cargando={movimientos.isPending} />
    </div>}
    {veEstado && <div className="space-y-3 border-t border-linea pt-4"><h3 className="font-semibold">Estado actual: {pieza.etiquetas.estado_pieza_id || "Sin asignar"}</h3>
      {puede("estados.cambiar") && <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (motivoEst.trim()) op.ejecutar(async () => { await api.post(`/piezas/${pieza.id}/estados`, { estadoNuevoId: estado, motivo: motivoEst.trim() }); setEstado(""); setMotivoEst(""); }); }}>
        <label>Nuevo estado<select aria-label="Nuevo estado" required className="glass-input" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Seleccionar…</option>{lista.data?.map((s) => <option key={s.id} value={s.id} disabled={s.id === pieza.campos.estado_pieza_id}>{s.etiqueta}</option>)}</select></label>
        <label>Motivo del cambio de estado<input required className="glass-input" value={motivoEst} onChange={(e) => setMotivoEst(e.target.value)} /></label>
        <button className="btn-primary" disabled={op.pendiente || !estado || !motivoEst.trim()}>Cambiar estado</button>
      </form>}<ErrorConsulta error={lista.error} /><HistorialVista titulo="Historial de estados" registros={estados.data} error={estados.error} cargando={estados.isPending} />
    </div>}
  </Panel>;
}
function HistorialVista({ titulo, registros, error, cargando }: { titulo: string; registros?: Historial[]; error: unknown; cargando: boolean }) {
  return <div><h4 className="font-semibold">{titulo}</h4><ErrorConsulta error={error} />{cargando && <p>Cargando historial…</p>}
    <ol className="space-y-3 mt-2">{registros?.map((r) => <li key={r.id} className="border-l-2 border-linea pl-3 text-sm"><p>{r.ubicacionAnterior ?? r.estadoAnterior ?? "Sin asignar"} → {r.ubicacionNueva ?? r.estadoNuevo}</p><p>{r.motivo || "Sin motivo registrado"}</p><p className="text-gris-2">{new Date(r.fecha).toLocaleString("es-PE")} · {r.responsable}</p></li>)}</ol>{registros?.length === 0 && <p>Sin cambios registrados.</p>}</div>;
}
