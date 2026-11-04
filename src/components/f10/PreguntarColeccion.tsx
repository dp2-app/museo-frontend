import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, Download, X } from "lucide-react";
import { api, extraerMensajeError } from "../../lib/api";
import { nombreFicha, type Ficha } from "../../lib/ficha";
import { descargarExcel } from "../../lib/reportes";
import { useRecurso } from "../../lib/recursosFicha";
import { usePermisos } from "../../hooks/usePermisos";
import { ChipEstadoFicha } from "../ChipEstadoFicha";
import type { ConsultaIA, InterpretacionFiltro, Pagina } from "../../types";

const TAMANO = 20;
const EJEMPLOS = [
  "¿Cuántas máscaras de madera hay?",
  "Retablos de Ayacucho en mal estado",
  "Piezas sin código I en borrador",
];

const filtra = (f: InterpretacionFiltro) => f.estado === "aplicado" || f.estado === "como_texto";

/** Los parámetros de GET /piezas que resultan de los filtros que siguen activos. El texto libre junta
 * todo lo que va a `q` (palabras de la pregunta y términos que no estaban en una lista). */
function filtrosDe(interpretacion: InterpretacionFiltro[], base: Record<string, string | boolean>) {
  const resultado: Record<string, string | boolean> = {};
  const textos: string[] = [];
  for (const f of interpretacion.filter(filtra)) {
    if (f.parametro === "q") textos.push(f.valorEtiqueta ?? f.valor);
    else if (f.parametro === "soloIncompletas" || f.parametro === "sinCodigoPrincipal") resultado[f.parametro] = true;
    else resultado[f.parametro] = f.valorId ?? f.valor;
  }
  if (textos.length) resultado.q = [...new Set(textos)].join(" ");
  // Quien solo ve fichas aprobadas recibe ese límite del backend aunque no lo haya pedido.
  if (base.estadoFicha && !resultado.estadoFicha) resultado.estadoFicha = base.estadoFicha;
  return resultado;
}

const NOTA_ESTADO: Partial<Record<InterpretacionFiltro["estado"], string>> = {
  como_texto: "buscado como texto",
  no_reconocido: "no reconocido",
  no_visible: "no permitido para su rol",
};

/** F10 · RIA-06: la persona pregunta en español y la IA solo arma los filtros de la búsqueda. El total y las
 * piezas los da el backend (la misma búsqueda de Colección); quitar un filtro o elegir una opción vuelve a
 * buscar sin llamar otra vez a la IA. Si la IA no está configurada, el backend responde 503 y se muestra. */
export function PreguntarColeccion() {
  const { puede } = usePermisos();
  const [pregunta, setPregunta] = useState("");
  const [consulta, setConsulta] = useState<ConsultaIA | null>(null);
  const [interpretacion, setInterpretacion] = useState<InterpretacionFiltro[]>([]);
  const [editada, setEditada] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const preguntar = useMutation({
    mutationFn: async (texto: string) => (await api.post<ConsultaIA>("/ia/consultas", { pregunta: texto })).data,
    onSuccess: (data) => {
      setError(null);
      setConsulta(data);
      setInterpretacion(data.interpretacion);
      setEditada(false);
      setPagina(1);
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const buscable = consulta !== null && consulta.total !== null;
  const filtros = useMemo(
    () => (consulta ? (editada ? filtrosDe(interpretacion, consulta.filtros) : consulta.filtros) : {}),
    [consulta, editada, interpretacion],
  );
  // La primera página ya viene en la respuesta; las demás (o tras editar los filtros) se piden a GET /piezas.
  const otraPagina = useRecurso<Pagina<Ficha>>("piezas", "/piezas", buscable && (editada || pagina > 1),
    { ...filtros, pagina, tamano: TAMANO });
  const usarRespuesta = !editada && pagina === 1;
  const piezas = usarRespuesta ? consulta?.piezas ?? [] : otraPagina.data?.items ?? [];
  const total = usarRespuesta ? consulta?.total ?? null : otraPagina.data?.total ?? null;

  const exportar = useMutation({
    mutationFn: () => descargarExcel("/exportaciones/piezas.xlsx", filtros, `consulta_${new Date().toISOString().slice(0, 10)}.xlsx`),
    onSuccess: () => setError(null),
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function enviar(texto: string) {
    if (!texto.trim()) return;
    setPregunta(texto);
    preguntar.mutate(texto);
  }

  function editar(indice: number, cambio: Partial<InterpretacionFiltro> | null) {
    setInterpretacion((previa) =>
      cambio === null ? previa.filter((_, i) => i !== indice) : previa.map((f, i) => (i === indice ? { ...f, ...cambio } : f)));
    setEditada(true);
    setPagina(1);
  }

  return (
    <section className="space-y-4" aria-labelledby="titulo-preguntar">
      <div>
        <h2 id="titulo-preguntar" className="section-title">Pregúntale a la colección</h2>
        <p className="text-sm text-gris-2 max-w-2xl">
          Escribe tu pregunta como se la harías a una persona. La IA solo la traduce a filtros de búsqueda: las piezas y el
          total salen del catálogo, y puedes quitar o corregir cada filtro.
        </p>
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          enviar(pregunta);
        }}
        className="glass-panel p-5 space-y-3"
      >
        <label className="block">
          <span className="form-label">Tu pregunta</span>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="Ej.: ¿Qué cerámicas de Ayacucho hay en el depósito 2?"
              maxLength={300}
              className="glass-input"
              required
            />
            <button type="submit" disabled={preguntar.isPending || !pregunta.trim()} className="btn-primary shrink-0">
              {preguntar.isPending ? "Buscando..." : "Preguntar"}
            </button>
          </div>
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gris-2">Prueba:</span>
          {EJEMPLOS.map((ejemplo) => (
            <button key={ejemplo} type="button" className="chip hover:underline" onClick={() => enviar(ejemplo)}
              disabled={preguntar.isPending}>
              {ejemplo}
            </button>
          ))}
        </div>
      </form>

      {error && <p className="text-sm text-rojo" role="alert">{error}</p>}

      {consulta && (
        <div className="space-y-3">
          <div className="glass-panel-sm p-4 flex items-start gap-3" role="status">
            <Bot size={22} className="text-azul shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-texto">
                {editada && total !== null
                  ? `Con los filtros actuales: ${total === 1 ? "1 pieza" : `${total} piezas`}.`
                  : consulta.mensaje}
              </p>
              {interpretacion.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold text-gris-2">Entendí:</span>
                  {interpretacion.map((f, i) => (
                    <ChipFiltro key={`${f.campo}-${i}`} filtro={f} buscable={buscable}
                      onQuitar={() => editar(i, null)}
                      onElegir={(id, etiqueta) => editar(i, { estado: "aplicado", valorId: id, valorEtiqueta: etiqueta })} />
                  ))}
                </div>
              )}
              {consulta.avisos.length > 0 && !editada && (
                <ul className="text-xs text-gris-2 list-disc pl-4">
                  {consulta.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              <p className="text-xs text-gris-2">Interpretación de IA ({consulta.modeloUsado}) · resultados del catálogo</p>
            </div>
          </div>

          {buscable && (
            <div className="glass-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-linea">
                <p className="text-sm text-gris-2">{total ?? "…"} piezas</p>
                {puede("reportes.exportar") && (
                  <button onClick={() => exportar.mutate()} disabled={exportar.isPending || !total} className="btn-glass inline-flex items-center gap-2">
                    <Download size={16} aria-hidden="true" />
                    {exportar.isPending ? "Exportando..." : "Exportar a Excel"}
                  </button>
                )}
              </div>
              {otraPagina.isFetching && !usarRespuesta && <p className="px-5 py-3 text-sm text-gris-2">Buscando…</p>}
              {otraPagina.error && !usarRespuesta && <p className="px-5 py-3 text-sm text-rojo">{extraerMensajeError(otraPagina.error)}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th className="px-5 py-3">Pieza / códigos</th>
                      <th className="px-5 py-3">Colección</th>
                      <th className="px-5 py-3">Ubicación</th>
                      <th className="px-5 py-3">Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piezas.map((p) => (
                      <tr key={p.id} className="border-t border-linea">
                        <td className="px-5 py-3">
                          <Link className="text-azul underline font-semibold" to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link>
                          <p className="text-xs text-gris-2">{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</p>
                        </td>
                        <td className="px-5 py-3">{p.etiquetas.coleccion_id || "—"}</td>
                        <td className="px-5 py-3">{p.etiquetas.ubicacion_actual_id || "—"}</td>
                        <td className="px-5 py-3"><ChipEstadoFicha estado={p.estadoFicha} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {total === 0 && <p className="px-5 py-3 text-sm">No se encontraron piezas.</p>}
              {total !== null && total > TAMANO && (
                <div className="flex flex-wrap gap-3 items-center px-5 py-3 border-t border-linea">
                  <button className="btn-glass" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                  <p className="text-sm">Página {pagina} de {Math.ceil(total / TAMANO)}</p>
                  <button className="btn-glass" disabled={pagina * TAMANO >= total} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ChipFiltro({ filtro, buscable, onQuitar, onElegir }: {
  filtro: InterpretacionFiltro;
  buscable: boolean;
  onQuitar: () => void;
  onElegir: (id: string, etiqueta: string) => void;
}) {
  const texto = `${filtro.etiqueta}: ${filtro.valorEtiqueta ?? filtro.valor}`;
  if (filtro.estado === "ambiguo") {
    return (
      <label className="chip inline-flex items-center gap-1.5 border border-paja">
        <span>{filtro.etiqueta}: «{filtro.valor}» — elige</span>
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
      {buscable && (
        <button type="button" onClick={onQuitar} aria-label={`Quitar el filtro ${texto}`} className="hover:text-rojo">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
