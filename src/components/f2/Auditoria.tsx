import { useQuery } from "@tanstack/react-query";
import { useCatalogoFicha } from "../../hooks/useCatalogoFicha";
import { api } from "../../lib/api";
import type { AuditoriaV3, PiezaV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Seccion } from "./FichaComun";

const ACCION: Record<string, string> = { insert: "Registró", update: "Cambió", soft_delete: "Dio de baja", restore: "Restauró" };
const ESPECIALES: Record<string, string> = { regimen_tenencia: "régimen de tenencia", "*": "la pieza" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RNF-11: quién cambió qué, cuándo y por qué. La bitácora es de solo inserción en la base.
 * Muestra la etiqueta del campo (F0) y, cuando el valor es un id que la ficha conoce, su nombre. */
export function Auditoria({ pieza }: { pieza: PiezaV3 }) {
  const catalogo = useCatalogoFicha();
  const registros = useQuery({ queryKey: ["ficha", pieza.id, "auditoria"],
    queryFn: async () => (await api.get<AuditoriaV3[]>(`/piezas/${pieza.id}/auditoria`)).data });

  const nombres = new Map<string, string>();
  for (const [clave, valor] of Object.entries(pieza.campos)) {
    if (typeof valor === "string" && pieza.etiquetas[clave]) nombres.set(valor, pieza.etiquetas[clave]!);
  }
  for (const valores of Object.values(pieza.listas)) valores.forEach((v) => v.etiqueta && nombres.set(v.id, v.etiqueta));

  const campo = (c: string) => c.startsWith("codigo:") ? `código ${c.slice(7)}`
    : ESPECIALES[c] ?? catalogo.data?.find((x) => x.clave === c)?.etiqueta.toLowerCase() ?? c.replaceAll("_", " ");
  const valor = (v: string | null) => (v == null || v === "" ? "—" : UUID.test(v) ? nombres.get(v) ?? "otro valor de la lista" : v);

  return (
    <Seccion titulo="Historial de cambios">
      <ErrorOperacion error={registros.error} />
      <ol className="text-sm space-y-2">
        {registros.data?.map((r) => (
          <li key={r.id} className="border-b border-linea pb-2 last:border-0">
            <p><span className="font-semibold">{r.usuarioNombre ?? "Sistema"}</span> · {ACCION[r.accion] ?? r.accion} {campo(r.campo)}
              <span className="text-gris-2"> · {new Date(r.fecha).toLocaleString("es-PE")}</span></p>
            {r.accion === "update" && <p className="text-xs text-gris-2">«{valor(r.valorAnterior)}» → «{valor(r.valorNuevo)}»</p>}
            {r.motivo && <p className="text-xs">Motivo: {r.motivo}</p>}
          </li>
        ))}
        {registros.data?.length === 0 && <li className="text-gris-2">Sin cambios registrados.</li>}
      </ol>
    </Seccion>
  );
}
