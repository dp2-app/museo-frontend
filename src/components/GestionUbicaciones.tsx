import { useState } from "react";
import { Building2, MapPin, Pencil, Plus, Power } from "lucide-react";
import { api } from "../lib/api";
import { ubicacionesPlanas, type Ubicacion } from "../lib/ficha";
import { Aviso, ErrorConsulta, Panel } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";
import { UbicacionModal } from "./UbicacionModal";

export function GestionUbicaciones() {
  const lista = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", true, { incluirInactivas: true });
  const [editando, setEditando] = useState<Ubicacion | null>();
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [sedeFiltro, setSedeFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [textoFiltro, setTextoFiltro] = useState("");
  const op = useOperacion();
  const nodos = ubicacionesPlanas(lista.data ?? []);
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const visibles = nodos.filter(n =>
    (!tipoFiltro || n.nivelTipo === tipoFiltro) &&
    (!sedeFiltro || (n.nivelTipo === "sede" ? n.id : n.parentId) === sedeFiltro) &&
    (!estadoFiltro || n.activo === (estadoFiltro === "activa")) &&
    (!textoFiltro.trim() || normalizar(`${n.etiqueta} ${n.codigo ?? ""} ${n.direccion ?? ""}`).includes(normalizar(textoFiltro))));
  function seleccionar(n?: Ubicacion) { op.setMensaje(""); setEditando(n ?? null); }
  return <Panel titulo="Catálogo de sedes y ubicaciones"><p>Dos niveles: sede › ubicación. Incluye racks, cajas y estantes en el nombre de la ubicación.</p><ErrorConsulta error={lista.error} /><Aviso mensaje={op.mensaje} />
    <section aria-label="Filtros del catálogo" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="section-title">Filtrar catálogo</h3><button type="button" className="btn-primary" onClick={() => seleccionar()} aria-haspopup="dialog"><Plus size={18} aria-hidden="true" />Crear ubicación</button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0"><span className="form-label">Tipo</span><select className="glass-input" aria-label="Filtrar por tipo" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}><option value="">Todos los tipos</option><option value="sede">Sede</option><option value="ubicacion">Ubicación</option></select></label>
        <label className="min-w-0"><span className="form-label">Sede</span><select className="glass-input" aria-label="Filtrar por sede" value={sedeFiltro} onChange={e => setSedeFiltro(e.target.value)}><option value="">Todas las sedes</option>{(lista.data ?? []).map(n => <option key={n.id} value={n.id}>{n.nombre}{!n.activo && " (inactiva)"}</option>)}</select></label>
        <label className="min-w-0"><span className="form-label">Estado</span><select className="glass-input" aria-label="Filtrar por estado" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}><option value="">Todos los estados</option><option value="activa">Activa</option><option value="inactiva">Inactiva</option></select></label>
        <label className="min-w-0"><span className="form-label">Nombre, código o dirección</span><input type="search" className="glass-input" value={textoFiltro} onChange={e => setTextoFiltro(e.target.value)} placeholder="Buscar en el catálogo…" /></label>
      </div>
      <button type="button" className="btn-glass" disabled={!tipoFiltro && !sedeFiltro && !estadoFiltro && !textoFiltro} onClick={() => { setTipoFiltro(""); setSedeFiltro(""); setEstadoFiltro(""); setTextoFiltro(""); }}>Limpiar filtros</button>
    </section>
    {editando !== undefined && <UbicacionModal ubicacion={editando ?? undefined} alCerrar={() => setEditando(undefined)} alGuardar={() => op.setMensaje("Ubicación guardada.")} />}
    <p className="text-sm text-gris-2" role="status">{visibles.length} de {nodos.length} sedes y ubicaciones</p>
    <div className="location-catalog-scroll rounded-card border border-linea" role="region" aria-label="Catálogo de sedes y ubicaciones" tabIndex={0}>
      <table className="f0-table location-catalog-table"><caption className="sr-only">Sedes y ubicaciones, códigos, dirección, estado y acciones</caption>
        <colgroup><col className="w-[22%]" /><col className="w-[28%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col className="w-[10%]" /><col className="w-[10%]" /></colgroup>
        <thead><tr>{["Sede", "Ubicación", "Código", "Dirección", "Estado", "Acciones"].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead>
        <tbody>{visibles.map(n => { const sede = n.nivelTipo === "sede" ? n : nodos.find(p => p.id === n.parentId); return <tr key={n.id} className={n.nivelTipo === "sede" ? "bg-fondo-suave/60" : undefined}>
          <th scope="row"><span className="flex items-start gap-2"><Building2 size={17} className="shrink-0 mt-0.5 text-azul" aria-hidden="true" />{sede?.nombre ?? "Sin sede"}</span></th>
          <td>{n.nivelTipo === "sede" ? <span className="f0-badge">Sede</span> : <span className="flex items-start gap-2"><MapPin size={17} className="shrink-0 mt-0.5 text-gris-2" aria-hidden="true" />{n.nombre}</span>}</td>
          <td>{n.codigo || "—"}</td><td>{n.direccion || "—"}</td><td><span className={`f0-badge ${n.activo ? "f0-badge-active" : ""}`}>{n.activo ? "Activa" : "Inactiva"}</span></td>
          <td><div className="flex gap-1"><button type="button" className="f0-action" title={`Editar ${n.nombre}`} aria-label={`Editar ${n.nombre}`} onClick={() => seleccionar(n)}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="f0-action" disabled={op.pendiente} title={`${n.activo ? "Desactivar" : "Activar"} ${n.nombre}`} aria-label={`${n.activo ? "Desactivar" : "Activar"} ${n.nombre}`} onClick={() => op.ejecutar(() => api.patch(`/ubicaciones/${n.id}`, { activo: !n.activo }))}><Power size={18} aria-hidden="true" /></button></div></td>
        </tr>; })}</tbody>
      </table>
      {lista.isPending && <p role="status" className="p-4">Cargando sedes y ubicaciones…</p>}
      {!lista.isPending && !visibles.length && <p className="p-4 text-sm">No hay sedes o ubicaciones con estos filtros.</p>}
    </div>
  </Panel>;
}
