import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePermisos } from "../../hooks/usePermisos";
import { usePropietarios, useRegimenes } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import type { Regimen, TenenciaInputV3, TenenciaV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Fila, Seccion } from "./FichaComun";

const fecha = (f: string | null) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString("es-PE") : "—");

/** Lo que pide cada régimen (RF-56): contraparte, fechas y, si la pieza es de un tercero (comodato, préstamo),
 * las condiciones del contrato y si se puede publicar (RN-07). Lo usan el alta y el cambio de régimen. */
export function CamposRegimen({ regimen, valor, cambiar, prefijo }: {
  regimen: Regimen | undefined; valor: TenenciaInputV3; cambiar: (v: TenenciaInputV3) => void; prefijo: string;
}) {
  const { puede } = usePermisos();
  const propietarios = usePropietarios(Boolean(regimen?.requiereContraparte) && puede("propietarios.ver"));
  if (!regimen) return null;
  return (
    <>
      {regimen.requiereContraparte && (
        <div>
          <label className="form-label" htmlFor={`${prefijo}-contraparte`}>Propietario o institución que cede</label>
          <select id={`${prefijo}-contraparte`} className="glass-input" value={valor.contraparteId ?? ""}
            onChange={(e) => cambiar({ ...valor, contraparteId: e.target.value || null })}>
            <option value="">Seleccionar…</option>
            {propietarios.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}
      {regimen.requiereFechas && (["fechaInicio", "fechaFin"] as const).map((campo) => (
        <div key={campo}>
          <label className="form-label" htmlFor={`${prefijo}-${campo}`}>{campo === "fechaInicio" ? "Fecha de inicio" : "Fecha de fin"}</label>
          <input id={`${prefijo}-${campo}`} type="date" className="glass-input" value={valor[campo] ?? ""}
            onChange={(e) => cambiar({ ...valor, [campo]: e.target.value || null })} />
        </div>
      ))}
      {regimen.requiereContraparte && ( // la pieza es de un tercero: comodato o préstamo
        <>
          <div className="md:col-span-2">
            <label className="form-label" htmlFor={`${prefijo}-condiciones`}>Condiciones del contrato</label>
            <textarea id={`${prefijo}-condiciones`} rows={2} className="glass-input text-sm" value={valor.condicionesContractuales ?? ""}
              onChange={(e) => cambiar({ ...valor, condicionesContractuales: e.target.value || null })} />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={Boolean(valor.restringidoPublicacion)}
              onChange={(e) => cambiar({ ...valor, restringidoPublicacion: e.target.checked })} />
            No se puede publicar ni difundir (RN-07)
          </label>
        </>
      )}
    </>
  );
}

/** F1 en la ficha: régimen de tenencia (RF-09, RF-56). Cambiarlo deja el anterior en el historial. */
export function Tenencia({ piezaId, tenencias, alCambiar }: { piezaId: string; tenencias: TenenciaV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const [nueva, setNueva] = useState<TenenciaInputV3 | null>(null);
  const regimenes = useRegimenes();
  const regimen = regimenes.data?.find((r) => r.id === nueva?.regimenId);
  const vigente = tenencias.find((t) => t.vigente);
  const anteriores = tenencias.filter((t) => !t.vigente);

  const cambiar = useMutation({
    mutationFn: async () => api.post(`/piezas/${piezaId}/tenencias`, nueva),
    onSuccess: () => { setNueva(null); alCambiar(); },
  });

  return (
    <Seccion titulo="Tenencia" acciones={puede("tenencias.gestionar") && !nueva
      ? <button type="button" className="btn-glass !min-h-0 !py-1 !px-3 !text-sm" onClick={() => setNueva({ regimenId: "" })}>Cambiar régimen</button> : undefined}>
      <dl>
        <Fila etiqueta="Régimen vigente">{vigente?.regimenNombre ?? "Propiedad (sin registro explícito)"}</Fila>
        {vigente?.contraparte && <Fila etiqueta="Contraparte">{vigente.contraparte.nombre}</Fila>}
        {vigente && (vigente.fechaInicio || vigente.fechaFin) && <Fila etiqueta="Vigencia">{fecha(vigente.fechaInicio)} – {fecha(vigente.fechaFin)}</Fila>}
        {vigente?.condicionesContractuales && <Fila etiqueta="Condiciones">{vigente.condicionesContractuales}</Fila>}
        {vigente?.restringidoPublicacion && <Fila etiqueta="Restricción">No se puede publicar (RN-07)</Fila>}
      </dl>
      {anteriores.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-azul">Regímenes anteriores ({anteriores.length})</summary>
          <ul className="mt-2 space-y-1">{anteriores.map((t) => <li key={t.id}>{t.regimenNombre} · desde {new Date(t.creadoEn).toLocaleDateString("es-PE")}</li>)}</ul>
        </details>
      )}
      <ErrorOperacion error={cambiar.error} />
      {nueva && (
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e: FormEvent) => { e.preventDefault(); cambiar.mutate(); }}>
          <div>
            <label className="form-label" htmlFor="tenencia-regimen">Nuevo régimen</label>
            <select id="tenencia-regimen" required className="glass-input" value={nueva.regimenId}
              onChange={(e) => setNueva({ regimenId: e.target.value })}>
              <option value="">Seleccionar…</option>
              {regimenes.data?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <CamposRegimen regimen={regimen} valor={nueva} cambiar={setNueva} prefijo="tenencia" />
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button type="button" className="btn-glass" onClick={() => setNueva(null)}>Cancelar</button>
            <button className="btn-primary" disabled={cambiar.isPending}>Guardar</button>
          </div>
        </form>
      )}
    </Seccion>
  );
}
