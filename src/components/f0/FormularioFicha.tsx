import { datosEditables } from "../../lib/fichaF0";
import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { useState, type FormEvent } from "react";

import { useCatalogoFicha } from "../../hooks/useCatalogoFicha";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { CampoFicha, DatosFichaV3, ValorLista } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta } from "./Comun";

interface Opcion { id: string; nombre?: string; etiqueta?: string; hijos?: Opcion[]; }
function opcionesUbicacion(datos: Opcion[], prefijo = ""): Opcion[] {
  return datos.flatMap((o) => [{ ...o, nombre: `${prefijo}${o.nombre ?? ""}` }, ...opcionesUbicacion(o.hijos ?? [], `${prefijo}${o.nombre ?? ""} › `)]);
}

function Control({ campo, valor, cambiar, error, coleccionId }: { campo: CampoFicha; valor: unknown; cambiar: (v: unknown) => void; error?: string; coleccionId?: unknown }) {
  const lista = useQuery({ queryKey: ["f0", "opciones", campo.lista?.clave], enabled: campo.tipo === "lista" && Boolean(campo.lista), queryFn: async () => (await api.get<ValorLista[]>(`/listas/${campo.lista!.clave}/valores`)).data });
  const rutas: Record<string, string> = { coleccion_id: "/colecciones", subcoleccion_id: `/colecciones/${String(coleccionId)}/subcolecciones`, propietario_id: "/propietarios", registrador_id: "/personas", ubicacion_actual_id: "/ubicaciones" };
  const ruta = campo.tipo === "referencia" ? rutas[campo.clave] : undefined;
  const referencias = useQuery({ queryKey: ["f0", "referencias", ruta], enabled: Boolean(ruta) && (campo.clave !== "subcoleccion_id" || Boolean(coleccionId)), queryFn: async () => (await api.get<Opcion[]>(ruta!)).data });
  const esSelector = campo.tipo === "lista" || Boolean(ruta);
  const opciones: Opcion[] = campo.tipo === "lista" ? lista.data?.map((v) => ({ id: v.id, nombre: v.etiqueta })) ?? [] : campo.clave === "ubicacion_actual_id" ? opcionesUbicacion(referencias.data ?? []) : referencias.data ?? [];
  const id = `ficha-${campo.clave}`;
  const estadoError = lista.error ?? referencias.error;
  const esperando = lista.isFetching || referencias.isFetching;
  const valorString = typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
  return <div className="space-y-1"><label className="block font-semibold text-azul" htmlFor={id}>{campo.etiqueta}{campo.obligatorio && <span> *<span className="sr-only"> obligatorio</span></span>}{campo.soloLectura && " (solo lectura)"}</label>
    {esSelector ? <select id={id} className="glass-input" multiple={campo.multivalor} size={campo.multivalor ? 4 : undefined} value={campo.multivalor ? (Array.isArray(valor) ? valor.map(String) : []) : valorString} disabled={campo.soloLectura || esperando || (campo.clave === "subcoleccion_id" && !coleccionId)} aria-required={campo.obligatorio} aria-invalid={Boolean(error)} aria-describedby={`${id}-ayuda ${id}-error`} onChange={(e) => cambiar(campo.multivalor ? [...e.target.selectedOptions].map((o) => o.value) : e.target.value || null)}>
      {!campo.multivalor && <option value="">{esperando ? "Cargando opciones…" : "Seleccionar…"}</option>}{opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre ?? o.etiqueta ?? o.id}</option>)}</select> :
      <input id={id} className="glass-input" type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"} step={campo.tipo === "numero" ? "any" : undefined} value={valorString} readOnly={campo.soloLectura} aria-required={campo.obligatorio} aria-invalid={Boolean(error)} aria-describedby={`${id}-ayuda ${id}-error`} onChange={(e) => cambiar(e.target.value === "" ? null : campo.tipo === "numero" ? Number(e.target.value) : e.target.value)} />}
    <p id={`${id}-ayuda`} className="text-sm">{campo.ayuda}{campo.multivalor && " Selecciona uno o varios valores."}{campo.clave === "subcoleccion_id" && !coleccionId && " Primero selecciona una colección."}</p>
    <ErrorCampo id={`${id}-error`} mensaje={error} /><ErrorOperacion error={estadoError} />
  </div>;
}

export interface FormularioFichaProps {
  inicial?: DatosFichaV3;
  errores?: Record<string, string>;
  onGuardar?: (datos: DatosFichaV3) => Promise<void>;
  onChange?: (datos: DatosFichaV3) => void;
}

/** F2 integra onGuardar; sin callback es vista previa y no escribe ninguna pieza. */
export function FormularioFicha({ inicial, errores: erroresExternos = {}, onGuardar, onChange }: FormularioFichaProps) {
  const catalogo = useCatalogoFicha();
  const [datos, setDatos] = useState<DatosFichaV3>(inicial ?? { campos: {}, listas: {} });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const campos = [...(catalogo.data ?? [])].filter((c) => c.activo).sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  const grupos = [...new Set(campos.map((c) => c.grupo))];
  function cambiar(campo: CampoFicha, valor: unknown) {
    let nuevo: DatosFichaV3;
    if (campo.almacenamiento === "lista") nuevo = { ...datos, listas: { ...datos.listas, [campo.clave]: Array.isArray(valor) ? valor.map(String) : [] } };
    else nuevo = { ...datos, campos: { ...datos.campos, [campo.clave]: valor } };
    if (campo.clave === "coleccion_id") nuevo.campos.subcoleccion_id = null;
    setDatos(nuevo); onChange?.(datosEditables(campos, nuevo)); setAviso("");
    setErrores((anteriores) => { const siguientes = { ...anteriores }; delete siguientes[campo.clave]; return siguientes; });
  }
  async function enviar(event: FormEvent) {
    event.preventDefault(); setError(null);
    const faltan = campos.filter((c) => c.obligatorio && !c.soloLectura && (() => {
      const v = c.almacenamiento === "lista" ? datos.listas[c.clave] : datos.campos[c.clave];
      return v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
    })());
    setErrores(Object.fromEntries(faltan.map((c) => [c.clave, `${c.etiqueta}: completa este campo obligatorio.`])));
    if (faltan.length) { setAviso("Revisa los campos obligatorios señalados."); return; }
    if (!onGuardar) { setAviso("Los obligatorios están completos. Esta vista previa no guarda piezas; el servidor valida los datos al guardar una ficha real."); return; }
    setGuardando(true);
    try { await onGuardar(datosEditables(campos, datos)); setAviso("Ficha guardada."); }
    catch (e) { setError(e); setErrores(erroresPorCampo(e)); }
    finally { setGuardando(false); }
  }
  if (catalogo.isPending || catalogo.isError) return <EstadoConsulta cargando={catalogo.isPending} error={catalogo.error} reintentar={() => { void catalogo.refetch(); }} />;
  return <form className="glass-panel p-4 sm:p-6 space-y-6" onSubmit={(e) => { void enviar(e); }} noValidate aria-label="Formulario de ficha">
    <p>Los campos y las listas provienen de la configuración vigente. El asterisco indica un campo obligatorio.</p>
    <ErrorOperacion error={error} />
    {grupos.map((grupo) => <fieldset key={grupo} className="space-y-4"><legend className="mb-3 font-semibold text-azul">{grupo}</legend><div className="grid gap-4 md:grid-cols-2">{campos.filter((c) => c.grupo === grupo).map((c) => <Control key={c.id} campo={c} valor={c.almacenamiento === "lista" ? datos.listas[c.clave] : datos.campos[c.clave]} coleccionId={datos.campos.coleccion_id} cambiar={(v) => cambiar(c, v)} error={errores[c.clave] ?? erroresExternos[c.clave]} />)}</div></fieldset>)}
    {aviso && <p role="status">{aviso}</p>}<button className="btn-primary" disabled={guardando || catalogo.isFetching}>{guardando ? "Guardando…" : onGuardar ? "Guardar ficha" : "Comprobar obligatorios"}</button>
  </form>;
}

export function CamposFaltantes({ incompleta, camposFaltantes }: { incompleta: boolean; camposFaltantes: string[] }) {
  const catalogo = useCatalogoFicha();
  const etiquetas = Object.fromEntries((catalogo.data ?? []).map((c) => [c.clave, c.etiqueta]));
  const extras: Record<string, string> = { codigos_externos: "Código del museo", fotografias: "Fotografía" };
  if (!incompleta) return <p role="status">La ficha está completa.</p>;
  return <section className="rounded-card border border-linea p-4 space-y-2" aria-label="Información faltante"><h3 className="section-title">Información por completar</h3>{camposFaltantes.length ? <ul className="list-disc pl-5">{camposFaltantes.map((clave) => <li key={clave}>{etiquetas[clave] ?? extras[clave] ?? clave}</li>)}</ul> : <p>La ficha tiene información pendiente. Consulta los campos disponibles para tu rol.</p>}</section>;
}

interface FichaConsulta {
  id: string; campos: Record<string, unknown>;
  listas: Record<string, { id: string; etiqueta: string | null }[]>;
  incompleta: boolean; camposFaltantes: string[];
}

export function VistaPreviaFicha() {
  const puede = usePermisos().puede("piezas.ver");
  const [piezaId, setPiezaId] = useState("");
  const piezas = useQuery({ queryKey: ["f0", "piezas-preview"], enabled: puede,
    queryFn: async () => (await api.get<{ items: FichaConsulta[] }>("/piezas", { params: { tamano: 200 } })).data });
  const detalle = useQuery({ queryKey: ["f0", "pieza-preview", piezaId], enabled: puede && Boolean(piezaId),
    queryFn: async () => (await api.get<FichaConsulta>(`/piezas/${piezaId}`)).data });
  const ficha = detalle.data;
  return <section className="space-y-4"><h2 className="section-title">Vista previa del formulario</h2>
    <p>Prueba los campos vigentes sin crear ni modificar piezas. Puedes consultar los faltantes calculados por el servidor para una ficha existente.</p>
    {puede && <div><label className="mb-1 block font-semibold text-azul" htmlFor="preview-pieza">Ficha para consultar</label>
      <select id="preview-pieza" className="glass-input" value={piezaId} onChange={(e) => setPiezaId(e.target.value)}><option value="">Formulario vacío (sin guardar)</option>{piezas.data?.items.map((p) => <option key={p.id} value={p.id}>{String(p.campos.denominacion || "Sin denominación")} · {p.id.slice(0, 8)}</option>)}</select>
      <ErrorOperacion error={piezas.error} />
    </div>}
    {piezaId && <EstadoConsulta cargando={detalle.isPending} error={detalle.error} reintentar={() => { void detalle.refetch(); }} />}
    {ficha && <CamposFaltantes incompleta={ficha.incompleta} camposFaltantes={ficha.camposFaltantes} />}
    {(!piezaId || ficha) && <FormularioFicha key={piezaId} inicial={ficha ? { campos: ficha.campos, listas: Object.fromEntries(Object.entries(ficha.listas).map(([clave, valores]) => [clave, valores.map((v) => v.id)])) } : undefined} />}
  </section>;
}
