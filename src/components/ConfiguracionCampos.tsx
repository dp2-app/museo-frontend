import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extraerMensajeError } from "../lib/api";
import type { CampoFicha, Rol, VisibilidadCampo } from "../types";

const VACIO = { clave: "", etiqueta: "", tipo: "texto", obligatorio: false, orden: 30, grupo: "Catalogación", vocabularioTipo: "" };
export function ConfiguracionCampos({ visibilidad = false }: { visibilidad?: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VACIO);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fields = useQuery({ queryKey: ["admin-campos-ficha"], queryFn: async () => (await api.get<CampoFicha[]>("/admin/campos-ficha")).data });
  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await api.get<Rol[]>("/roles")).data, enabled: visibilidad });
  const matrix = useQuery({ queryKey: ["visibilidad-campos"], queryFn: async () => (await api.get<VisibilidadCampo[]>("/admin/visibilidad-campos")).data, enabled: visibilidad });
  const changed = () => { setError(null); queryClient.invalidateQueries(); };
  const save = useMutation({ mutationFn: async () => {
    const body = { ...form, vocabularioTipo: form.tipo === "lista" ? form.vocabularioTipo : null };
    if (editing) { const { clave: _clave, ...updates } = body; return api.patch(`/admin/campos-ficha/${editing}`, updates); }
    return api.post("/admin/campos-ficha", body);
  }, onSuccess: () => { setForm(VACIO); setEditing(null); changed(); }, onError: e => setError(extraerMensajeError(e)) });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/admin/campos-ficha/${id}`, body), onSuccess: changed, onError: e => setError(extraerMensajeError(e)) });
  const policy = useMutation({ mutationFn: (body: { campoId: string; rolId: string; visible: boolean }) => api.put("/admin/visibilidad-campos", body), onSuccess: changed, onError: e => setError(extraerMensajeError(e)) });
  if (fields.isLoading || (visibilidad && (roles.isLoading || matrix.isLoading))) return <p>Cargando configuración...</p>;
  if (fields.isError || (visibilidad && (roles.isError || matrix.isError))) return <p role="alert" className="text-rojo">No se pudo cargar la configuración.</p>;
  if (visibilidad) return <section className="glass-panel p-5 space-y-4">
    <h3 className="section-title">Visibilidad por rol</h3><p className="text-sm text-gris-2">Los campos son visibles por defecto. Desmarca una casilla para restringir el campo a ese rol.</p>
    {error && <p role="alert" className="text-rojo">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Campo</th>{roles.data?.map(r => <th key={r.id} className="p-2">{r.nombre}</th>)}</tr></thead>
      <tbody>{fields.data?.filter(c => c.activo).map(c => <tr key={c.id} className="border-t border-linea"><td className="p-2">{c.etiqueta}</td>{roles.data?.map(r => {
        const visible = matrix.data?.find(v => v.campoId === c.id && v.rolId === r.id)?.visible ?? true;
        return <td key={r.id} className="text-center p-2"><input type="checkbox" aria-label={`${c.etiqueta} — ${r.nombre}`} checked={visible} disabled={policy.isPending} onChange={e => policy.mutate({ campoId: c.id, rolId: r.id, visible: e.target.checked })} /></td>;
      })}</tr>)}</tbody></table></div>
  </section>;
  return <section className="space-y-5">
    <form className="glass-panel p-5 space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
      <h3 className="section-title">{editing ? "Editar campo" : "Agregar campo"}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="form-label">Clave<input className="glass-input mt-1" required pattern="[a-z][a-z0-9_]{0,63}" disabled={!!editing} value={form.clave} onChange={e => setForm({ ...form, clave: e.target.value })} /></label>
        <label className="form-label">Etiqueta<input className="glass-input mt-1" required value={form.etiqueta} onChange={e => setForm({ ...form, etiqueta: e.target.value })} /></label>
        <label className="form-label">Tipo<select className="glass-input mt-1" value={form.tipo} disabled={!!editing && fields.data?.find(c => c.id === editing)?.almacenamiento !== "adicional"} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="texto">Texto</option><option value="numero">Número</option><option value="fecha">Fecha</option><option value="lista">Lista controlada</option></select></label>
        <label className="form-label">Grupo<input className="glass-input mt-1" required value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })} /></label>
        <label className="form-label">Orden<input className="glass-input mt-1" type="number" min="0" required value={form.orden} onChange={e => setForm({ ...form, orden: Number(e.target.value) })} /></label>
        {form.tipo === "lista" && <label className="form-label">Tipo de vocabulario<input className="glass-input mt-1" required placeholder="categoria, material..." value={form.vocabularioTipo} onChange={e => setForm({ ...form, vocabularioTipo: e.target.value })} /></label>}
      </div>
      <label className="flex gap-2"><input type="checkbox" checked={form.obligatorio} onChange={e => setForm({ ...form, obligatorio: e.target.checked })} />Obligatorio</label>
      {error && <p role="alert" className="text-rojo">{error}</p>}
      <div className="flex gap-3"><button className="btn-primary" disabled={save.isPending}>{editing ? "Guardar campo" : "Crear campo"}</button>{editing && <button type="button" className="btn-glass" onClick={() => { setEditing(null); setForm(VACIO); }}>Cancelar</button>}</div>
    </form>
    <div className="glass-panel overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Campo", "Tipo", "Grupo", "Orden", "Obligatorio", "Activo", ""].map((h,i) => <th key={i} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>
      {fields.data?.map(c => <tr key={c.id} className="border-t border-linea"><td className="p-3">{c.etiqueta}{c.esBase && <span className="chip ml-2">Base</span>}</td><td className="p-3">{c.tipo}</td><td className="p-3">{c.grupo}</td><td className="p-3">{c.orden}</td>
        <td className="p-3"><input aria-label={`Obligatorio: ${c.etiqueta}`} type="checkbox" checked={c.obligatorio} disabled={c.soloLectura || update.isPending} onChange={e => update.mutate({ id: c.id, body: { obligatorio: e.target.checked } })} /></td>
        <td className="p-3"><input aria-label={`Activo: ${c.etiqueta}`} type="checkbox" checked={c.activo} disabled={c.esBase || update.isPending} onChange={e => update.mutate({ id: c.id, body: { activo: e.target.checked } })} /></td>
        <td className="p-3"><button className="btn-glass" onClick={() => { setEditing(c.id); setForm({ clave:c.clave,etiqueta:c.etiqueta,tipo:c.tipo,obligatorio:c.obligatorio,orden:c.orden,grupo:c.grupo,vocabularioTipo:c.vocabularioTipo ?? "" }); }}>Editar</button></td>
      </tr>)}
    </tbody></table></div>
  </section>;
}
