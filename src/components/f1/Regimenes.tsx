import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Pencil, Plus, X } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { useRegimenes, useTiposCodigo } from "../../hooks/useCatalogosF1";
import type { Regimen, TipoCodigo } from "../../types/f1";
import { admite } from "../../lib/f1";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "../f0/Comun";

const vacio = { clave: "", nombre: "", descripcion: "", ingresaInventarioPermanente: true, requiereContraparte: false, requiereFechas: false, orden: 0, activo: true };
type Form = typeof vacio;

/** Qué códigos admite un régimen: casillas por tipo activo, guardadas con PUT …/reglas-codigo. */
function ReglasCodigo({ regimen, tipos, puede, alGuardar }: { regimen: Regimen; tipos: TipoCodigo[]; puede: boolean; alGuardar: (aviso: string) => void }) {
  const cache = useQueryClient();
  const inicial = () => Object.fromEntries(tipos.map((t) => [t.id, admite(regimen, t.id)]));
  const [reglas, setReglas] = useState<Record<string, boolean>>(inicial);
  const cambiadas = tipos.filter((t) => reglas[t.id] !== admite(regimen, t.id));
  const guardar = useMutation({
    mutationFn: async () => api.put(`/config/regimenes/${regimen.id}/reglas-codigo`, { reglas: tipos.map((t) => ({ tipoCodigoId: t.id, permitido: reglas[t.id] })) }),
    onSuccess: () => { alGuardar(`Códigos admitidos en «${regimen.nombre}» guardados.`); void cache.invalidateQueries({ queryKey: ["f1"] }); },
  });
  return <form className="space-y-3" aria-label={`Códigos que admite ${regimen.nombre}`} onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(""); guardar.mutate(); }}>
    <ErrorOperacion error={guardar.error} />
    <ul className="grid gap-2 sm:grid-cols-2">{tipos.map((t) => <li key={t.id}>
      <label className="flex items-center gap-2 min-h-11"><input type="checkbox" disabled={!puede} checked={reglas[t.id]} onChange={(e) => setReglas({ ...reglas, [t.id]: e.target.checked })} />
        {t.nombre}{t.esPrincipal && <span className="text-xs text-texto/60">(principal)</span>}</label>
    </li>)}</ul>
    {puede && <div className="flex flex-wrap items-center gap-3">
      <button className="btn-glass" disabled={guardar.isPending || cambiadas.length === 0}>{guardar.isPending ? "Guardando…" : "Guardar códigos admitidos"}</button>
      {cambiadas.length > 0 && <span className="text-sm text-texto/70">{cambiadas.length} cambio(s) sin guardar</span>}
    </div>}
  </form>;
}

/** RF-56: regímenes de tenencia, sus requisitos y los códigos que admiten (RN-03, RN-04). */
export function Regimenes() {
  const puede = usePermisos().puede("config.codigos_tenencia");
  const cache = useQueryClient();
  const regimenes = useRegimenes();
  const tipos = useTiposCodigo();
  const [editado, setEditado] = useState<Regimen | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<Form>(vacio);
  const [aviso, setAviso] = useState("");

  const guardar = useMutation({
    mutationFn: async () => {
      const comun = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, requiereContraparte: form.requiereContraparte,
        requiereFechas: form.requiereFechas, orden: form.orden };
      return editado
        ? api.patch(`/config/regimenes/${editado.id}`, { ...comun, ...(editado.esSistema ? {} : { activo: form.activo }) })
        : api.post("/config/regimenes", { ...comun, clave: form.clave.trim(), ingresaInventarioPermanente: form.ingresaInventarioPermanente });
    },
    onSuccess: () => {
      setAviso(editado ? "Régimen actualizado." : "Régimen creado. Ya aparece en la ficha.");
      cerrar();
      void cache.invalidateQueries({ queryKey: ["f1"] });
    },
  });
  const errores = erroresPorCampo(guardar.error);

  function abrir(regimen?: Regimen) {
    guardar.reset(); setAviso(""); setEditado(regimen ?? null); setAbierto(true);
    const siguienteOrden = Math.max(0, ...(regimenes.data ?? []).map((r) => r.orden)) + 1;
    setForm(regimen ? { clave: regimen.clave, nombre: regimen.nombre, descripcion: regimen.descripcion ?? "", ingresaInventarioPermanente: regimen.ingresaInventarioPermanente,
      requiereContraparte: regimen.requiereContraparte, requiereFechas: regimen.requiereFechas, orden: regimen.orden, activo: regimen.activo } : { ...vacio, orden: siguienteOrden });
  }
  function cerrar() { setAbierto(false); setEditado(null); setForm(vacio); }

  if (regimenes.isPending || tipos.isPending || regimenes.isError || tipos.isError)
    return <EstadoConsulta cargando={regimenes.isPending || tipos.isPending} error={regimenes.error ?? tipos.error} reintentar={() => { void regimenes.refetch(); void tipos.refetch(); }} />;

  // Mismo criterio que `regimen_por_defecto` del backend: el primero activo de inventario según su orden.
  const porDefecto = [...regimenes.data].filter((r) => r.activo && r.ingresaInventarioPermanente).sort((a, b) => a.orden - b.orden)[0];

  return <section className="space-y-5" aria-label="Regímenes de tenencia">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="section-title">Regímenes de tenencia</h2>
        <p>{puede ? "Define cómo tiene el museo cada pieza y qué códigos admite cada régimen." : "Consulta los regímenes de tenencia. Tu rol no puede modificarlos."}</p></div>
      {puede && <button type="button" className="btn-primary" onClick={() => abrir()}><Plus size={20} aria-hidden="true" />Crear régimen</button>}
    </div>
    <p className="f0-notice"><Info size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>Una pieza en comodato nunca recibe código I (RN-03). Un préstamo temporal no entra al inventario (RN-04). Los regímenes del sistema no se desactivan.</span></p>
    {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}

    {abierto && <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (puede) guardar.mutate(); }} className="glass-panel p-4 sm:p-6 space-y-4" aria-label={editado ? "Editar régimen" : "Crear régimen"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">{editado ? `Editar: ${editado.nombre}` : "Nuevo régimen"}</h3>
        <button type="button" className="btn-glass" aria-label="Cerrar editor" onClick={cerrar}><X size={20} aria-hidden="true" /></button>
      </div>
      <ErrorOperacion error={guardar.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <div><Etiqueta htmlFor="f1-regimen-clave">Clave</Etiqueta>
          <input id="f1-regimen-clave" className="glass-input" required disabled={Boolean(editado)} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })}
            aria-invalid={Boolean(errores.clave)} aria-describedby="f1-regimen-clave-ayuda f1-regimen-clave-error" />
          <p id="f1-regimen-clave-ayuda" className="mt-1 text-sm">Minúsculas, números y guion bajo; por ejemplo: deposito. No se cambia después.</p>
          <ErrorCampo id="f1-regimen-clave-error" mensaje={errores.clave} /></div>
        <div><Etiqueta htmlFor="f1-regimen-nombre">Nombre</Etiqueta>
          <input id="f1-regimen-nombre" className="glass-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            aria-invalid={Boolean(errores.nombre)} aria-describedby="f1-regimen-nombre-error" />
          <ErrorCampo id="f1-regimen-nombre-error" mensaje={errores.nombre} /></div>
        <div><Etiqueta htmlFor="f1-regimen-orden">Orden</Etiqueta>
          <input id="f1-regimen-orden" className="glass-input" type="number" required value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
            aria-describedby="f1-regimen-orden-ayuda" />
          <p id="f1-regimen-orden-ayuda" className="mt-1 text-sm">Las piezas nuevas sin régimen reciben el primer régimen activo de inventario según este orden.</p></div>
        <div className="md:col-span-2"><Etiqueta htmlFor="f1-regimen-descripcion">Descripción</Etiqueta>
          <textarea id="f1-regimen-descripcion" className="glass-input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
      </div>
      <fieldset className="space-y-2"><legend className="mb-1 font-semibold text-azul">Requisitos</legend>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={Boolean(editado)} checked={form.ingresaInventarioPermanente}
          onChange={(e) => setForm({ ...form, ingresaInventarioPermanente: e.target.checked })} />Ingresa al inventario permanente</label>
        <p className="ml-6 text-sm text-texto/70">Desmarcado, funciona como préstamo temporal: no crea pieza ni aparece en el inventario. No se cambia después.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.requiereContraparte} onChange={(e) => setForm({ ...form, requiereContraparte: e.target.checked })} />Exige contraparte (propietario o comodante)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.requiereFechas} onChange={(e) => setForm({ ...form, requiereFechas: e.target.checked })} />Exige fecha de inicio</label>
        {editado && !editado.esSistema && <label className="flex items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Régimen activo</label>}
        <ErrorCampo id="f1-regimen-activo-error" mensaje={errores.activo} />
      </fieldset>
      {editado?.esSistema && <p>Este régimen es del sistema: se puede ajustar, pero no desactivar.</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? "Guardando…" : "Guardar régimen"}</button>
        <button type="button" className="btn-glass" onClick={cerrar}>Cancelar</button>
      </div>
    </form>}

    <ul className="space-y-4">{[...regimenes.data].sort((a, b) => a.orden - b.orden).map((r) => <li key={r.id} className="f0-surface space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">{r.nombre}</h3>
          <p className="text-xs text-texto/60 mt-1">{r.clave}{r.esSistema && " · Del sistema"}</p>
          {r.descripcion && <p className="mt-2 text-sm">{r.descripcion}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            <span className={`f0-badge ${r.activo ? "f0-badge-active" : ""}`}><span className="h-1 w-1 rounded-pill bg-current" />{r.activo ? "Activo" : "Inactivo"}</span>
            {r.id === porDefecto?.id && <span className="f0-badge f0-badge-active">Por defecto en piezas nuevas</span>}
            <span className="f0-badge">{r.ingresaInventarioPermanente ? "Inventario permanente" : "Préstamo temporal"}</span>
            {r.requiereContraparte && <span className="f0-badge">Exige contraparte</span>}
            {r.requiereFechas && <span className="f0-badge">Exige fechas</span>}
          </div>
        </div>
        {puede && <button type="button" className="f0-action" onClick={() => abrir(r)} aria-label={`Editar ${r.nombre}`}><Pencil size={20} aria-hidden="true" /></button>}
      </div>
      <div><h4 className="font-semibold text-azul mb-2">Códigos que admite</h4>
        <ReglasCodigo key={`${r.id}-${r.reglasCodigo.map((x) => `${x.tipoCodigoId}${x.permitido}`).join()}`} regimen={r} tipos={tipos.data} puede={puede} alGuardar={setAviso} /></div>
    </li>)}</ul>
  </section>;
}
