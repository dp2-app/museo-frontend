import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { api, extraerMensajeError } from "../lib/api";
import type { Coleccion, Pagina, Pieza, ReporteCalidadDatos, SugerenciaIA, ValorVocabulario } from "../types";

const etiquetaTipo: Record<SugerenciaIA["tipo"], string> = {
  "RIA-01-extraccion-observaciones": "RIA-01 · Extracción de observaciones",
  "RIA-02-duplicados-similitud": "RIA-02 · Posible duplicado",
  "RIA-03-categoria-sugerida": "RIA-03 · Categoría sugerida",
  "RIA-04-descripcion-preliminar": "RIA-04 · Descripción preliminar",
  "RIA-05-consulta-catalogo": "RIA-05 · Consulta al catálogo",
};

function TarjetaKpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-gris-2">{etiqueta}</p>
      <p className="font-display text-3xl font-extrabold text-azul">{valor}</p>
      {detalle && <p className="text-xs text-gris-2 mt-0.5">{detalle}</p>}
    </div>
  );
}

function NombrePieza({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["pieza", id, "nombre"],
    queryFn: async () => (await api.get<Pieza>(`/piezas/${id}`)).data,
    staleTime: 60_000,
  });
  return (
    <Link to={`/coleccion/${id}`} className="text-azul hover:underline font-medium">
      {data?.denominacion || "(cargando...)"}
    </Link>
  );
}

/** HU-20 "chat de consulta": el spec pide RAG/Text-to-SQL; aquí no hay modelo
 * de lenguaje ni backend de IA para eso (mismo principio de "nunca simular
 * una respuesta de IA" que rige RIA-01/02 en este proyecto — ver CLAUDE.md).
 * Esta es una búsqueda asistida honesta: reconoce vocabulario controlado real
 * (colecciones/categorías ya existentes) dentro de la pregunta y ejecuta una
 * consulta real contra /piezas — nunca genera texto ni datos inventados. */
function BusquedaAsistida() {
  const [pregunta, setPregunta] = useState("");
  const [resultado, setResultado] = useState<{ total: number; coleccion?: string; categoria?: string } | null>(null);
  const [buscando, setBuscando] = useState(false);

  const { data: colecciones } = useQuery({
    queryKey: ["colecciones"],
    queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { pageSize: 100 } })).data,
  });
  const { data: categorias } = useQuery({
    queryKey: ["vocabularios", "categoria"],
    queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/categoria")).data,
  });

  async function onBuscar(e: FormEvent) {
    e.preventDefault();
    const texto = pregunta.toLowerCase();
    const coleccion = colecciones?.items.find((c) => texto.includes(c.nombre.toLowerCase()));
    const categoria = categorias?.find((c) => texto.includes(c.valor.toLowerCase()));

    setBuscando(true);
    try {
      const { data } = await api.get<Pagina<Pieza>>("/piezas", {
        params: {
          estado_ficha: "aprobada",
          page_size: 1,
          coleccion_id: coleccion?.id,
          categoria_id: categoria?.id,
        },
      });
      setResultado({ total: data.total, coleccion: coleccion?.nombre, categoria: categoria?.valor });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <section className="glass-panel p-5 space-y-3">
      <h2 className="section-title">Búsqueda asistida por vocabulario controlado</h2>
      <p className="text-sm text-gris-2 max-w-2xl">
        Reconoce colecciones y categorías reales del catálogo dentro de tu pregunta y cuenta las piezas aprobadas que
        coinciden — no genera texto ni usa un modelo de lenguaje (a diferencia de RIA-01, esto no requiere Gemma).
      </p>
      <form onSubmit={onBuscar} className="flex gap-2 max-w-xl">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder='Ej: "¿Cuántas piezas de Cerámica Tradicional tenemos?"'
          className="glass-input"
        />
        <button type="submit" disabled={buscando} className="btn-primary shrink-0">
          Consultar
        </button>
      </form>
      {resultado && (
        <p className="text-sm text-texto">
          Encontré <strong>{resultado.total}</strong> pieza(s) aprobada(s)
          {resultado.coleccion && (
            <>
              {" "}
              de la colección <strong>{resultado.coleccion}</strong>
            </>
          )}
          {resultado.categoria && (
            <>
              {" "}
              en la categoría <strong>{resultado.categoria}</strong>
            </>
          )}
          {!resultado.coleccion && !resultado.categoria && " (no reconocí ninguna colección o categoría en tu pregunta; probé sin filtros)"}
          .{" "}
          <Link to="/consultas-y-reportes" className="text-azul hover:underline">
            Ver en Consultas y reportes →
          </Link>
        </p>
      )}
    </section>
  );
}

// Asistente IA (HU-18 a HU-21, RIA-01/RIA-02): mismas funciones reales de
// calidad de datos que ya existían, más el botón "Fusionar" (HU-21) y la
// búsqueda asistida honesta de arriba. Roles: Administrador, Gestor de
// colecciones, Catalogador/practicante.
export function AsistenteIAPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: reporte } = useQuery({
    queryKey: ["calidad-datos"],
    queryFn: async () => (await api.get<ReporteCalidadDatos>("/reportes/calidad-datos")).data,
  });

  const { data: sugerencias, isLoading } = useQuery({
    queryKey: ["sugerencias-ia"],
    queryFn: async () => (await api.get<SugerenciaIA[]>("/ia/sugerencias", { params: { estado: "pendiente" } })).data,
  });

  const invalidarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ["sugerencias-ia"] });
    queryClient.invalidateQueries({ queryKey: ["calidad-datos"] });
  };

  const detectarDuplicados = useMutation({
    mutationFn: async () => (await api.post("/ia/deteccion-duplicados")).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const extraerEnLote = useMutation({
    mutationFn: async () => (await api.post("/ia/extraccion-observaciones/lote")).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const resolver = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: "aceptado" | "rechazado" }) =>
      (await api.patch(`/ia/sugerencias/${id}`, { estado })).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const fusionar = useMutation({
    mutationFn: async (id: string) => (await api.post(`/ia/sugerencias/${id}/fusionar`)).data,
    onSuccess: () => {
      setError(null);
      invalidarTodo();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Bot size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Asistente IA</h1>
          <p className="text-sm text-gris-2 max-w-2xl">
            Un solo lugar para ver qué tan completo está el catálogo y ejecutar RIA-01/RIA-02 sobre él. RN-009: ninguna
            sugerencia se aplica sin que un usuario de catalogación la acepte explícitamente.
          </p>
        </div>
      </div>

      {reporte && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TarjetaKpi etiqueta="Catálogo completo" valor={`${reporte.porcentajeCompleto}%`} detalle={`${reporte.piezasCompletas}/${reporte.totalPiezas} piezas`} />
          <TarjetaKpi etiqueta="Piezas incompletas" valor={String(reporte.piezasIncompletas)} detalle="RF-035 · falta código I, foto o ubicación" />
          <TarjetaKpi etiqueta="Duplicados por revisar" valor={String(reporte.sugerenciasPendientes.ria02)} detalle="RIA-02 · cola pendiente" />
          <TarjetaKpi
            etiqueta="Observaciones por analizar"
            valor={String(reporte.sugerenciasPendientes.ria01)}
            detalle={`RIA-01 · ${reporte.piezasElegiblesParaRia01} piezas elegibles`}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-start">
        <button onClick={() => detectarDuplicados.mutate()} disabled={detectarDuplicados.isPending} className="btn-primary">
          {detectarDuplicados.isPending ? "Analizando..." : "Ejecutar detección de duplicados (RIA-02)"}
        </button>
        <div>
          <button
            onClick={() => extraerEnLote.mutate()}
            disabled={extraerEnLote.isPending || reporte?.ria01Configurado === false}
            className="btn-primary"
          >
            {extraerEnLote.isPending ? "Analizando..." : "Extraer observaciones en lote (RIA-01)"}
          </button>
          {reporte?.ria01Configurado === false && (
            <p className="text-xs text-gris-2 mt-1.5">
              RIA-01 no está configurado (falta GEMMA_API_KEY/GEMMA_API_URL en el backend).
            </p>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rojo">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-gris-2">Cargando cola de revisión...</p>
      ) : (
        <ul className="space-y-3">
          {sugerencias?.map((s) => (
            <li key={s.id} className="glass-panel-sm p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="chip mb-1.5">{etiquetaTipo[s.tipo]}</p>
                {s.tipo === "RIA-02-duplicados-similitud" && s.piezaId && s.piezaRelacionadaId ? (
                  <p className="text-sm text-texto">
                    <NombrePieza id={s.piezaId} /> <span className="text-rojo">⟷</span>{" "}
                    <NombrePieza id={s.piezaRelacionadaId} />
                    {s.confianza !== null && (
                      <span className="text-xs text-gris-2"> · similitud {(s.confianza * 100).toFixed(0)}%</span>
                    )}
                  </p>
                ) : (
                  <>
                    {s.piezaId && (
                      <p className="text-sm text-texto">
                        Pieza: <NombrePieza id={s.piezaId} />
                      </p>
                    )}
                    <p className="text-xs text-gris-2 mt-0.5">Modelo: {s.modeloUsado}</p>
                    <pre className="text-xs text-texto bg-fondo-suave rounded-btn p-2.5 mt-2 max-w-xl overflow-x-auto border border-linea">
                      {JSON.stringify(s.payloadSugerido, null, 2)}
                    </pre>
                  </>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {s.tipo === "RIA-02-duplicados-similitud" && s.piezaId && s.piezaRelacionadaId && (
                  <button
                    onClick={() => fusionar.mutate(s.id)}
                    disabled={fusionar.isPending}
                    className="text-sm font-semibold text-azul hover:underline disabled:opacity-50"
                    title="HU-21: consolida ambas piezas y da de baja al duplicado"
                  >
                    Fusionar
                  </button>
                )}
                <div className="flex gap-3">
                  <button onClick={() => resolver.mutate({ id: s.id, estado: "aceptado" })} className="text-verde hover:underline text-sm font-medium">
                    Aceptar
                  </button>
                  <button onClick={() => resolver.mutate({ id: s.id, estado: "rechazado" })} className="text-rojo hover:underline text-sm font-medium">
                    Rechazar
                  </button>
                </div>
              </div>
            </li>
          ))}
          {sugerencias?.length === 0 && <li className="text-sm text-gris-2">No hay sugerencias pendientes de revisión.</li>}
        </ul>
      )}

      <BusquedaAsistida />
    </div>
  );
}
