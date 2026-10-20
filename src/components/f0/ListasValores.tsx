import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extraerErroresApi, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { Equivalencia, TipoLista, ValorLista } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "./Comun";

function Equivalencias({ clave, valores }: { clave: string; valores: ValorLista[] }) {
  const puede = usePermisos().puede("importacion.configurar");
  const cache = useQueryClient();
  const [form, setForm] = useState({ textoOrigen: "", valorId: "", fuente: "", validado: false });
  const [aviso, setAviso] = useState("");
  const query = useQuery({ queryKey: ["f0", "equivalencias", clave], enabled: puede, queryFn: async () => (await api.get<Equivalencia[]>(`/listas/${clave}/equivalencias`)).data });
  const guardar = useMutation({ mutationFn: () => api.put(`/listas/${clave}/equivalencias`, { ...form, fuente: form.fuente || null }), onSuccess: () => { setAviso("Equivalencia guardada."); setForm({ textoOrigen: "", valorId: "", fuente: "", validado: false }); void cache.invalidateQueries({ queryKey: ["f0", "equivalencias", clave] }); } });
  if (!puede) return <p>La gestión de equivalencias requiere permiso para configurar la importación.</p>;
  const errores = erroresPorCampo(guardar.error);
  return <section className="glass-panel p-4 sm:p-6 space-y-4" aria-label="Equivalencias del Excel"><h3 className="section-title">Equivalencias del Excel</h3><p>Relaciona una variante histórica con su valor oficial. Guardar el mismo texto actualiza su equivalencia.</p>
    <EstadoConsulta cargando={query.isPending} error={query.error} reintentar={() => { void query.refetch(); }} />
    <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); guardar.mutate(); }}>
      <ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-3"><div><Etiqueta htmlFor="eq-texto">Texto del Excel</Etiqueta><input id="eq-texto" required className="glass-input" value={form.textoOrigen} onChange={(e) => setForm({ ...form, textoOrigen: e.target.value })} aria-invalid={Boolean(errores.textoOrigen)} /><ErrorCampo id="eq-texto-error" mensaje={errores.textoOrigen} /></div>
        <div><Etiqueta htmlFor="eq-valor">Valor oficial</Etiqueta><select id="eq-valor" required className="glass-input" value={form.valorId} onChange={(e) => setForm({ ...form, valorId: e.target.value })} aria-invalid={Boolean(errores.valorId)}><option value="">Seleccionar…</option>{valores.filter((v) => v.activo || v.id === form.valorId).map((v) => <option value={v.id} key={v.id}>{v.etiqueta}{!v.activo && " (inactivo)"}</option>)}</select><ErrorCampo id="eq-valor-error" mensaje={errores.valorId} /></div>
        <div><Etiqueta htmlFor="eq-fuente">Fuente</Etiqueta><input id="eq-fuente" className="glass-input" value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} /></div></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.validado} onChange={(e) => setForm({ ...form, validado: e.target.checked })} />Equivalencia validada</label><button className="btn-primary" disabled={guardar.isPending}>Guardar equivalencia</button>
    </form>
    {aviso && <p role="status">{aviso}</p>}
    <ul className="divide-y divide-linea">{query.data?.map((e) => <li key={e.id} className="py-3 flex flex-wrap items-center justify-between gap-3"><span>{e.textoOrigen} → <strong>{e.valorEtiqueta}</strong>{e.validado && " · Validada"}</span><button type="button" className="btn-glass" onClick={() => { guardar.reset(); setForm({ textoOrigen: e.textoOrigen, valorId: e.valorId, fuente: e.fuente ?? "", validado: e.validado }); }}>Editar equivalencia</button></li>)}</ul>
    {query.data?.length === 0 && <p>No hay equivalencias registradas.</p>}
  </section>;
}

function Valores({ lista }: { lista: TipoLista }) {
  const puede = usePermisos().puede("config.listas");
  const cache = useQueryClient();
  const [editado, setEditado] = useState<ValorLista | null>(null);
  const [form, setForm] = useState({ etiqueta: "", codigo: "", orden: 0 });
  const [aviso, setAviso] = useState("");
  const [conflicto, setConflicto] = useState<ValorLista | null>(null);
  const query = useQuery({ queryKey: ["f0", "valores", lista.clave], queryFn: async () => (await api.get<ValorLista[]>(`/listas/${lista.clave}/valores`, { params: { incluirInactivos: true } })).data });
  const actualizar = () => { void cache.invalidateQueries({ queryKey: ["f0"] }); };
  const guardar = useMutation({ mutationFn: () => editado ? api.patch(`/listas/${lista.clave}/valores/${editado.id}`, { ...form, codigo: form.codigo || null }) : api.post(`/listas/${lista.clave}/valores`, { ...form, codigo: form.codigo || null }), onSuccess: () => { setAviso(editado ? "Valor actualizado." : "Valor creado."); setForm({ etiqueta: "", codigo: "", orden: 0 }); setEditado(null); actualizar(); } });
  const activar = useMutation({ mutationFn: ({ valor, activo }: { valor: ValorLista; activo: boolean }) => api.patch(`/listas/${lista.clave}/valores/${valor.id}`, { activo }), onSuccess: () => { setAviso("Estado del valor actualizado."); setConflicto(null); eliminar.reset(); actualizar(); } });
  const eliminar = useMutation({ mutationFn: (valor: ValorLista) => api.delete(`/listas/${lista.clave}/valores/${valor.id}`), onSuccess: () => { setAviso("Valor retirado."); setConflicto(null); actualizar(); }, onError: (error, valor) => { if (extraerErroresApi(error).some((e) => ["valor_en_uso", "valor_de_sistema"].includes(e.codigo))) setConflicto(valor); } });
  const errores = erroresPorCampo(guardar.error);
  return <div className="space-y-5">
    <EstadoConsulta cargando={query.isPending} error={query.error} reintentar={() => { void query.refetch(); }} />
    <form aria-label="Gestionar valor" className="glass-panel p-4 sm:p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (puede) guardar.mutate(); }}><h3 className="section-title">{editado ? "Editar valor" : "Crear valor"}</h3><ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-3"><div><Etiqueta htmlFor="valor-etiqueta">Etiqueta del valor</Etiqueta><input id="valor-etiqueta" required className="glass-input" value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} aria-invalid={Boolean(errores.etiqueta)} aria-describedby="valor-etiqueta-error" /><ErrorCampo id="valor-etiqueta-error" mensaje={errores.etiqueta} /></div>
        <div><Etiqueta htmlFor="valor-codigo">Código del valor</Etiqueta><input id="valor-codigo" className="glass-input" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
        <div><Etiqueta htmlFor="valor-orden">Orden del valor</Etiqueta><input id="valor-orden" type="number" required className="glass-input" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div></div>
      <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={!puede || guardar.isPending}>Guardar valor</button>{editado && <button type="button" className="btn-glass" onClick={() => { setEditado(null); setForm({ etiqueta: "", codigo: "", orden: 0 }); guardar.reset(); }}>Cancelar edición</button>}</div>
    </form>
    {aviso && <p role="status">{aviso}</p>}
    <ErrorOperacion error={activar.error ?? eliminar.error} />
    {conflicto && <div className="glass-panel p-4 space-y-3"><p>«{conflicto.etiqueta}» está en uso o es un valor del sistema: desactívelo para conservar sus referencias.</p><button type="button" className="btn-glass" disabled={!puede || !conflicto.activo || activar.isPending} onClick={() => activar.mutate({ valor: conflicto, activo: false })}>Desactivar valor en uso</button></div>}
    <ul className="glass-panel divide-y divide-linea">{query.data?.map((v) => <li key={v.id} className="p-4 flex flex-wrap items-center justify-between gap-3"><div><strong>{v.etiqueta}</strong><span className="block">{v.activo ? "Activo" : "Inactivo"}{v.codigo && ` · ${v.codigo}`}</span></div><div className="flex flex-wrap gap-2">
      <button type="button" className="btn-glass" disabled={!puede} onClick={() => { setEditado(v); setForm({ etiqueta: v.etiqueta, codigo: v.codigo ?? "", orden: v.orden }); guardar.reset(); setAviso(""); }}>Editar</button>
      <button type="button" className="btn-glass" disabled={!puede || activar.isPending} onClick={() => activar.mutate({ valor: v, activo: !v.activo })}>{v.activo ? "Desactivar" : "Activar"}</button>
      <button type="button" className="btn-glass" disabled={!puede || eliminar.isPending} onClick={() => { setConflicto(null); setAviso(""); eliminar.mutate(v); }}>Eliminar</button>
    </div></li>)}{query.data?.length === 0 && <li className="p-4">Esta lista todavía no tiene valores.</li>}</ul>
    <Equivalencias clave={lista.clave} valores={query.data ?? []} />
  </div>;
}

export function ListasValores() {
  const [clave, setClave] = useState("");
  const query = useQuery({ queryKey: ["f0", "listas"], queryFn: async () => (await api.get<TipoLista[]>("/listas")).data });
  const seleccion = query.data?.find((l) => l.clave === clave);
  return <section className="space-y-5" aria-label="Listas de valores"><h2 className="section-title">Listas de valores</h2><p>Un valor en uso se desactiva para conservar la información histórica de las piezas.</p>
    <EstadoConsulta cargando={query.isPending} error={query.error} reintentar={() => { void query.refetch(); }} />
    <div><Etiqueta htmlFor="seleccionar-lista">Lista de valores</Etiqueta><select id="seleccionar-lista" className="glass-input" value={clave} onChange={(e) => setClave(e.target.value)}><option value="">Seleccionar una lista…</option>{query.data?.map((l) => <option key={l.id} value={l.clave}>{l.nombre}{!l.activo && " (inactiva)"}</option>)}</select></div>
    {seleccion ? <Valores key={seleccion.id} lista={seleccion} /> : <p>Selecciona una lista para consultar sus valores y equivalencias.</p>}
  </section>;
}
