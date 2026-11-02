import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X, Search, Info } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { CampoFicha, TipoLista } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "./Comun";
import { SelectorGrupo } from "./SelectorGrupo";

const vacio = { clave: "", etiqueta: "", tipo: "texto", tipoListaId: "", multivalor: false, obligatorio: false, orden: 0, grupo: "Catalogación", ayuda: "", activo: true };
const nombresTipo: Record<string, string> = { texto: "Texto", numero: "Número", fecha: "Fecha", lista: "Lista", referencia: "Referencia" };

export function CamposFicha() {
  const permisos = usePermisos();
  const puedeVer = permisos.puede("config.campos.ver");
  const puede = permisos.puede("config.campos"); // editar
  const cache = useQueryClient();
  const [seleccionado, setSeleccionado] = useState<CampoFicha | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (abierto) {
      editor.current?.scrollIntoView({ block: "start" });
      editor.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus({ preventScroll: true });
    }
  }, [abierto, seleccionado?.id]);
  const campos = useQuery({ queryKey: ["f0", "campos-admin"], enabled: puedeVer, queryFn: async () => (await api.get<CampoFicha[]>("/config/campos-ficha")).data });
  const listas = useQuery({ queryKey: ["f0", "listas"], enabled: puedeVer, queryFn: async () => (await api.get<TipoLista[]>("/listas")).data });
  const guardar = useMutation({
    mutationFn: async () => seleccionado
      ? api.patch(`/config/campos-ficha/${seleccionado.id}`, {
          etiqueta: form.etiqueta, obligatorio: form.obligatorio, orden: form.orden, grupo: form.grupo.trim(),
          ayuda: form.ayuda || null, ...(!seleccionado.esBase ? { activo: form.activo } : {}),
        })
      : api.post("/config/campos-ficha", {
          clave: form.clave, etiqueta: form.etiqueta, tipo: form.tipo,
          tipoListaId: form.tipo === "lista" ? form.tipoListaId || null : null,
          multivalor: form.tipo === "lista" && form.multivalor, obligatorio: form.obligatorio,
          orden: form.orden, grupo: form.grupo.trim(), ayuda: form.ayuda || null,
        }),
    onSuccess: () => {
      setAviso(seleccionado ? "Campo actualizado. La vista previa ya usa esta configuración." : "Campo creado. Ya está disponible en la vista previa.");
      setAbierto(false); setSeleccionado(null); setForm(vacio);
      void cache.invalidateQueries({ queryKey: ["f0"] });
    },
  });
  const errores = erroresPorCampo(guardar.error);
  function abrir(campo?: CampoFicha) {
    guardar.reset(); setAviso(""); setSeleccionado(campo ?? null); setAbierto(true);
    setForm(campo ? { clave: campo.clave, etiqueta: campo.etiqueta, tipo: campo.tipo, tipoListaId: campo.lista?.id ?? "", multivalor: campo.multivalor, obligatorio: campo.obligatorio, orden: campo.orden, grupo: campo.grupo, ayuda: campo.ayuda ?? "", activo: campo.activo } : vacio);
  }
  function enviar(e: FormEvent) { e.preventDefault(); if (puede) guardar.mutate(); }
  if (!puedeVer) return <p>No tienes permiso para ver los campos de la ficha.</p>;
  if (campos.isPending || campos.isError || listas.isError) return <EstadoConsulta cargando={campos.isPending} error={campos.error ?? listas.error} reintentar={() => { void campos.refetch(); void listas.refetch(); }} />;
  const ordenados = [...(campos.data ?? [])].sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  const visibles = ordenados.filter((c) =>
    `${c.etiqueta} ${c.clave} ${c.grupo}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase().trim()) &&
    (estado === "todos" || (estado === "activos" ? c.activo : !c.activo)));
  const grupos = [...new Set(visibles.map((c) => c.grupo))];
  return <section className="space-y-5" aria-label="Configuración de campos">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">Campos de la ficha</h2><p className="text-texto">{puede ? "Configura la información que recoge el museo." : "Consulta la información que recoge el museo. Tu rol no puede modificarla."}</p></div>
      {puede && <button type="button" className="btn-primary" onClick={() => abrir()}><Plus size={20} aria-hidden="true" />Crear campo adicional</button>}</div>
    <p className="f0-notice"><Info size={20} className="shrink-0 mt-0.5" aria-hidden="true" /><span>Denominación es obligatoria provisionalmente (P30 sin respuesta del museo).</span></p>
    {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}
    {abierto && <form ref={editor} onSubmit={enviar} className="scroll-mt-40 glass-panel p-4 sm:p-6 space-y-4" aria-label={seleccionado ? "Editar campo" : "Crear campo"}>
      <div className="flex items-center justify-between gap-2"><h3 className="section-title">{seleccionado ? `Editar: ${seleccionado.etiqueta}` : "Nuevo campo adicional"}</h3><button type="button" className="btn-glass" aria-label="Cerrar editor" onClick={() => setAbierto(false)}><X size={20} aria-hidden="true" /></button></div>
      <ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <div><Etiqueta htmlFor="f0-clave">Clave</Etiqueta><input id="f0-clave" className="glass-input" required disabled={Boolean(seleccionado)} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} aria-invalid={Boolean(errores.clave)} aria-describedby="f0-clave-ayuda f0-clave-error" /><p id="f0-clave-ayuda" className="mt-1 text-sm">Identificador del campo, por ejemplo: marca_taller.</p><ErrorCampo id="f0-clave-error" mensaje={errores.clave} /></div>
        <div><Etiqueta htmlFor="f0-etiqueta">Etiqueta</Etiqueta><input id="f0-etiqueta" className="glass-input" required value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} aria-invalid={Boolean(errores.etiqueta)} aria-describedby="f0-etiqueta-error" /><ErrorCampo id="f0-etiqueta-error" mensaje={errores.etiqueta} /></div>
        <div><Etiqueta htmlFor="f0-tipo">Tipo de campo</Etiqueta><select id="f0-tipo" className="glass-input" disabled={Boolean(seleccionado)} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, multivalor: false, tipoListaId: "" })}>{Object.entries(nombresTipo).filter(([k]) => k !== "referencia" || Boolean(seleccionado)).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select><ErrorCampo id="f0-tipo-error" mensaje={errores.tipo} /></div>
        <SelectorGrupo key={seleccionado?.id ?? "nuevo"} grupo={form.grupo} grupos={ordenados.map((campo) => campo.grupo)} cambiar={(grupo) => setForm({ ...form, grupo })} error={errores.grupo} />
        <div><Etiqueta htmlFor="f0-orden">Orden</Etiqueta><input id="f0-orden" className="glass-input" type="number" required value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /><ErrorCampo id="f0-orden-error" mensaje={errores.orden} /></div>
        {form.tipo === "lista" && <div><Etiqueta htmlFor="f0-lista">Lista asociada</Etiqueta><select id="f0-lista" className="glass-input" required disabled={Boolean(seleccionado)} value={form.tipoListaId} onChange={(e) => setForm({ ...form, tipoListaId: e.target.value })}><option value="">Seleccionar lista…</option>{listas.data?.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select><ErrorCampo id="f0-lista-error" mensaje={errores.tipoListaId} /></div>}
        <div className="md:col-span-2"><Etiqueta htmlFor="f0-ayuda">Texto de ayuda</Etiqueta><textarea id="f0-ayuda" className="glass-input" value={form.ayuda} onChange={(e) => setForm({ ...form, ayuda: e.target.value })} /></div>
      </div>
      <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={form.obligatorio} onChange={(e) => setForm({ ...form, obligatorio: e.target.checked })} />Obligatorio</label>
        {form.tipo === "lista" && <label className="flex items-center gap-2"><input type="checkbox" checked={form.multivalor} disabled={Boolean(seleccionado)} onChange={(e) => setForm({ ...form, multivalor: e.target.checked })} />Permite varios valores</label>}
        {seleccionado && !seleccionado.esBase && <label className="flex items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Campo activo</label>}
      </div>
      {seleccionado?.esBase && <p>Este campo es base: puedes ajustar su configuración, pero no desactivarlo.</p>}
      <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? "Guardando…" : "Guardar campo"}</button><button type="button" className="btn-glass" onClick={() => setAbierto(false)}>Cancelar</button></div>
    </form>}
    <div className="f0-catalogue">
      <div className="f0-toolbar">
        <div className="relative flex-1 min-w-0"><Search size={20} className="absolute left-3 top-3 text-texto/60 pointer-events-none" aria-hidden="true" /><input className="glass-input !pl-10" type="search" aria-label="Buscar campos" placeholder="Buscar por nombre, clave o grupo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        <select className="glass-input sm:!w-auto" aria-label="Filtrar campos por estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="todos">Todos los estados</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select>
      </div>
      <p className="px-4 pb-4 text-sm text-texto/70" role="status">{visibles.length} de {ordenados.length} campos · {ordenados.filter((c) => c.activo && c.obligatorio).length} obligatorios activos</p>
      <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Catálogo de campos" tabIndex={0}>
        <table className="f0-table"><thead><tr>{["Campo", "Tipo / lista", "Orden", "Obligatorio", "Estado", "Acciones"].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
          {grupos.map((grupo) => <tbody key={grupo}>
            <tr className="f0-group"><th scope="rowgroup" colSpan={6}>{grupo}<span className="ml-2 font-normal text-texto/60">{visibles.filter((c) => c.grupo === grupo).length}</span></th></tr>
            {visibles.filter((c) => c.grupo === grupo).map((c) => <tr key={c.id}>
              <th scope="row" className="font-semibold"><span>{c.etiqueta}</span><span className="block text-xs font-normal text-texto/60 mt-1">{c.clave} · {c.esBase ? "Base" : "Adicional"}</span></th>
              <td>{nombresTipo[c.tipo] ?? c.tipo}{c.multivalor && " · múltiple"}{c.lista && <span className="block text-xs text-texto/60 mt-1">{c.lista.nombre}</span>}</td>
              <td>{c.orden}</td><td>{c.obligatorio ? <span className="font-semibold">Sí</span> : <span className="text-texto/60">No</span>}</td>
              <td><span className={`f0-badge ${c.activo ? "f0-badge-active" : ""}`}><span className="h-1 w-1 rounded-pill bg-current" />{c.activo ? "Activo" : "Inactivo"}</span></td>
              <td>{puede && <button type="button" className="f0-action" onClick={() => abrir(c)} aria-label={`Editar ${c.etiqueta}`}><Pencil size={20} aria-hidden="true" /><span className="sr-only">Editar</span></button>}</td>
            </tr>)}
          </tbody>)}
        </table>
      </div>
      {!visibles.length && ordenados.length > 0 && <div className="p-8 text-center"><p className="font-semibold text-azul">No se encontraron campos</p><p className="mt-2 text-sm">Prueba otro nombre o cambia el filtro de estado.</p><button type="button" className="f0-action mt-4" onClick={() => { setBusqueda(""); setEstado("todos"); }}>Limpiar filtros</button></div>}
    </div>
    {!ordenados.length && <p>No hay campos configurados.</p>}
  </section>;
}
