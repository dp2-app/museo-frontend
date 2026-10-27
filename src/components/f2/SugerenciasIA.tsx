import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useCatalogoFicha } from "../../hooks/useCatalogoFicha";
import { usePermisos } from "../../hooks/usePermisos";
import { api } from "../../lib/api";
import type { PiezaV3, SugerenciaIA } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Seccion } from "./FichaComun";

const RIA01 = "RIA-01-extraccion-observaciones";
const mostrar = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Propuesta({ sugerencia, pieza, alResolver }: { sugerencia: SugerenciaIA; pieza: PiezaV3; alResolver: () => void }) {
  const { puede } = usePermisos();
  const catalogo = useCatalogoFicha();
  const claves = Object.keys(sugerencia.payloadSugerido);
  const [elegidas, setElegidas] = useState<string[]>(claves);
  const etiqueta = (k: string) => catalogo.data?.find((c) => c.clave === k)?.etiqueta ?? k;
  const actual = (k: string) => pieza.etiquetas[k] ?? pieza.campos[k];

  const resolver = useMutation({
    mutationFn: async (estado: "aceptado" | "rechazado" | "modificado") => api.patch(`/ia/sugerencias/${sugerencia.id}`, {
      estado, payloadSugerido: estado === "modificado"
        ? Object.fromEntries(elegidas.map((k) => [k, sugerencia.payloadSugerido[k]])) : undefined,
    }),
    onSuccess: alResolver,
  });
  const todas = elegidas.length === claves.length;

  return (
    <div className="rounded-card border border-linea p-3 space-y-3">
      <p className="text-xs text-gris-2">Propuesta de {sugerencia.modeloUsado}{sugerencia.creadoEn && ` · ${new Date(sugerencia.creadoEn).toLocaleString("es-PE")}`}
        {sugerencia.confianza && ` · confianza ${Math.round(Number(sugerencia.confianza) * 100)} %`}</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gris-2"><tr><th className="py-1"><span className="sr-only">Aplicar</span></th><th>Campo</th><th>Hoy</th><th>Propuesto</th></tr></thead>
        <tbody>
          {claves.map((k) => (
            <tr key={k} className="border-t border-linea">
              <td className="py-1.5 pr-2">
                <input type="checkbox" aria-label={`Aplicar ${etiqueta(k)}`} checked={elegidas.includes(k)} disabled={!puede("ia.resolver")}
                  onChange={(e) => setElegidas(e.target.checked ? [...elegidas, k] : elegidas.filter((x) => x !== k))} />
              </td>
              <td className="pr-2 font-medium">{etiqueta(k)}</td>
              <td className="pr-2 text-gris-2">{mostrar(actual(k))}</td>
              <td>{mostrar(sugerencia.payloadSugerido[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorOperacion error={resolver.error} />
      {puede("ia.resolver") ? (
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" className="btn-glass !min-h-0 !py-1.5 !px-3 !text-sm" disabled={resolver.isPending} onClick={() => resolver.mutate("rechazado")}>Rechazar</button>
          <button type="button" className="btn-primary !min-h-0 !py-1.5 !px-3 !text-sm" disabled={resolver.isPending || elegidas.length === 0}
            onClick={() => resolver.mutate(todas ? "aceptado" : "modificado")}>
            {todas ? "Aplicar a la ficha" : `Aplicar ${elegidas.length} de ${claves.length}`}
          </button>
        </div>
      ) : <p className="text-xs text-gris-2">Una persona con permiso para resolver sugerencias debe revisarla.</p>}
    </div>
  );
}

/** F10 en la ficha (RIA-01): la IA propone datos a partir de las observaciones y una persona decide (DA-006).
 * Lo aceptado pasa por la misma validación que el formulario y queda en la auditoría.
 * ponytail: el backend no filtra la cola por pieza; se filtra aquí. Agregar `piezaId` a GET /ia/sugerencias si la cola crece. */
export function SugerenciasIA({ pieza, alCambiar }: { pieza: PiezaV3; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const habilitado = puede("ia.usar");
  const cola = useQuery({ queryKey: ["ficha", pieza.id, "sugerencias"], enabled: habilitado,
    queryFn: async () => (await api.get<SugerenciaIA[]>("/ia/sugerencias", { params: { estado: "pendiente", tipo: RIA01 } })).data
      .filter((s) => s.piezaId === pieza.id) });
  const proponer = useMutation({
    mutationFn: async () => api.post(`/ia/extraccion-observaciones/${pieza.id}`),
    onSuccess: () => cola.refetch(),
  });
  if (!habilitado) return null;
  const observaciones = String(pieza.campos.observaciones ?? "").trim();
  const resolver = () => { cola.refetch(); alCambiar(); };

  return (
    <Seccion titulo="Sugerencias de IA" acciones={observaciones ? (
      <button type="button" className="btn-glass !min-h-0 !py-1 !px-3 !text-sm" disabled={proponer.isPending} onClick={() => proponer.mutate()}>
        <Sparkles size={16} aria-hidden="true" /> {proponer.isPending ? "Analizando…" : "Proponer datos desde las observaciones"}
      </button>) : undefined}>
      {!observaciones && <p className="text-sm text-gris-2">La IA propone datos a partir de las observaciones; esta pieza no tiene.</p>}
      <ErrorOperacion error={proponer.error ?? cola.error} />
      {cola.data?.map((s) => <Propuesta key={s.id} sugerencia={s} pieza={pieza} alResolver={resolver} />)}
      {observaciones && cola.data?.length === 0 && <p className="text-sm text-gris-2">No hay propuestas pendientes para esta pieza.</p>}
      <p className="text-xs text-gris-2">Nada se escribe en la ficha sin tu aprobación; lo aplicado queda en el historial de cambios.</p>
    </Seccion>
  );
}
