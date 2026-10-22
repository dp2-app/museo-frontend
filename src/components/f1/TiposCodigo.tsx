import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Lock, Pencil, Plus, X } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { useTiposCodigo } from "../../hooks/useCatalogosF1";
import type { TipoCodigo } from "../../types/f1";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "../f0/Comun";

const vacio = { clave: "", nombre: "", descripcion: "", patron: "", esUnico: false, inmutable: false, esCorrelativo: false, permiteMultiples: false, orden: 0, activo: true };
type Form = typeof vacio;

const REGLAS: { clave: "esUnico" | "inmutable" | "esCorrelativo" | "permiteMultiples"; etiqueta: string; ayuda: string }[] = [
  { clave: "esUnico", etiqueta: "Único", ayuda: "Dos piezas no pueden tener el mismo valor (se compara normalizado: I-00001 = i 1)." },
  { clave: "inmutable", etiqueta: "Inmutable", ayuda: "Queda bloqueado al guardarse; solo se corrige por excepción (RF-05)." },
  { clave: "esCorrelativo", etiqueta: "Correlativo", ayuda: "La ficha sugiere el número siguiente al mayor registrado; no rellena huecos." },
  { clave: "permiteMultiples", etiqueta: "Permite varios por pieza", ayuda: "Una pieza puede tener más de un código de este tipo." },
];

/** RF-55: tipos de código y sus reglas. Un tipo en uso solo se desactiva (D7); endurecer una regla revalida los datos (D8). */
export function TiposCodigo() {
  const puede = usePermisos().puede("config.codigos_tenencia");
  const cache = useQueryClient();
  const tipos = useTiposCodigo(true);
  const [editado, setEditado] = useState<TipoCodigo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<Form>(vacio);
  const [aviso, setAviso] = useState("");

  const guardar = useMutation({
    mutationFn: async () => {
      const comun = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, patron: form.patron.trim() || null,
        esUnico: form.esUnico, inmutable: form.inmutable, esCorrelativo: form.esCorrelativo, permiteMultiples: form.permiteMultiples, orden: form.orden };
      return editado
        ? api.patch(`/config/tipos-codigo/${editado.id}`, { ...comun, ...(editado.esPrincipal ? {} : { activo: form.activo }) })
        : api.post("/config/tipos-codigo", { ...comun, clave: form.clave.trim() });
    },
    onSuccess: () => {
      setAviso(editado ? "Tipo de código actualizado." : "Tipo de código creado. Ya se ofrece en la ficha.");
      cerrar();
      void cache.invalidateQueries({ queryKey: ["f1"] });
    },
  });
  const errores = erroresPorCampo(guardar.error);

  function abrir(tipo?: TipoCodigo) {
    guardar.reset(); setAviso(""); setEditado(tipo ?? null); setAbierto(true);
    setForm(tipo ? { clave: tipo.clave, nombre: tipo.nombre, descripcion: tipo.descripcion ?? "", patron: tipo.patron ?? "", esUnico: tipo.esUnico,
      inmutable: tipo.inmutable, esCorrelativo: tipo.esCorrelativo, permiteMultiples: tipo.permiteMultiples, orden: tipo.orden, activo: tipo.activo }
      : { ...vacio, orden: Math.max(0, ...(tipos.data ?? []).map((t) => t.orden)) + 1 });
  }
  function cerrar() { setAbierto(false); setEditado(null); setForm(vacio); }
  function enviar(e: FormEvent) { e.preventDefault(); if (puede) guardar.mutate(); }

  if (tipos.isPending || tipos.isError) return <EstadoConsulta cargando={tipos.isPending} error={tipos.error} reintentar={() => { void tipos.refetch(); }} />;
  const lista = [...tipos.data].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

  return <section className="space-y-5" aria-label="Tipos de código">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="section-title">Tipos de código</h2>
        <p>{puede ? "Define los códigos que usa el museo y las reglas que el sistema aplica a cada uno." : "Consulta los códigos que usa el museo. Tu rol no puede modificarlos."}</p></div>
      {puede && <button type="button" className="btn-primary" onClick={() => abrir()}><Plus size={20} aria-hidden="true" />Crear tipo de código</button>}
    </div>
    <p className="f0-notice"><Info size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>Un tipo en uso no se borra: se desactiva y deja de ofrecerse, pero las fichas lo siguen mostrando. El formato exacto del código I está pendiente de confirmar con el museo (N18).</span></p>
    {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}

    {abierto && <form onSubmit={enviar} className="glass-panel p-4 sm:p-6 space-y-4" aria-label={editado ? "Editar tipo de código" : "Crear tipo de código"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">{editado ? `Editar: ${editado.nombre}` : "Nuevo tipo de código"}</h3>
        <button type="button" className="btn-glass" aria-label="Cerrar editor" onClick={cerrar}><X size={20} aria-hidden="true" /></button>
      </div>
      <ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <div><Etiqueta htmlFor="f1-tipo-clave">Clave</Etiqueta>
          <input id="f1-tipo-clave" className="glass-input" required disabled={Boolean(editado)} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })}
            aria-invalid={Boolean(errores.clave)} aria-describedby="f1-tipo-clave-ayuda f1-tipo-clave-error" />
          <p id="f1-tipo-clave-ayuda" className="mt-1 text-sm">Empieza con una letra; solo letras, números y guion bajo. No se cambia después.</p>
          <ErrorCampo id="f1-tipo-clave-error" mensaje={errores.clave} /></div>
        <div><Etiqueta htmlFor="f1-tipo-nombre">Nombre</Etiqueta>
          <input id="f1-tipo-nombre" className="glass-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            aria-invalid={Boolean(errores.nombre)} aria-describedby="f1-tipo-nombre-error" />
          <ErrorCampo id="f1-tipo-nombre-error" mensaje={errores.nombre} /></div>
        <div><Etiqueta htmlFor="f1-tipo-patron">Formato (expresión regular)</Etiqueta>
          <input id="f1-tipo-patron" className="glass-input font-mono" value={form.patron} placeholder="Por ejemplo: INC-\d{4}" onChange={(e) => setForm({ ...form, patron: e.target.value })}
            aria-invalid={Boolean(errores.patron)} aria-describedby="f1-tipo-patron-ayuda f1-tipo-patron-error" />
          <p id="f1-tipo-patron-ayuda" className="mt-1 text-sm">Opcional. Se exige al registrar a mano y solo advierte al importar. Un formato nuevo no revisa los códigos ya guardados.</p>
          <ErrorCampo id="f1-tipo-patron-error" mensaje={errores.patron} /></div>
        <div><Etiqueta htmlFor="f1-tipo-orden">Orden</Etiqueta>
          <input id="f1-tipo-orden" className="glass-input" type="number" required value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
        <div className="md:col-span-2"><Etiqueta htmlFor="f1-tipo-descripcion">Descripción</Etiqueta>
          <textarea id="f1-tipo-descripcion" className="glass-input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
      </div>
      <fieldset className="space-y-3"><legend className="mb-1 font-semibold text-azul">Reglas</legend>
        {REGLAS.map((r) => <div key={r.clave}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form[r.clave]} onChange={(e) => setForm({ ...form, [r.clave]: e.target.checked })}
            aria-describedby={`f1-tipo-${r.clave}-ayuda f1-tipo-${r.clave}-error`} />{r.etiqueta}</label>
          <p id={`f1-tipo-${r.clave}-ayuda`} className="ml-6 text-sm text-texto/70">{r.ayuda}</p>
          <ErrorCampo id={`f1-tipo-${r.clave}-error`} mensaje={errores[r.clave]} />
        </div>)}
        {editado && !editado.esPrincipal && <label className="flex items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Tipo activo</label>}
      </fieldset>
      {editado?.esPrincipal && <p>Este es el código principal (I): se puede ajustar, pero no desactivar.</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? "Guardando…" : "Guardar tipo de código"}</button>
        <button type="button" className="btn-glass" onClick={cerrar}>Cancelar</button>
      </div>
    </form>}

    <div className="f0-catalogue">
      <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Catálogo de tipos de código" tabIndex={0}>
        <table className="f0-table">
          <thead><tr>{["Tipo", "Formato", "Reglas", "Estado", "Acciones"].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
          <tbody>{lista.map((t) => <tr key={t.id}>
            <th scope="row" className="font-semibold"><span>{t.nombre}</span>
              <span className="block text-xs font-normal text-texto/60 mt-1">{t.clave}{t.esPrincipal && " · Principal"}{t.esSistema && " · Del sistema"}</span></th>
            <td>{t.patron ? <code className="text-xs">{t.patron}</code> : <span className="text-texto/60">Libre</span>}</td>
            <td><div className="flex flex-wrap gap-1">
              {t.esUnico && <span className="f0-badge">Único</span>}
              {t.inmutable && <span className="f0-badge"><Lock size={12} aria-hidden="true" />Inmutable</span>}
              {t.esCorrelativo && <span className="f0-badge">Correlativo</span>}
              {t.permiteMultiples && <span className="f0-badge">Varios por pieza</span>}
            </div></td>
            <td><span className={`f0-badge ${t.activo ? "f0-badge-active" : ""}`}><span className="h-1 w-1 rounded-pill bg-current" />{t.activo ? "Activo" : "Inactivo"}</span></td>
            <td>{puede && <button type="button" className="f0-action" onClick={() => abrir(t)} aria-label={`Editar ${t.nombre}`}><Pencil size={20} aria-hidden="true" /></button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {lista.length === 0 && <p className="p-4">No hay tipos de código configurados.</p>}
    </div>
  </section>;
}
