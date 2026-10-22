import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AuditoriaV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Seccion } from "./FichaComun";

const ACCION: Record<string, string> = { insert: "Creó", update: "Modificó", soft_delete: "Dio de baja", restore: "Restauró" };

/** RNF-11: quién cambió qué, cuándo y por qué. La bitácora es de solo inserción en la base. */
export function Auditoria({ piezaId }: { piezaId: string }) {
  const registros = useQuery({ queryKey: ["ficha", piezaId, "auditoria"],
    queryFn: async () => (await api.get<AuditoriaV3[]>(`/piezas/${piezaId}/auditoria`)).data });
  return (
    <Seccion titulo="Historial de cambios">
      <ErrorOperacion error={registros.error} />
      <ol className="text-sm space-y-2">
        {registros.data?.map((r) => (
          <li key={r.id} className="border-b border-linea pb-2 last:border-0">
            <p><span className="font-semibold">{r.usuarioNombre ?? "Sistema"}</span> · {ACCION[r.accion] ?? r.accion}
              {r.campo && r.campo !== "*" && <> <span className="font-mono text-xs">{r.campo}</span></>}
              <span className="text-gris-2"> · {new Date(r.fecha).toLocaleString("es-PE")}</span></p>
            {r.accion === "update" && <p className="text-xs text-gris-2">«{r.valorAnterior ?? "—"}» → «{r.valorNuevo ?? "—"}»</p>}
            {r.motivo && <p className="text-xs">Motivo: {r.motivo}</p>}
          </li>
        ))}
        {registros.data?.length === 0 && <li className="text-gris-2">Sin cambios registrados.</li>}
      </ol>
    </Seccion>
  );
}
