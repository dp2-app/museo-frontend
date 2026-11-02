import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { usePropietarios, useRegimenes } from "../../hooks/useCatalogosF1";
import type { Tenencia } from "../../types/f1";
import { ErrorOperacion, Etiqueta } from "../f0/Comun";

/** RF-09: cambia el régimen de tenencia de una pieza existente con `POST /piezas/{id}/tenencias`; el anterior queda
 * como historial. Si la pieza tiene un código que el régimen nuevo no admite (el I al pasar a comodato), el backend
 * responde 409 `regimen_incompatible` (F1-D5) y se muestra aquí. La ficha de F2 lo monta en Identificadores. */
export function CambiarRegimen({ piezaId, regimenActual, alGuardar }: { piezaId: string; regimenActual?: string | null; alGuardar: (t: Tenencia) => void }) {
  const { puede } = usePermisos();
  const id = useId();
  const regimenes = useRegimenes();
  const propietarios = usePropietarios(puede("propietarios.ver"));
  const [regimenId, setRegimenId] = useState("");
  const [contraparteId, setContraparteId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const regimen = regimenes.data?.find((r) => r.id === regimenId);
  const cambiar = useMutation({
    mutationFn: async () => (await api.post<Tenencia>(`/piezas/${piezaId}/tenencias`, {
      regimenId, contraparteId: contraparteId || null, fechaInicio: fechaInicio || null, fechaFin: fechaFin || null,
    })).data,
    onSuccess: (t) => { setRegimenId(""); setContraparteId(""); setFechaInicio(""); setFechaFin(""); alGuardar(t); },
  });
  if (!puede("tenencias.gestionar")) return null;
  const opciones = regimenes.data?.filter((r) => r.activo && r.ingresaInventarioPermanente && r.clave !== regimenActual) ?? [];
  return <form className="space-y-3" aria-label="Cambiar régimen de tenencia" onSubmit={(e: FormEvent) => { e.preventDefault(); cambiar.mutate(); }}>
    <ErrorOperacion error={cambiar.error || regimenes.error} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Etiqueta htmlFor={`${id}-regimen`}>Nuevo régimen de tenencia</Etiqueta>
        <select id={`${id}-regimen`} required className="glass-input" value={regimenId} onChange={(e) => { setRegimenId(e.target.value); cambiar.reset(); }}>
          <option value="">Seleccionar…</option>
          {opciones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select></div>
      {regimen?.requiereContraparte && <div><Etiqueta htmlFor={`${id}-contraparte`}>Contraparte</Etiqueta>
        <select id={`${id}-contraparte`} required className="glass-input" value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}>
          <option value="">Seleccionar…</option>
          {propietarios.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select></div>}
      {regimen?.requiereFechas && <>
        <div><Etiqueta htmlFor={`${id}-inicio`}>Fecha de inicio</Etiqueta>
          <input id={`${id}-inicio`} type="date" required className="glass-input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
        <div><Etiqueta htmlFor={`${id}-fin`}>Fecha de fin</Etiqueta>
          <input id={`${id}-fin`} type="date" className="glass-input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
      </>}
    </div>
    <button className="btn-glass" disabled={cambiar.isPending || !regimenId}>{cambiar.isPending ? "Guardando…" : "Cambiar régimen"}</button>
  </form>;
}
