import type { ModuloMatriz, Nivel } from "../../lib/permisos";
import { alternar, aplicarNivel, etiquetaPermiso, nivelDe, opcionesNivel } from "../../lib/permisos";
import type { Permiso } from "../../types";

interface Props {
  modulos: ModuloMatriz[];
  catalogo: Permiso[];
  seleccion: ReadonlySet<string>;
  /** Recibe la selección completa ya coherente y la funcionalidad que el usuario tocó. */
  onCambiar: (siguiente: Set<string>, recurso: string) => void;
  soloLectura?: boolean;
}

/** Permisos por funcionalidad (RF-52): un desplegable de nivel de acceso por fila y, solo donde existen, acciones adicionales. */
export function MatrizPermisos({ modulos, catalogo, seleccion, onCambiar, soloLectura = false }: Props) {
  return (
    <div className="f0-catalogue">
      <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Acceso del rol por funcionalidad" tabIndex={0}>
        <table className="f0-table min-w-[44rem]">
          <thead>
            <tr>
              <th scope="col">Funcionalidad</th>
              <th scope="col" className="w-56">Acceso</th>
              <th scope="col">Acciones adicionales</th>
            </tr>
          </thead>
          {modulos.map((m) => (
            <tbody key={m.modulo}>
              <tr className="f0-group">
                <th scope="rowgroup" colSpan={3}>{m.etiqueta}</th>
              </tr>
              {m.filas.map((fila) => {
                const nivel = nivelDe(fila, seleccion);
                const ayuda = [
                  fila.lecturaAbierta ? "La ven todos los usuarios con sesión." : null,
                  fila.necesita.length ? `Necesita ver: ${fila.necesita.join(", ")}.` : null,
                ].filter(Boolean).join(" ");
                return (
                  <tr key={fila.recurso}>
                    <th scope="row" className="font-semibold">
                      {fila.etiqueta}
                      {ayuda && <span className="mt-1 block text-xs font-normal text-texto/70">{ayuda}</span>}
                    </th>
                    <td>
                      <select className="glass-input" value={nivel} disabled={soloLectura} aria-label={`Acceso a ${fila.etiqueta}`}
                        onChange={(e) => onCambiar(aplicarNivel(catalogo, fila, seleccion, e.target.value as Nivel), fila.recurso)}>
                        {opcionesNivel(fila).map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                        {nivel === "personalizado" && <option value="personalizado" disabled>Personalizado</option>}
                      </select>
                    </td>
                    <td>
                      {fila.adicionales.length === 0 ? (
                        <span className="text-texto/30" aria-hidden="true">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {fila.adicionales.map((p) => (
                            <label key={p.clave} className="flex min-h-8 items-center gap-2 text-sm" title={p.descripcion ?? undefined}>
                              <input type="checkbox" className="h-5 w-5 cursor-pointer accent-azul disabled:cursor-not-allowed"
                                checked={seleccion.has(p.clave)} disabled={soloLectura || nivel === "sin"}
                                aria-label={`${fila.etiqueta}: ${etiquetaPermiso(p)}`}
                                onChange={(e) => onCambiar(alternar(catalogo, seleccion, p.clave, e.target.checked), fila.recurso)} />
                              {etiquetaPermiso(p)}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
