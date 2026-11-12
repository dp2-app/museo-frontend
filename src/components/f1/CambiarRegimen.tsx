import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { useConsultaF0 } from "../../hooks/useConsultaF0";
import { usePropietarios, useRegimenes } from "../../hooks/useCatalogosF1";
import type { Tenencia } from "../../types/f1";
import { ErrorOperacion, Etiqueta } from "../f0/Comun";

/** RF-09: cambia el régimen de tenencia de una pieza existente con `POST /piezas/{id}/tenencias`; el anterior queda
 * como historial. Si la pieza tiene un código que el régimen nuevo no admite (el I al pasar a comodato), el backend
 * responde 409 `regimen_incompatible` (F1-D5) y se muestra aquí. La ficha de F2 lo monta en Identificadores.
 *
 * RN-07: la tenencia nueva reemplaza a la vigente, así que la restricción de publicación, las condiciones y el
 * documento se precargan desde la vigente; si no se reenvían, el backend los deja en blanco y la restricción se
 * perdería sin aviso. El régimen actual también se puede elegir para cambiar solo la contraparte o las condiciones. */
export function CambiarRegimen({ piezaId, regimenActual, restringidoActual = false, alGuardar, historialInicial }: {
  piezaId: string; regimenActual?: string | null; restringidoActual?: boolean; alGuardar: (t: Tenencia) => void; historialInicial?: Tenencia[];
}) {
  const { puede } = usePermisos();
  const id = useId();
  const regimenes = useRegimenes();
  const vePropietarios = puede("propietarios.ver");
  const propietarios = usePropietarios(vePropietarios);
  const historial = useConsultaF0({ queryKey: ["f1", "tenencias-pieza", piezaId], enabled: puede("tenencias.ver"),
    queryFn: async () => (await api.get<Tenencia[]>(`/piezas/${piezaId}/tenencias`)).data,
    ...(historialInicial ? { initialData: historialInicial, staleTime: 5 * 60_000 } : {}) });
  const vigente = historial.data?.find((t) => t.vigente);
  const [regimenId, setRegimenId] = useState("");
  const [contraparteId, setContraparteId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [restringido, setRestringido] = useState(restringidoActual);
  const [condiciones, setCondiciones] = useState("");
  const [documento, setDocumento] = useState("");
  const regimen = regimenes.data?.find((r) => r.id === regimenId);
  const limpiar = () => { setRegimenId(""); setContraparteId(""); setFechaInicio(""); setFechaFin(""); setRestringido(restringidoActual); setCondiciones(""); setDocumento(""); };
  const cambiar = useMutation({
    mutationFn: async () => (await api.post<Tenencia>(`/piezas/${piezaId}/tenencias`, {
      regimenId, contraparteId: contraparteId || null, fechaInicio: fechaInicio || null, fechaFin: fechaFin || null,
      restringidoPublicacion: restringido, condicionesContractuales: condiciones.trim() || null, documentoReferencia: documento.trim() || null,
    })).data,
    onSuccess: (t) => { limpiar(); alGuardar(t); },
  });
  /** Precarga lo que la tenencia vigente promete al propietario (RN-07); con el mismo régimen, también su contrato. */
  function elegir(nuevo: string) {
    setRegimenId(nuevo); cambiar.reset();
    const mismo = !!vigente && regimenes.data?.find((r) => r.id === nuevo)?.clave === regimenActual;
    setRestringido(vigente?.restringidoPublicacion ?? restringidoActual);
    setContraparteId(mismo ? vigente?.contraparte?.id ?? "" : "");
    setFechaInicio(mismo ? vigente?.fechaInicio ?? "" : ""); setFechaFin(mismo ? vigente?.fechaFin ?? "" : "");
    setCondiciones(mismo ? vigente?.condicionesContractuales ?? "" : ""); setDocumento(mismo ? vigente?.documentoReferencia ?? "" : "");
  }
  if (!puede("tenencias.gestionar")) return null;
  const opciones = regimenes.data?.filter((r) => r.activo && r.ingresaInventarioPermanente) ?? [];
  return <form className="space-y-3" aria-label="Cambiar régimen de tenencia" onSubmit={(e: FormEvent) => { e.preventDefault(); cambiar.mutate(); }}>
    <ErrorOperacion error={cambiar.error || regimenes.error || historial.error} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Etiqueta htmlFor={`${id}-regimen`}>Nuevo régimen de tenencia</Etiqueta>
        <select id={`${id}-regimen`} required className="glass-input" value={regimenId} onChange={(e) => elegir(e.target.value)}>
          <option value="">Seleccionar…</option>
          {opciones.map((r) => <option key={r.id} value={r.id}>{r.clave === regimenActual ? `${r.nombre} (actual: cambiar contraparte o condiciones)` : r.nombre}</option>)}
        </select></div>
      {regimen?.requiereContraparte && <div><Etiqueta htmlFor={`${id}-contraparte`}>Contraparte</Etiqueta>
        <select id={`${id}-contraparte`} required className="glass-input" value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}
          disabled={!vePropietarios} aria-describedby={vePropietarios ? undefined : `${id}-sin-propietarios`}>
          <option value="">Seleccionar…</option>
          {propietarios.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {!vePropietarios && <p id={`${id}-sin-propietarios`} className="mt-1 text-sm">Este régimen exige una contraparte y tu rol no puede ver los propietarios (permiso «propietarios.ver»). Pide el cambio a quien administre la tenencia.</p>}</div>}
      {regimen?.requiereFechas && <>
        <div><Etiqueta htmlFor={`${id}-inicio`}>Fecha de inicio</Etiqueta>
          <input id={`${id}-inicio`} type="date" required className="glass-input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
        <div><Etiqueta htmlFor={`${id}-fin`}>Fecha de fin</Etiqueta>
          <input id={`${id}-fin`} type="date" className="glass-input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
      </>}
      {regimen && <>
        <div><Etiqueta htmlFor={`${id}-condiciones`}>Condiciones contractuales</Etiqueta>
          <textarea id={`${id}-condiciones`} className="glass-input" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} /></div>
        <div><Etiqueta htmlFor={`${id}-documento`}>Documento de referencia</Etiqueta>
          <input id={`${id}-documento`} className="glass-input" value={documento} onChange={(e) => setDocumento(e.target.value)} /></div>
        <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={restringido} onChange={(e) => setRestringido(e.target.checked)} />
          Publicación restringida (no fotografiar ni publicar, RN-07)</label>
      </>}
    </div>
    <button className="btn-glass" disabled={cambiar.isPending || !regimenId || (regimen?.requiereContraparte && !vePropietarios)}>{cambiar.isPending ? "Guardando…" : "Cambiar régimen"}</button>
  </form>;
}
