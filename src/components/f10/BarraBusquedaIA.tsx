import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, LayoutTemplate, Loader2, Search, Sparkles, X } from "lucide-react";
import { api, extraerErroresApi, extraerMensajeError } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { EsperaIA } from "./EsperaIA";
import type { ConsultaIA, InterpretacionFiltro } from "../../types";

const EJEMPLOS = [
  "¿Cuántas máscaras de madera hay?",
  "Retablos de Ayacucho en mal estado",
  "Piezas sin foto de la colección Cid Arco",
];
// Filtros sí/no de GET /piezas: el chip vale `true`.
const BOOLEANOS = new Set(["soloIncompletas", "sinCodigoPrincipal", "sinFotografia", "conFotografia", "sinUbicacion"]);
const MENSAJES_ESPERA = ["Interpretando la pregunta", "Reconociendo los filtros", "Buscando en el catálogo"];
const NOTA_ESTADO: Partial<Record<InterpretacionFiltro["estado"], string>> = {
  como_texto: "buscado como texto",
  no_reconocido: "no reconocido",
  no_visible: "no permitido para su rol",
};

const filtra = (f: InterpretacionFiltro) => f.estado === "aplicado" || f.estado === "como_texto";

/** Los parámetros de GET /piezas que resultan de los filtros que siguen activos. El texto libre junta
 * todo lo que va a `q` (palabras de la pregunta y términos que no estaban en una lista). */
function filtrosDe(interpretacion: InterpretacionFiltro[], base: Record<string, string | boolean>) {
  const resultado: Record<string, string | boolean> = {};
  const textos: string[] = [];
  for (const f of interpretacion.filter(filtra)) {
    if (f.parametro === "q") textos.push(f.valorEtiqueta ?? f.valor);
    else if (BOOLEANOS.has(f.parametro)) resultado[f.parametro] = true;
    else resultado[f.parametro] = f.valorId ?? f.valor;
  }
  if (textos.length) resultado.q = [...new Set(textos)].join(" ");
  // Quien solo ve fichas aprobadas recibe ese límite del backend aunque no lo haya pedido.
  if (base.estadoFicha && !resultado.estadoFicha) resultado.estadoFicha = base.estadoFicha;
  return resultado;
}

interface Props {
  /** Filtros aplicados hoy en Colección: «Buscar» les suma el texto. */
  filtros: Record<string, unknown>;
  /** Reemplaza los filtros de Colección; la grilla y el formulario de filtros se recargan con ellos. */
  onAplicar: (filtros: Record<string, unknown>) => void;
}

/** F10 · RIA-06 dentro de la búsqueda de Colección. La misma barra busca por texto o le pregunta a la IA; la IA
 * solo traduce la pregunta a los filtros de GET /piezas, que se aplican a la grilla y al formulario de filtros de
 * siempre. El total y las piezas salen del catálogo. Si la IA no está configurada, la búsqueda normal sigue. */
export function BarraBusquedaIA({ filtros, onAplicar }: Props) {
  const { puede } = usePermisos();
  const [texto, setTexto] = useState(typeof filtros.q === "string" ? filtros.q : "");
  const [consulta, setConsulta] = useState<ConsultaIA | null>(null);
  const [interpretacion, setInterpretacion] = useState<InterpretacionFiltro[]>([]);
  const [error, setError] = useState<string | null>(null);

  const preguntar = useMutation({
    mutationFn: async (pregunta: string) => (await api.post<ConsultaIA>("/ia/consultas", { pregunta })).data,
    onMutate: () => setError(null),
    onSuccess: (data) => {
      setConsulta(data);
      setInterpretacion(data.interpretacion);
      // Si la IA no buscó (filtro ambiguo, pregunta fuera de tema) no se aplica nada: se espera a que la persona elija.
      if (data.total !== null) onAplicar(data.filtros);
    },
    onError: (err) => setError(extraerErroresApi(err).some((e) => e.codigo === "ia_no_configurada")
      ? "El servicio de IA no está disponible en este momento. Puedes seguir buscando por texto o con los filtros."
      : extraerMensajeError(err)),
  });

  function preguntarIA(pregunta: string) {
    if (!pregunta.trim()) return;
    setTexto(pregunta);
    preguntar.mutate(pregunta.trim());
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    setConsulta(null);
    setError(null);
    onAplicar({ ...filtros, q: texto.trim() || undefined });
  }

  /** Quitar un filtro de la interpretación o elegir la opción de uno ambiguo vuelve a buscar sin llamar a la IA. */
  function editar(indice: number, cambio: Partial<InterpretacionFiltro> | null) {
    if (!consulta) return;
    const nueva = cambio === null ? interpretacion.filter((_, i) => i !== indice)
      : interpretacion.map((f, i) => (i === indice ? { ...f, ...cambio } : f));
    setInterpretacion(nueva);
    const aplicados = filtrosDe(nueva, consulta.filtros);
    onAplicar(aplicados);
    // D4 (museo-backend#160): el registro de la consulta guarda con qué filtros se quedó la persona. Solo trazabilidad.
    api.put(`/ia/consultas/${consulta.sugerenciaId}/filtros-aplicados`, { filtros: aplicados }).catch(() => undefined);
  }

  function quitarIA() {
    setConsulta(null);
    setInterpretacion([]);
    setTexto("");
    onAplicar({});
  }

  const tema = texto.trim();
  return (
    <section className="glass-panel p-4 sm:p-5 space-y-3 print:hidden" aria-labelledby="titulo-barra-busqueda">
      <h2 id="titulo-barra-busqueda" className="sr-only">Buscar en la colección</h2>
      <form onSubmit={buscar} className="flex flex-col lg:flex-row gap-3">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Busca una pieza o pregúntale a la colección</span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} className="glass-input w-full"
            placeholder="Busca o pregúntale a la colección: «retablos de Ayacucho en mal estado»" />
        </label>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="submit" className="btn-glass inline-flex items-center gap-2" disabled={preguntar.isPending}>
            <Search size={16} aria-hidden="true" />Buscar
          </button>
          <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={preguntar.isPending || !tema}
            onClick={() => preguntarIA(texto)} title="La IA traduce tu pregunta a filtros de la colección">
            {preguntar.isPending ? <Loader2 size={16} aria-hidden="true" className="motion-safe:animate-spin" /> : <Sparkles size={16} aria-hidden="true" />}
            {preguntar.isPending ? "Preguntando…" : "Preguntar a la IA"}
          </button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <span className="text-gris-2">Prueba preguntar:</span>
        {EJEMPLOS.map((ejemplo) => (
          <button key={ejemplo} type="button" className="chip hover:underline" disabled={preguntar.isPending} onClick={() => preguntarIA(ejemplo)}>
            {ejemplo}
          </button>
        ))}
        {puede("ia.usar") && tema && (
          <Link className="ml-auto inline-flex items-center gap-1 text-azul font-semibold hover:underline" to={`/asistente-ia?tema=${encodeURIComponent(tema)}`}>
            <LayoutTemplate size={14} aria-hidden="true" />Armar una sala con este tema
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-rojo" role="alert">{error}</p>}
      {preguntar.isPending && <EsperaIA mensajes={MENSAJES_ESPERA} />}

      {consulta && !preguntar.isPending && (
        <div className="glass-panel-sm p-3 flex items-start gap-3" role="status">
          <Bot size={22} className="text-azul shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-texto">{consulta.mensaje}</p>
            {interpretacion.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-gris-2">Entendí:</span>
                {interpretacion.map((f, i) => (
                  <ChipFiltro key={`${f.campo}-${i}`} filtro={f} onQuitar={() => editar(i, null)}
                    onElegir={(id, etiqueta) => editar(i, { estado: "aplicado", valorId: id, valorEtiqueta: etiqueta })} />
                ))}
              </div>
            )}
            {consulta.avisos.length > 0 && (
              <ul className="text-xs text-gris-2 list-disc pl-4">{consulta.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
            )}
            <p className="text-xs text-gris-2">Interpretación de IA ({consulta.modeloUsado}). Las piezas y el total salen del catálogo; puedes quitar o corregir cada filtro.</p>
          </div>
          <button type="button" className="btn-glass !py-1 !px-2 !text-xs shrink-0 inline-flex items-center gap-1" onClick={quitarIA}>
            <X size={14} aria-hidden="true" />Quitar filtros de la IA
          </button>
        </div>
      )}
    </section>
  );
}

function ChipFiltro({ filtro, onQuitar, onElegir }: {
  filtro: InterpretacionFiltro;
  onQuitar: () => void;
  onElegir: (id: string, etiqueta: string) => void;
}) {
  const texto = `${filtro.etiqueta}: ${filtro.valorEtiqueta ?? filtro.valor}`;
  if (filtro.estado === "ambiguo") {
    return (
      <label className="chip inline-flex items-center gap-1.5 border border-paja">
        <span>{filtro.etiqueta}: «{filtro.valor}», elige</span>
        <select className="bg-transparent text-azul font-semibold" defaultValue=""
          onChange={(e) => {
            const opcion = filtro.alternativas.find((a) => a.id === e.target.value);
            if (opcion) onElegir(opcion.id, opcion.etiqueta);
          }}>
          <option value="" disabled>…</option>
          {filtro.alternativas.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
        </select>
      </label>
    );
  }
  if (!filtra(filtro)) {
    return (
      <span className="chip line-through opacity-70" title={NOTA_ESTADO[filtro.estado]}>
        {texto}{NOTA_ESTADO[filtro.estado] && <span className="no-underline"> ({NOTA_ESTADO[filtro.estado]})</span>}
      </span>
    );
  }
  return (
    <span className="chip inline-flex items-center gap-1">
      {texto}
      {filtro.estado === "como_texto" && <span className="text-xs text-gris-2">(como texto)</span>}
      <button type="button" onClick={onQuitar} aria-label={`Quitar el filtro ${texto}`} className="hover:text-rojo">
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
