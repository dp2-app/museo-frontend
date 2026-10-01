import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extraerMensajeError } from "../lib/api";
import { camel, useCamposFicha, valorCampo } from "../lib/camposFicha";
import { aplanarUbicaciones } from "../lib/ubicaciones";
import type { CampoFicha, Coleccion, Pagina, Pieza, UbicacionFisica, ValorVocabulario } from "../types";

function ControlCampo({ campo, value, onChange }: { campo: CampoFicha; value: string; onChange: (v: string) => void }) {
  const vocab = useQuery({ queryKey: ["vocabularios", campo.vocabularioTipo], queryFn: async () => (await api.get<ValorVocabulario[]>(`/vocabularios/${campo.vocabularioTipo}`)).data, enabled: campo.tipo === "lista" });
  const colecciones = useQuery({ queryKey: ["colecciones"], queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { page_size: 500 } })).data, enabled: campo.clave === "coleccion_id" });
  const subcolecciones = useQuery({ queryKey: ["subcolecciones-formulario"], queryFn: async () => {
    const cols = (await api.get<Pagina<Coleccion>>("/colecciones", { params: { page_size: 500 } })).data.items;
    const lists = await Promise.all(cols.map(async c => (await api.get<{ id: string; nombre: string }[]>(`/colecciones/${c.id}/subcolecciones`)).data));
    return lists.flat();
  }, enabled: campo.clave === "subcoleccion_id" });
  const ubicaciones = useQuery({ queryKey: ["ubicaciones"], queryFn: async () => (await api.get<UbicacionFisica[]>("/ubicaciones")).data, enabled: campo.clave === "ubicacion_actual_id" });
  let opciones: { value: string; label: string }[] | null = null;
  if (campo.tipo === "lista") opciones = (vocab.data ?? []).map(v => ({ value: campo.almacenamiento === "columna" && campo.clave.endsWith("_id") ? v.id : v.valor, label: v.valor }));
  if (campo.clave === "coleccion_id") opciones = (colecciones.data?.items ?? []).map(c => ({ value: c.id, label: c.nombre }));
  if (campo.clave === "subcoleccion_id") opciones = (subcolecciones.data ?? []).map(c => ({ value: c.id, label: c.nombre }));
  if (campo.clave === "ubicacion_actual_id") opciones = aplanarUbicaciones(ubicaciones.data ?? []).map(u => ({ value: u.id, label: u.etiqueta }));
  if (campo.clave === "regimen_tenencia") opciones = [{ value: "propiedad", label: "Propiedad" }, { value: "comodato", label: "Comodato" }];
  const id = `campo-${campo.clave}`;
  return <div>
    <label className="form-label" htmlFor={id}>{campo.etiqueta}{campo.obligatorio && " *"}</label>
    {opciones ? <select id={id} className="glass-input w-full" value={value} onChange={e => onChange(e.target.value)} required={campo.obligatorio}>
      <option value="">Seleccionar...</option>{opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select> : <input id={id} className="glass-input w-full" type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"} step={campo.tipo === "numero" ? "any" : undefined} required={campo.obligatorio} value={value} onChange={e => onChange(e.target.value)} />}
  </div>;
}

export function FormularioFicha({ pieza, onSaved }: { pieza?: Pieza; onSaved?: (p: Pieza) => void }) {
  const catalogo = useCamposFicha();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const editable = catalogo.data?.filter(c => c.activo && !c.soloLectura) ?? [];
  const valueFor = (c: CampoFicha) => values[c.clave] ?? (pieza ? String(valorCampo(pieza, c) ?? "") : "");
  const save = useMutation({ mutationFn: async () => {
    const body: Record<string, unknown> = {};
    const adicionales: Record<string, unknown> = {};
    for (const c of editable) {
      if (pieza && !(c.clave in values)) continue;
      const raw = valueFor(c);
      const value = raw === "" ? null : c.tipo === "numero" ? Number(raw) : raw;
      if (c.almacenamiento === "adicional") adicionales[c.clave] = value;
      else body[camel(c.clave)] = value;
    }
    if (Object.keys(adicionales).length) body.camposAdicionales = adicionales;
    return (pieza ? await api.patch<Pieza>(`/piezas/${pieza.id}`, body) : await api.post<Pieza>("/piezas", body)).data;
  }, onSuccess: p => { setValues({}); setError(null); queryClient.invalidateQueries(); onSaved?.(p); }, onError: e => setError(extraerMensajeError(e)) });
  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }
  if (catalogo.isLoading) return <p>Cargando campos de la ficha...</p>;
  if (catalogo.isError) return <p role="alert" className="text-rojo">No se pudo cargar el catálogo de campos.</p>;
  const grupos = [...new Set(editable.map(c => c.grupo))];
  return <form onSubmit={submit} className="glass-panel p-5 space-y-5">
    <h3 className="section-title">{pieza ? "Editar ficha" : "Registrar pieza"}</h3>
    {grupos.map(g => <fieldset key={g} className="space-y-3"><legend className="font-semibold text-azul mb-2">{g}</legend>
      <div className="grid gap-4 md:grid-cols-2">{editable.filter(c => c.grupo === g).map(c => <ControlCampo key={c.id} campo={c} value={valueFor(c)} onChange={v => setValues(prev => ({ ...prev, [c.clave]: v }))} />)}</div>
    </fieldset>)}
    {error && <p role="alert" className="text-rojo">{error}</p>}
    <button className="btn-primary" disabled={save.isPending}>{save.isPending ? "Guardando..." : pieza ? "Guardar cambios" : "Registrar"}</button>
  </form>;
}
