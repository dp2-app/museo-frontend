import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { CampoFicha, TipoLista } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "./Comun";

const vacio = { clave: "", etiqueta: "", tipo: "texto", tipoListaId: "", multivalor: false, obligatorio: false, orden: 0, grupo: "Catalogación", ayuda: "", activo: true };
const nombresTipo: Record<string, string> = { texto: "Texto", numero: "Número", fecha: "Fecha", lista: "Lista", referencia: "Referencia" };

export function CamposFicha() {
  const permisos = usePermisos();
  const puede = permisos.puede("config.campos");
  const cache = useQueryClient();
  const [seleccionado, setSeleccionado] = useState<CampoFicha | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [aviso, setAviso] = useState("");
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (abierto) {
      editor.current?.scrollIntoView({ block: "start" });
      editor.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus({ preventScroll: true });
    }
  }, [abierto, seleccionado?.id]);
  const campos = useQuery({ queryKey: ["f0", "campos-admin"], enabled: puede, queryFn: async () => (await api.get<CampoFicha[]>("/config/campos-ficha")).data });
  const listas = useQuery({ queryKey: ["f0", "listas"], enabled: puede, queryFn: async () => (await api.get<TipoLista[]>("/listas")).data });
  const guardar = useMutation({
    mutationFn: async () => seleccionado
      ? api.patch(`/config/campos-ficha/${seleccionado.id}`, {
          etiqueta: form.etiqueta, obligatorio: form.obligatorio, orden: form.orden, grupo: form.grupo,
          ayuda: form.ayuda || null, ...(!seleccionado.esBase ? { activo: form.activo } : {}),
        })
      : api.post("/config/campos-ficha", {
          clave: form.clave, etiqueta: form.etiqueta, tipo: form.tipo,
          tipoListaId: form.tipo === "lista" ? form.tipoListaId || null : null,
          multivalor: form.tipo === "lista" && form.multivalor, obligatorio: form.obligatorio,
          orden: form.orden, grupo: form.grupo, ayuda: form.ayuda || null,
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
  if (!puede) return <p>No tienes permiso para configurar los campos de la ficha.</p>;
  if (campos.isPending || campos.isError || listas.isError) return <EstadoConsulta cargando={campos.isPending} error={campos.error ?? listas.error} reintentar={() => { void campos.refetch(); void listas.refetch(); }} />;
  const ordenados = [...(campos.data ?? [])].sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  const grupos = [...new Set(ordenados.map((c) => c.grupo))];
  return <section className="space-y-5" aria-label="Configuración de campos">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">Campos de la ficha</h2><p className="text-texto">Configura la información que recoge el museo.</p></div>
      <button type="button" className="btn-primary" onClick={() => abrir()}><Plus size={20} aria-hidden="true" />Crear campo adicional</button></div>
    <p className="rounded-card border border-linea bg-white p-4 text-texto">Denominación es obligatoria provisionalmente (P30 sin respuesta del museo).</p>
    {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}
    {abierto && <form ref={editor} onSubmit={enviar} className="scroll-mt-40 glass-panel p-4 sm:p-6 space-y-4" aria-label={seleccionado ? "Editar campo" : "Crear campo"}>
      <div className="flex items-center justify-between gap-2"><h3 className="section-title">{seleccionado ? `Editar: ${seleccionado.etiqueta}` : "Nuevo campo adicional"}</h3><button type="button" className="btn-glass" aria-label="Cerrar editor" onClick={() => setAbierto(false)}><X size={20} aria-hidden="true" /></button></div>
      <ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <div><Etiqueta htmlFor="f0-clave">Clave</Etiqueta><input id="f0-clave" className="glass-input" required disabled={Boolean(seleccionado)} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} aria-invalid={Boolean(errores.clave)} aria-describedby="f0-clave-ayuda f0-clave-error" /><p id="f0-clave-ayuda" className="mt-1 text-sm">Identificador del campo, por ejemplo: marca_taller.</p><ErrorCampo id="f0-clave-error" mensaje={errores.clave} /></div>
        <div><Etiqueta htmlFor="f0-etiqueta">Etiqueta</Etiqueta><input id="f0-etiqueta" className="glass-input" required value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} aria-invalid={Boolean(errores.etiqueta)} aria-describedby="f0-etiqueta-error" /><ErrorCampo id="f0-etiqueta-error" mensaje={errores.etiqueta} /></div>
        <div><Etiqueta htmlFor="f0-tipo">Tipo de campo</Etiqueta><select id="f0-tipo" className="glass-input" disabled={Boolean(seleccionado)} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, multivalor: false, tipoListaId: "" })}>{Object.entries(nombresTipo).filter(([k]) => k !== "referencia" || Boolean(seleccionado)).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select><ErrorCampo id="f0-tipo-error" mensaje={errores.tipo} /></div>
        <div><Etiqueta htmlFor="f0-grupo">Grupo</Etiqueta><input id="f0-grupo" className="glass-input" required value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })} aria-invalid={Boolean(errores.grupo)} /><ErrorCampo id="f0-grupo-error" mensaje={errores.grupo} /></div>
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
    {grupos.map((grupo) => <div key={grupo} className="glass-panel overflow-hidden"><h3 className="section-title p-4">{grupo}</h3><div className="overflow-x-auto" role="region" aria-label={`Campos de ${grupo}`} tabIndex={0}>
      <table className="w-full text-left text-sm"><thead className="bg-fondo-suave text-azul"><tr>{["Campo", "Tipo / lista", "Orden", "Obligatorio", "Estado", "Origen", "Acciones"].map((t) => <th scope="col" key={t} className="p-3">{t}</th>)}</tr></thead>
        <tbody>{ordenados.filter((c) => c.grupo === grupo).map((c) => <tr key={c.id} className="border-t border-linea"><th scope="row" className="p-3 font-semibold">{c.etiqueta}<span className="block text-sm font-normal">{c.clave}</span></th><td className="p-3">{nombresTipo[c.tipo] ?? c.tipo}{c.multivalor && " · múltiple"}{c.lista && <span className="block">{c.lista.nombre}</span>}</td><td className="p-3">{c.orden}</td><td className="p-3">{c.obligatorio ? "Sí" : "No"}</td><td className="p-3">{c.activo ? "Activo" : "Inactivo"}</td><td className="p-3">{c.esBase ? "Base" : "Adicional"}</td><td className="p-3"><button type="button" className="btn-glass" onClick={() => abrir(c)} aria-label={`Editar ${c.etiqueta}`}><Pencil size={20} aria-hidden="true" />Editar</button></td></tr>)}</tbody>
      </table></div></div>)}
    {!ordenados.length && <p>No hay campos configurados.</p>}
  </section>;
}
