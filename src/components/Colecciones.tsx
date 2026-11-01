import { useState } from "react";
import { api } from "../lib/api";
import { type Ficha, nombreFicha } from "../lib/ficha";
import { Aviso, ConMotivo, ErrorConsulta, Panel } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";

export interface ColeccionFicha { id: string; nombre: string; prefijoCodigo: string | null; descripcion: string | null; }
export function Colecciones() {
  const lista = useRecurso<ColeccionFicha[]>("colecciones", "/colecciones");
  const [id, setId] = useState(""); const [nombre, setNombre] = useState(""); const [prefijo, setPrefijo] = useState(""); const [descripcion, setDescripcion] = useState(""); const [sub, setSub] = useState("");
  const subs = useRecurso<{ id: string; nombre: string }[]>("subcolecciones", `/colecciones/${id}/subcolecciones`, !!id);
  const op = useOperacion();
  function seleccionar(c?: ColeccionFicha) { setId(c?.id ?? ""); setNombre(c?.nombre ?? ""); setPrefijo(c?.prefijoCodigo ?? ""); setDescripcion(c?.descripcion ?? ""); }
  return <Panel titulo="Colecciones y subcolecciones"><ErrorConsulta error={lista.error || subs.error} /><Aviso mensaje={op.mensaje} />
    <div className="flex flex-wrap gap-2">{lista.data?.map((c) => <button className="btn-glass" key={c.id} onClick={() => seleccionar(c)}>{c.nombre}</button>)}</div>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => { const datos = { nombre: nombre.trim(), prefijoCodigo: prefijo.trim() || null, descripcion: descripcion.trim() || null }; if (id) await api.patch(`/colecciones/${id}`, datos); else await api.post("/colecciones", datos); seleccionar(); }); }}>
      <label>Nombre de colección<input required className="glass-input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Prefijo del código<input className="glass-input" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} /></label>
      <label>Descripción de colección<textarea className="glass-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
      <div className="flex gap-2 items-end"><button className="btn-primary" disabled={op.pendiente || !nombre.trim()}>{id ? "Guardar colección" : "Crear colección"}</button>{id && <button type="button" className="btn-glass" onClick={() => seleccionar()}>Nueva colección</button>}</div>
    </form>
    {id && <><p>Subcolecciones: {subs.data?.map((s) => s.nombre).join(", ") || "Ninguna"}</p><form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => { await api.post(`/colecciones/${id}/subcolecciones`, { nombre: sub.trim() }); setSub(""); }); }}><label>Nombre de subcolección<input required className="glass-input" value={sub} onChange={(e) => setSub(e.target.value)} /></label><button className="btn-glass" disabled={op.pendiente || !sub.trim()}>Crear subcolección</button></form>
      <p>Solo se puede dar de baja una colección sin piezas activas.</p><button className="btn-glass" disabled={op.pendiente} onClick={() => op.ejecutar(async () => { await api.post(`/colecciones/${id}/baja`); seleccionar(); })}>Dar de baja colección {nombre}</button></>}
  </Panel>;
}
export function PiezasBaja() {
  const lista = useRecurso<Ficha[]>("piezas-baja", "/piezas/eliminadas"); const op = useOperacion();
  return <Panel titulo="Piezas dadas de baja"><ErrorConsulta error={lista.error} /><Aviso mensaje={op.mensaje} />{lista.isPending && <p>Cargando…</p>}
    <ul className="space-y-4">{lista.data?.map((p) => <li key={p.id} className="border-b border-linea pb-4"><p className="font-semibold">{nombreFicha(p)} · {p.codigos.map((c) => c.valor).join(", ")}</p><ConMotivo etiqueta="Restaurar" pendiente={op.pendiente} ejecutar={(motivo) => op.ejecutar(() => api.post(`/piezas/${p.id}/restaurar`, { motivo }))} /></li>)}</ul>{lista.data?.length === 0 && <p>No hay piezas dadas de baja.</p>}
  </Panel>;
}
