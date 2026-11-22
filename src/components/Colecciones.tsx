import { useState } from "react";
import { api } from "../lib/api";
import { type Ficha, nombreFicha } from "../lib/ficha";
import { FotoPieza } from "./SistemaVisual";
import { Aviso, ConMotivo, ErrorConsulta, Panel } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";

export interface ColeccionFicha { id: string; nombre: string; prefijoCodigo: string | null; descripcion: string | null; }
/** Gestionar colecciones (#119): la lista a la izquierda y, al elegir una o pulsar «Nueva colección», su panel a la derecha. */
export function Colecciones() {
  const lista = useRecurso<ColeccionFicha[]>("colecciones", "/colecciones");
  const [id, setId] = useState(""); const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(""); const [prefijo, setPrefijo] = useState(""); const [descripcion, setDescripcion] = useState(""); const [sub, setSub] = useState("");
  const subs = useRecurso<{ id: string; nombre: string }[]>("subcolecciones", `/colecciones/${id}/subcolecciones`, !!id);
  const op = useOperacion();
  function seleccionar(c?: ColeccionFicha, nueva = false) { setId(c?.id ?? ""); setNombre(c?.nombre ?? ""); setPrefijo(c?.prefijoCodigo ?? ""); setDescripcion(c?.descripcion ?? ""); setSub(""); setAbierto(Boolean(c) || nueva); }
  return <Panel titulo="Colecciones y subcolecciones"><ErrorConsulta error={lista.error || subs.error} /><Aviso mensaje={op.mensaje} />
    <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => seleccionar(undefined, true)}>Nueva colección</button></div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="sr-only">Colecciones del museo</caption>
        <thead className="text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Prefijo</th><th className="px-3 py-2">Descripción</th><th className="px-3 py-2"><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody className="divide-y divide-linea">{lista.data?.map((c) => <tr key={c.id} className={c.id === id ? "bg-fondo-suave" : undefined}>
          <td className="px-3 py-2 font-semibold">{c.nombre}</td><td className="px-3 py-2">{c.prefijoCodigo ?? "—"}</td><td className="px-3 py-2 text-gris-2">{c.descripcion ?? "—"}</td>
          <td className="px-3 py-2"><button type="button" className="text-azul underline font-semibold" aria-label={`Editar ${c.nombre}`} onClick={() => seleccionar(c)}>Editar</button></td></tr>)}</tbody></table>
        {lista.data?.length === 0 && <p className="p-3 text-sm">Aún no hay colecciones.</p>}</div>
      {abierto && <aside className="rounded-card border border-linea p-4 space-y-4" aria-label={id ? `Colección ${nombre}` : "Nueva colección"}>
        <h3 className="section-title">{id ? "Editar colección" : "Nueva colección"}</h3>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => { const datos = { nombre: nombre.trim(), prefijoCodigo: prefijo.trim() || null, descripcion: descripcion.trim() || null }; if (id) await api.patch(`/colecciones/${id}`, datos); else await api.post("/colecciones", datos); seleccionar(); }); }}>
          <label className="block">Nombre de colección<input required className="glass-input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label className="block">Prefijo del código<input className="glass-input" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} /></label>
          <label className="block">Descripción de colección<textarea className="glass-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
          <div className="flex gap-2"><button className="btn-primary" disabled={op.pendiente || !nombre.trim()}>{id ? "Guardar colección" : "Crear colección"}</button><button type="button" className="btn-glass" onClick={() => seleccionar()}>Cerrar</button></div>
        </form>
        {id && <>
          <div><h4 className="font-semibold">Subcolecciones</h4>{subs.data?.length ? <ul className="list-disc pl-5 text-sm">{subs.data.map((x) => <li key={x.id}>{x.nombre}</li>)}</ul> : <p className="text-sm text-gris-2">Ninguna</p>}</div>
          <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => { await api.post(`/colecciones/${id}/subcolecciones`, { nombre: sub.trim() }); setSub(""); await subs.refetch(); }); }}>
            <label className="flex-1 min-w-40">Nombre de subcolección<input required className="glass-input" value={sub} onChange={(e) => setSub(e.target.value)} /></label>
            <button className="btn-glass" disabled={op.pendiente || !sub.trim()}>Agregar subcolección</button></form>
          <p className="text-sm">Solo se puede dar de baja una colección sin piezas activas.</p>
          <button className="btn-glass" disabled={op.pendiente} onClick={() => op.ejecutar(async () => { await api.post(`/colecciones/${id}/baja`); seleccionar(); })}>Dar de baja colección {nombre}</button></>}
      </aside>}
    </div>
  </Panel>;
}
/** `GET /piezas/eliminadas` trae además la última baja (museo-backend, F2-P7). */
type FichaDadaDeBaja = Ficha & { baja?: { motivo: string | null; fecha: string; responsable: string | null } | null };
export function PiezasBaja() {
  const lista = useRecurso<FichaDadaDeBaja[]>("piezas-baja", "/piezas/eliminadas"); const op = useOperacion();
  return <Panel titulo="Piezas dadas de baja"><ErrorConsulta error={lista.error} /><Aviso mensaje={op.mensaje} />{lista.isPending && <p>Cargando…</p>}
    <ul className="space-y-4">{lista.data?.map((p) => <li key={p.id} className="retired-piece-row"><div className="retired-piece-photo"><FotoPieza url={p.fotoPrincipal?.url} nombre={nombreFicha(p)} /></div><div className="min-w-0 flex-1 space-y-3"><p className="font-semibold break-words">{nombreFicha(p)}{p.codigos.length > 0 && ` · ${p.codigos.map((c) => c.valor).join(", ")}`}</p>
      {/* frontend#61 P7: quién, cuándo y por qué se dio de baja, para decidir si restaurar */}
      {p.baja ? <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3"><dt className="text-gris-2">Motivo</dt><dd>{p.baja.motivo || "Sin motivo registrado"}</dd>
        <dt className="text-gris-2">Fecha</dt><dd>{new Date(p.baja.fecha).toLocaleString("es-PE")}</dd>
        <dt className="text-gris-2">Responsable</dt><dd>{p.baja.responsable || "Sin responsable registrado"}</dd></dl>
        : <p className="text-sm text-gris-2">Sin registro de la baja en la auditoría.</p>}<ConMotivo etiqueta="Restaurar" pendiente={op.pendiente} ejecutar={(motivo) => op.ejecutar(() => api.post(`/piezas/${p.id}/restaurar`, { motivo }))} /></div></li>)}</ul>{lista.data?.length === 0 && <p>No hay piezas dadas de baja.</p>}
  </Panel>;
}
