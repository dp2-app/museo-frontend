import { useMemo, useState } from "react";
import { ChevronDown, Info, Search } from "lucide-react";
import type { VisibilidadCampo } from "../../types";

export type CampoDeFicha = Pick<VisibilidadCampo, "campoId" | "clave" | "etiqueta" | "grupo">;

interface Props {
  rolNombre: string;
  campos: CampoDeFicha[];
  /** ¿El rol ve este campo? Incluye los cambios todavía sin guardar. */
  visible: (campoId: string) => boolean;
  onCambiar: (campoId: string, visible: boolean) => void;
  soloLectura: boolean;
}

/** Campos de la ficha que el rol puede ver (RF-57, RN-07): un campo oculto no aparece en ficha, búsqueda, exportación, auditoría ni procedencia, y tampoco se puede escribir. */
export function CamposVisibles({ rolNombre, campos, visible, onCambiar, soloLectura }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const grupos = useMemo(
    () => [...new Set(campos.map((c) => c.grupo ?? "Otros"))].map((g) => ({ grupo: g, campos: campos.filter((c) => (c.grupo ?? "Otros") === g) })),
    [campos],
  );
  const ocultos = campos.filter((c) => !visible(c.campoId)).length;
  const filtro = busqueda.toLocaleLowerCase().trim();
  // Abierta de entrada si el rol ya tiene campos ocultos; después la decide la persona.
  const [abierta, setAbierta] = useState(ocultos > 0);

  return (
    <details className="f0-surface group" open={abierta} onToggle={(e) => setAbierta(e.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold text-azul">
        <span className="flex items-center gap-2">
          <ChevronDown size={20} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />Campos de la ficha que ve este rol
        </span>
        <span className="text-sm font-normal text-texto/70" role="status">
          {ocultos === 0 ? "Ve todos los campos" : `${ocultos} ${ocultos === 1 ? "campo oculto" : "campos ocultos"}`}
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        <p className="f0-notice">
          <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Un campo <strong>oculto</strong> no le aparece a «{rolNombre || "este rol"}» en la ficha, las búsquedas, las exportaciones, la auditoría ni la procedencia, y tampoco puede escribirlo.
            Revisa con el museo la información sensible (P46): valorización, ubicación exacta, condiciones de comodato y datos de donantes.</span>
        </p>
        <div className="relative max-w-md">
          <Search size={20} className="pointer-events-none absolute left-3 top-3 text-texto/60" aria-hidden="true" />
          <input className="glass-input !pl-10" type="search" aria-label="Buscar campos" placeholder="Buscar un campo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="f0-catalogue">
          <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Visibilidad de los campos de la ficha" tabIndex={0}>
            <table className="f0-table min-w-[30rem]">
              <thead><tr><th scope="col">Campo</th><th scope="col" className="w-56">Para este rol</th></tr></thead>
              {grupos.map(({ grupo, campos: delGrupo }) => {
                const coinciden = delGrupo.filter((c) => `${c.etiqueta ?? ""} ${c.clave}`.toLocaleLowerCase().includes(filtro));
                if (!coinciden.length) return null;
                return (
                  <tbody key={grupo}>
                    <tr className="f0-group"><th scope="rowgroup" colSpan={2}>{grupo}</th></tr>
                    {coinciden.map((c) => (
                      <tr key={c.campoId}>
                        <th scope="row" className="font-semibold">{c.etiqueta ?? c.clave}<span className="mt-1 block text-xs font-normal text-texto/70">{c.clave}</span></th>
                        <td>
                          <select className="glass-input" value={visible(c.campoId) ? "visible" : "oculto"} disabled={soloLectura}
                            aria-label={`Campo ${c.etiqueta ?? c.clave}: visibilidad`}
                            onChange={(e) => onCambiar(c.campoId, e.target.value === "visible")}>
                            <option value="visible">Visible</option>
                            <option value="oculto">Oculto</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
      </div>
    </details>
  );
}
