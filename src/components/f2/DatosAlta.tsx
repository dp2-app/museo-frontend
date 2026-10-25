import { Plus, Trash2 } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { useRegimenes, useTiposCodigo, useUbicaciones } from "../../hooks/useCatalogosF2";
import { aplanarUbicaciones } from "../../lib/ubicaciones";
import type { PiezaAlta } from "../../types";
import { CamposRegimen } from "./Tenencia";

type Extras = Pick<PiezaAlta, "codigos" | "tenencia" | "ubicacionInicialId">;

/** Lo que el alta pide además de los campos del catálogo: códigos del museo (F1), régimen de tenencia (F1)
 * y ubicación inicial (F6). El backend valida las reglas de cada uno (RN-02..RN-04) en la misma transacción. */
export function DatosAlta({ valor, cambiar, errores }: { valor: Extras; cambiar: (v: Extras) => void; errores: Record<string, string> }) {
  const { puede } = usePermisos();
  const tipos = useTiposCodigo();
  const regimenes = useRegimenes();
  const ubicaciones = useUbicaciones();
  const regimen = regimenes.data?.find((r) => r.id === valor.tenencia?.regimenId);
  const codigoError = (i: number) => errores[`codigos[${i}].valor`] ?? errores[`codigos[${i}]`];

  function codigo(i: number, cambio: Partial<Extras["codigos"][number]>) {
    cambiar({ ...valor, codigos: valor.codigos.map((c, j) => (j === i ? { ...c, ...cambio } : c)) });
  }

  return (
    <div className="f0-surface space-y-6">
      {puede("codigos.gestionar") && (
        <fieldset className="space-y-3">
          <legend className="mb-1 font-semibold text-azul">Códigos del museo</legend>
          <p className="text-sm">El código I (inventario) no se puede cambiar una vez guardado. Una pieza en comodato o préstamo no lleva código I.</p>
          {valor.codigos.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[14rem_1fr_auto] items-start">
              <div>
                <label className="sr-only" htmlFor={`codigo-tipo-${i}`}>Tipo de código {i + 1}</label>
                <select id={`codigo-tipo-${i}`} className="glass-input" value={c.tipoCodigoId} onChange={(e) => codigo(i, { tipoCodigoId: e.target.value })}>
                  <option value="">Tipo de código…</option>
                  {tipos.data?.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="sr-only" htmlFor={`codigo-valor-${i}`}>Valor del código {i + 1}</label>
                <input id={`codigo-valor-${i}`} className="glass-input" placeholder="p. ej. I-04381 o MMZ 300" value={c.valor}
                  aria-invalid={Boolean(codigoError(i))} onChange={(e) => codigo(i, { valor: e.target.value })} />
                {codigoError(i) && <p className="mt-1 text-sm" role="alert">{codigoError(i)}</p>}
              </div>
              <button type="button" className="btn-glass" aria-label={`Quitar código ${i + 1}`}
                onClick={() => cambiar({ ...valor, codigos: valor.codigos.filter((_, j) => j !== i) })}><Trash2 size={18} aria-hidden="true" /></button>
            </div>
          ))}
          <button type="button" className="btn-glass" onClick={() => cambiar({ ...valor, codigos: [...valor.codigos, { tipoCodigoId: "", valor: "" }] })}>
            <Plus size={18} aria-hidden="true" /> Agregar código
          </button>
        </fieldset>
      )}

      {puede("tenencias.gestionar") && (
        <fieldset className="space-y-3 border-t border-linea pt-6">
          <legend className="mb-1 font-semibold text-azul">Régimen de tenencia</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="alta-regimen">Régimen</label>
              <select id="alta-regimen" className="glass-input" value={valor.tenencia?.regimenId ?? ""}
                onChange={(e) => cambiar({ ...valor, tenencia: e.target.value ? { regimenId: e.target.value } : null })}>
                <option value="">Propiedad del museo (por defecto)</option>
                {regimenes.data?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {errores.tenencia && <p className="mt-1 text-sm" role="alert">{errores.tenencia}</p>}
            </div>
            {valor.tenencia && <CamposRegimen regimen={regimen} valor={valor.tenencia} prefijo="alta" cambiar={(t) => cambiar({ ...valor, tenencia: t })} />}
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-3 border-t border-linea pt-6">
        <legend className="mb-1 font-semibold text-azul">Ubicación inicial</legend>
        <label className="form-label" htmlFor="alta-ubicacion">Sede o ubicación</label>
        <select id="alta-ubicacion" className="glass-input max-w-xl" value={valor.ubicacionInicialId ?? ""}
          onChange={(e) => cambiar({ ...valor, ubicacionInicialId: e.target.value || null })}>
          <option value="">Sin ubicación por ahora</option>
          {aplanarUbicaciones(ubicaciones.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
        </select>
        <p className="text-sm">Después, los traslados se registran desde «Ubicación y movimientos» y quedan en el historial.</p>
      </fieldset>
    </div>
  );
}
