import { useState } from "react";
import { api } from "../lib/api";
import { ubicacionesPlanas, type Ubicacion } from "../lib/ficha";
import { Aviso, ErrorConsulta, Panel } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";

export function GestionUbicaciones() {
  const lista = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", true, { incluirInactivas: true });
  const [id, setId] = useState(""); const [nivel, setNivel] = useState("sede"); const [padre, setPadre] = useState("");
  const [nombre, setNombre] = useState(""); const [codigo, setCodigo] = useState(""); const [direccion, setDireccion] = useState("");
  const op = useOperacion();
  const nodos = ubicacionesPlanas(lista.data ?? []);
  function seleccionar(n?: Ubicacion) { setId(n?.id ?? ""); setNivel(n?.nivelTipo ?? "sede"); setPadre(n?.parentId ?? ""); setNombre(n?.nombre ?? ""); setCodigo(n?.codigo ?? ""); setDireccion(n?.direccion ?? ""); }
  return <Panel titulo="Catálogo de sedes y ubicaciones"><p>Dos niveles: sede › ubicación. Incluye racks, cajas y estantes en el nombre de la ubicación.</p><ErrorConsulta error={lista.error} /><Aviso mensaje={op.mensaje} />
    <ul className="space-y-2">{nodos.map((n) => <li key={n.id} className="flex flex-wrap items-center gap-3"><span>{n.etiqueta}{!n.activo && " (inactiva)"}</span>
      <button className="btn-glass" onClick={() => seleccionar(n)}>Editar {n.nombre}</button><button className="btn-glass" disabled={op.pendiente} onClick={() => op.ejecutar(() => api.patch(`/ubicaciones/${n.id}`, { activo: !n.activo }))}>{n.activo ? "Desactivar" : "Activar"} {n.nombre}</button></li>)}</ul>
    <form className="grid gap-3 sm:grid-cols-2 border-t border-linea pt-4" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => {
      const datos = { nombre: nombre.trim(), codigo: codigo.trim() || null, direccion: direccion.trim() || null };
      if (id) await api.patch(`/ubicaciones/${id}`, datos); else await api.post("/ubicaciones", { ...datos, nivelTipo: nivel, parentId: nivel === "ubicacion" ? padre : null }); seleccionar();
    }); }}>
      <label>Nivel<select aria-label="Nivel" className="glass-input" disabled={!!id} value={nivel} onChange={(e) => setNivel(e.target.value)}><option value="sede">Sede</option><option value="ubicacion">Ubicación dentro de una sede</option></select></label>
      {nivel === "ubicacion" && <label>Sede<select aria-label="Sede" className="glass-input" required disabled={!!id} value={padre} onChange={(e) => setPadre(e.target.value)}><option value="">Seleccionar…</option>{lista.data?.filter((n) => n.activo).map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}</select></label>}
      <label>Nombre de ubicación<input required className="glass-input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Código de ubicación<input className="glass-input" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label>
      <label>Dirección<input className="glass-input" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2 items-end"><button className="btn-primary" disabled={op.pendiente || !nombre.trim()}>{id ? "Guardar ubicación" : "Crear ubicación"}</button>{id && <button type="button" className="btn-glass" onClick={() => seleccionar()}>Cancelar edición</button>}</div>
    </form>
  </Panel>;
}
