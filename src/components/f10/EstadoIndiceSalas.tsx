import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api, extraerMensajeError } from "../../lib/api";
import type { EstadoIndiceSalas as Estado } from "../../types";

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" });

const CORTE: Record<string, string> = {
  cuota_diaria: "se detuvo al agotar la cuota diaria del proveedor; sigue en la próxima ejecución",
  error: "terminó con error; se reintenta en la próxima ejecución",
};

/** F10 · RIA-05, vista de administración (permiso ia.ejecutar_lote): cuántas piezas ya tienen su búsqueda
 * por significado al día y cuándo corre la indexación diaria. Todos los números vienen del backend. */
export function EstadoIndiceSalas() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: estado } = useQuery({
    queryKey: ["indice-salas"],
    queryFn: async () => (await api.get<Estado>("/ia/salas/indice")).data,
    refetchInterval: (consulta) => (consulta.state.data?.enCurso ? 15_000 : false),
  });

  const indexar = useMutation({
    mutationFn: async () => (await api.post<Estado>("/ia/salas/indexar")).data,
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(["indice-salas"], { ...data, enCurso: true });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  if (!estado) return null;
  const porcentaje = estado.piezasElegibles ? Math.round((estado.conEmbeddingAlDia / estado.piezasElegibles) * 100) : 0;
  const ultima = estado.ultimaEjecucion;

  return (
    <section className="glass-panel-sm p-4 space-y-3" aria-labelledby="titulo-indice-salas">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="titulo-indice-salas" className="section-title">Índice de búsqueda por significado</h3>
          <p className="text-xs text-gris-2">
            Proveedor: {estado.proveedorDisponible ? estado.proveedor : "no configurado (solo búsqueda por texto)"}
          </p>
        </div>
        <button
          onClick={() => indexar.mutate()}
          disabled={indexar.isPending || estado.enCurso}
          className="btn-glass inline-flex items-center gap-2"
        >
          <RefreshCw size={16} aria-hidden="true" className={estado.enCurso ? "animate-spin" : undefined} />
          {estado.enCurso ? "Indexando..." : "Indexar ahora"}
        </button>
      </div>

      <div>
        <p className="text-sm text-texto">
          <strong>{estado.conEmbeddingAlDia.toLocaleString("es-PE")}</strong> de{" "}
          {estado.piezasElegibles.toLocaleString("es-PE")} piezas indexadas ({porcentaje} %)
        </p>
        <div className="mt-1.5 h-2 rounded-pill bg-fondo-suave overflow-hidden" aria-hidden="true">
          <div className="h-full bg-azul" style={{ width: `${porcentaje}%` }} />
        </div>
        {(estado.conEmbeddingDesactualizado > 0 || estado.sinEmbedding > 0) && (
          <p className="text-xs text-gris-2 mt-1">
            Pendientes: {estado.sinEmbedding.toLocaleString("es-PE")} sin indexar
            {estado.conEmbeddingDesactualizado > 0 &&
              ` y ${estado.conEmbeddingDesactualizado.toLocaleString("es-PE")} con cambios por actualizar`}
            . Mientras tanto se encuentran por texto.
          </p>
        )}
      </div>

      <dl className="grid sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="form-label">Próxima indexación</dt>
          <dd className="text-texto">
            {!estado.automatico
              ? "Automática desactivada"
              : estado.atrasada
                ? "Pendiente: corre en los próximos minutos"
                : `${fechaHora(estado.proximaEjecucion)} (diaria, ${estado.horaProgramada} hora de Lima)`}
          </dd>
        </div>
        <div>
          <dt className="form-label">Última indexación</dt>
          <dd className="text-texto">
            {ultima
              ? `${fechaHora(ultima.iniciadaEn)} (${ultima.origen}): ${ultima.conEmbedding ?? 0} piezas indexadas${
                  ultima.corte ? `; ${CORTE[ultima.corte]}` : ""
                }`
              : "Todavía no hubo ninguna"}
          </dd>
        </div>
      </dl>

      {error && <p className="text-sm text-rojo" role="alert">{error}</p>}
    </section>
  );
}
