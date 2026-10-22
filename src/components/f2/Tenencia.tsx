import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePermisos } from "../../hooks/usePermisos";
import { usePropietarios, useRegimenes } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import type { TenenciaV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Fila, Seccion } from "./FichaComun";

const fecha = (f: string | null) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString("es-PE") : "—");

/** F1 en la ficha: régimen de tenencia (RF-09, RF-56). Cambiarlo deja el anterior en el historial. */
export function Tenencia({ piezaId, tenencias, alCambiar }: { piezaId: string; tenencias: TenenciaV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const [abierto, setAbierto] = useState(false);
  const [regimenId, setRegimenId] = useState("");
  const [contraparteId, setContraparteId] = useState("");
  const regimenes = useRegimenes();
  const regimen = regimenes.data?.find((r) => r.id === regimenId);
  const propietarios = usePropietarios(Boolean(regimen?.requiereContraparte) && puede("propietarios.ver"));
  const vigente = tenencias.find((t) => t.vigente);
  const anteriores = tenencias.filter((t) => !t.vigente);

  const cambiar = useMutation({
    mutationFn: async () => api.post(`/piezas/${piezaId}/tenencias`, { regimenId, contraparteId: contraparteId || null }),
    onSuccess: () => { setAbierto(false); setRegimenId(""); setContraparteId(""); alCambiar(); },
  });

  return (
    <Seccion titulo="Tenencia" acciones={puede("tenencias.gestionar") && !abierto
      ? <button type="button" className="btn-glass !min-h-0 !py-1 !px-3 !text-sm" onClick={() => setAbierto(true)}>Cambiar régimen</button> : undefined}>
      <dl>
        <Fila etiqueta="Régimen vigente">{vigente?.regimenNombre ?? "Propiedad (sin registro explícito)"}</Fila>
        {vigente?.contraparte && <Fila etiqueta="Contraparte">{vigente.contraparte.nombre}</Fila>}
        {vigente && (vigente.fechaInicio || vigente.fechaFin) && <Fila etiqueta="Vigencia">{fecha(vigente.fechaInicio)} – {fecha(vigente.fechaFin)}</Fila>}
        {vigente?.restringidoPublicacion && <Fila etiqueta="Restricción">No se puede publicar (RN-07)</Fila>}
      </dl>
      {anteriores.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-azul">Regímenes anteriores ({anteriores.length})</summary>
          <ul className="mt-2 space-y-1">{anteriores.map((t) => <li key={t.id}>{t.regimenNombre} · desde {new Date(t.creadoEn).toLocaleDateString("es-PE")}</li>)}</ul>
        </details>
      )}
      <ErrorOperacion error={cambiar.error} />
      {abierto && (
        <form className="flex flex-wrap gap-2 items-end" onSubmit={(e: FormEvent) => { e.preventDefault(); cambiar.mutate(); }}>
          <div>
            <label className="form-label" htmlFor="tenencia-regimen">Nuevo régimen</label>
            <select id="tenencia-regimen" required className="glass-input" value={regimenId} onChange={(e) => setRegimenId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {regimenes.data?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          {regimen?.requiereContraparte && (
            <div>
              <label className="form-label" htmlFor="tenencia-contraparte">Contraparte</label>
              <select id="tenencia-contraparte" className="glass-input" value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {propietarios.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
          <button type="button" className="btn-glass" onClick={() => setAbierto(false)}>Cancelar</button>
          <button className="btn-primary" disabled={cambiar.isPending}>Guardar</button>
        </form>
      )}
    </Seccion>
  );
}
