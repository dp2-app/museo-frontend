import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Pencil, Plus, Search, X } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { usePropietarios } from "../../hooks/useCatalogosF1";
import type { Propietario, TipoPersona } from "../../types/f1";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "../f0/Comun";

const vacio = { tipoPersona: "natural" as TipoPersona, nombre: "", direccion: "", documentoIdentidad: "", activo: true };
const PERSONA: Record<TipoPersona, string> = { natural: "Persona natural", juridica: "Persona jurídica" };

/** RN-06: propietarios y contrapartes (comodantes, prestadores). Son datos personales: verlos exige `propietarios.ver`. */
export function Propietarios() {
  const permisos = usePermisos();
  const puedeVer = permisos.puede("propietarios.ver");
  const puede = permisos.puede("config.codigos_tenencia");
  const cache = useQueryClient();
  const propietarios = usePropietarios(puedeVer);
  const [editado, setEditado] = useState<Propietario | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const guardar = useMutation({
    mutationFn: async () => {
      const comun = { nombre: form.nombre.trim(), direccion: form.direccion.trim() || null, documentoIdentidad: form.documentoIdentidad.trim() || null };
      return editado
        ? api.patch(`/propietarios/${editado.id}`, { ...comun, activo: form.activo })
        : api.post("/propietarios", { ...comun, tipoPersona: form.tipoPersona });
    },
    onSuccess: () => {
      setAviso(editado ? "Datos actualizados." : "Propietario registrado. Ya se puede elegir como contraparte.");
      cerrar();
      void cache.invalidateQueries({ queryKey: ["f1", "propietarios"] });
    },
  });
  const errores = erroresPorCampo(guardar.error);

  function abrir(p?: Propietario) {
    guardar.reset(); setAviso(""); setEditado(p ?? null); setAbierto(true);
    setForm(p ? { tipoPersona: p.tipoPersona, nombre: p.nombre, direccion: p.direccion ?? "", documentoIdentidad: p.documentoIdentidad ?? "", activo: p.activo } : vacio);
  }
  function cerrar() { setAbierto(false); setEditado(null); setForm(vacio); }

  if (!puedeVer) return <p>No tienes permiso para ver propietarios y contrapartes.</p>;
  if (propietarios.isPending || propietarios.isError) return <EstadoConsulta cargando={propietarios.isPending} error={propietarios.error} reintentar={() => { void propietarios.refetch(); }} />;
  const filtro = busqueda.trim().toLocaleLowerCase();
  const visibles = propietarios.data.filter((p) => `${p.nombre} ${p.documentoIdentidad ?? ""}`.toLocaleLowerCase().includes(filtro));

  return <section className="space-y-5" aria-label="Propietarios y contrapartes">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="section-title">Propietarios y contrapartes</h2>
        <p>{puede ? "Registra a quién pertenece cada pieza o quién la entrega en comodato o préstamo." : "Consulta propietarios y contrapartes. Tu rol no puede modificarlos."}</p></div>
      {puede && <button type="button" className="btn-primary" onClick={() => abrir()}><Plus size={20} aria-hidden="true" />Registrar propietario</button>}
    </div>
    <p className="f0-notice"><Info size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>Son datos personales (Ley 29733): solo los ven los roles autorizados. Un propietario no se borra; se desactiva para conservar el historial de tenencia.</span></p>
    {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}

    {abierto && <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (puede) guardar.mutate(); }} className="glass-panel p-4 sm:p-6 space-y-4" aria-label={editado ? "Editar propietario" : "Registrar propietario"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">{editado ? `Editar: ${editado.nombre}` : "Nuevo propietario o contraparte"}</h3>
        <button type="button" className="btn-glass" aria-label="Cerrar editor" onClick={cerrar}><X size={20} aria-hidden="true" /></button>
      </div>
      <ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <div><Etiqueta htmlFor="f1-prop-tipo">Tipo de persona</Etiqueta>
          <select id="f1-prop-tipo" className="glass-input" disabled={Boolean(editado)} value={form.tipoPersona} onChange={(e) => setForm({ ...form, tipoPersona: e.target.value as TipoPersona })}>
            {Object.entries(PERSONA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select></div>
        <div><Etiqueta htmlFor="f1-prop-nombre">Nombre o razón social</Etiqueta>
          <input id="f1-prop-nombre" className="glass-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            aria-invalid={Boolean(errores.nombre)} aria-describedby="f1-prop-nombre-error" />
          <ErrorCampo id="f1-prop-nombre-error" mensaje={errores.nombre} /></div>
        <div><Etiqueta htmlFor="f1-prop-documento">Documento de identidad (DNI o RUC)</Etiqueta>
          <input id="f1-prop-documento" className="glass-input" inputMode="numeric" value={form.documentoIdentidad} onChange={(e) => setForm({ ...form, documentoIdentidad: e.target.value })}
            aria-invalid={Boolean(errores.documentoIdentidad)} aria-describedby="f1-prop-documento-error" />
          <ErrorCampo id="f1-prop-documento-error" mensaje={errores.documentoIdentidad} /></div>
        <div><Etiqueta htmlFor="f1-prop-direccion">Dirección</Etiqueta>
          <input id="f1-prop-direccion" className="glass-input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
      </div>
      {editado && !editado.esPorDefecto && <label className="flex items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Activo</label>}
      {editado?.esPorDefecto && <p>Es el propietario por defecto (el museo): no se desactiva.</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? "Guardando…" : "Guardar propietario"}</button>
        <button type="button" className="btn-glass" onClick={cerrar}>Cancelar</button>
      </div>
    </form>}

    <div className="f0-catalogue">
      <div className="f0-toolbar">
        <div className="relative flex-1 min-w-0"><Search size={20} className="absolute left-3 top-3 text-texto/60 pointer-events-none" aria-hidden="true" />
          <input className="glass-input !pl-10" type="search" aria-label="Buscar propietarios" placeholder="Buscar por nombre o documento…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
      </div>
      <p className="px-4 pb-4 text-sm text-texto/70" role="status">{visibles.length} de {propietarios.data.length} registros</p>
      <ul className="divide-y divide-linea border-t border-linea">{visibles.map((p) => <li key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div><strong>{p.nombre}</strong>
          <span className="block text-sm text-texto/70 mt-1">{PERSONA[p.tipoPersona]}{p.documentoIdentidad && ` · ${p.documentoIdentidad}`}{p.esPorDefecto && " · Por defecto"}{!p.activo && " · Inactivo"}</span>
          {p.direccion && <span className="block text-sm text-texto/70">{p.direccion}</span>}</div>
        {puede && <button type="button" className="f0-action" onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`}><Pencil size={20} aria-hidden="true" /></button>}
      </li>)}</ul>
      {visibles.length === 0 && <p className="p-4">{propietarios.data.length ? "Ningún registro coincide con la búsqueda." : "No hay propietarios registrados."}</p>}
    </div>
  </section>;
}
