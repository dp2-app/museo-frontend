import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FormularioFicha } from "../components/f0/FormularioFicha";
import { Colecciones, type ColeccionFicha } from "../components/Colecciones";
import { ErrorConsulta, Panel } from "../components/FichaComun";
import { useRecurso } from "../lib/recursosFicha";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { AltaComplementos, type Complementos } from "../components/IdentificacionFicha";
import { AccesosF1 } from "../components/f1/PendienteCodigoI";
import { usePermisos } from "../hooks/usePermisos";
import { api } from "../lib/api";
import { nombreFicha, type Ficha } from "../lib/ficha";
import type { Pagina } from "../types";

export function PiezasPage() {
  const { puede } = usePermisos(); const navegar = useNavigate(); const cache = useQueryClient();
  const [nueva, setNueva] = useState(false); const [complementos, setComplementos] = useState<Complementos>({ codigos: [] });
  const [q, setQ] = useState(""); const [codigo, setCodigo] = useState(""); const [coleccion, setColeccion] = useState(""); const [estado, setEstado] = useState(""); const [incompletas, setIncompletas] = useState(false);
  const [pagina, setPagina] = useState(1); const [filtros, setFiltros] = useState<Record<string, unknown>>({});
  const piezas = useRecurso<Pagina<Ficha>>("piezas", "/piezas", true, { ...filtros, pagina, tamano: 20 });
  const colecciones = useRecurso<ColeccionFicha[]>("colecciones", "/colecciones");
  return <div className="space-y-6"><h1>Colección</h1><p>Registra piezas y completa las fichas del inventario.</p>
    <AccesosF1 />
    {puede("colecciones.gestionar") && <details><summary className="cursor-pointer font-semibold">Gestionar colecciones</summary><Colecciones /></details>}
    <button className="btn-primary" disabled={!puede("piezas.crear")} title={!puede("piezas.crear") ? "Tu rol no puede registrar piezas" : undefined} onClick={() => setNueva(!nueva)}>{nueva ? "Cancelar registro" : "Registrar pieza"}</button>
    {nueva && <Panel titulo="Nueva pieza"><AltaComplementos onChange={setComplementos} /><FormularioFicha onGuardar={async (datos) => { const p = (await api.post<Ficha>("/piezas", { ...datos, ...complementos })).data; await cache.invalidateQueries(); navegar(`/coleccion/${p.id}`); }} /></Panel>}
    <form className="glass-panel p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setPagina(1); setFiltros({ q: q || undefined, codigo: codigo || undefined, coleccionId: coleccion || undefined, estadoFicha: estado || undefined, soloIncompletas: incompletas }); }}>
      <label>Texto de la ficha<input className="glass-input" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label>Código<input className="glass-input" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label>
      <label>Colección<select aria-label="Colección" className="glass-input" value={coleccion} onChange={(e) => setColeccion(e.target.value)}><option value="">Todas</option>{colecciones.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <label>Estado de ficha<select aria-label="Estado de ficha" className="glass-input" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option><option value="borrador">Borrador</option><option value="en_revision">En revisión</option><option value="aprobada">Aprobada</option><option value="rechazada">Rechazada</option></select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={incompletas} onChange={(e) => setIncompletas(e.target.checked)} />Solo incompletas</label><button className="btn-primary">Buscar</button>
    </form><ErrorConsulta error={piezas.error || colecciones.error} />{piezas.isPending && <p>Cargando piezas…</p>}
    <div className="glass-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-4">Pieza / códigos</th><th className="p-4">Colección</th><th className="p-4">Ficha</th><th className="p-4">Información</th></tr></thead>
      <tbody>{piezas.data?.items.map((p) => <tr key={p.id} className="border-t border-linea"><td className="p-4"><Link className="text-azul underline font-semibold" to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link><p>{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</p></td><td className="p-4">{p.etiquetas.coleccion_id || "Sin colección"}</td><td className="p-4"><ChipEstadoFicha estado={p.estadoFicha} /></td><td className="p-4">{p.incompleta ? "Por completar" : "Completa"}</td></tr>)}</tbody></table>
      {piezas.data?.total === 0 && <p className="p-4">No se encontraron piezas.</p>}
    </div><div className="flex flex-wrap gap-3 items-center"><button className="btn-glass" disabled={pagina === 1 || piezas.isFetching} onClick={() => setPagina(pagina - 1)}>Anterior</button><p>Página {pagina} · {piezas.data?.total ?? 0} piezas</p><button className="btn-glass" disabled={!piezas.data || pagina * 20 >= piezas.data.total || piezas.isFetching} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>
  </div>;
}
