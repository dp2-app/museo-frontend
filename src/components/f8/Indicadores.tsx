import type { FiltrosConsulta, Indicador, IndicadorColeccion, PuntoHistoria, ReporteIndicadores } from "../../lib/reportes";

const numero = (n: number, decimales = 1) => n.toLocaleString("es-PE", { maximumFractionDigits: decimales });
const hoyEnLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const fecha = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-PE");

/** Diferencia en puntos porcentuales entre dos porcentajes que ya calculó el backend. */
function Cambio({ actual, previo, nombre }: { actual: number | null; previo: PuntoHistoria | null; nombre: string }) {
  if (actual === null || !previo) return null;
  if (previo.fecha === hoyEnLima()) return <p className="text-xs text-gris-2">{nombre}: es la primera medición (hoy); desde mañana se verá el cambio.</p>;
  const dif = Math.round((actual - previo.porcentaje) * 10) / 10;
  const color = dif > 0 ? "text-verde" : dif < 0 ? "text-rojo" : "text-gris-2";
  return (
    <p className="text-xs text-gris-2">
      {nombre} ({fecha(previo.fecha)}): {numero(previo.porcentaje)} % ·{" "}
      <span className={`font-semibold ${color}`}>{dif === 0 ? "sin cambio" : `${dif > 0 ? "+" : "−"}${numero(Math.abs(dif))} puntos`}</span>
    </p>
  );
}

function Tarjeta({ i, onVer }: { i: Indicador; onVer: (filtro: FiltrosConsulta) => void }) {
  const esPorcentaje = i.tipo === "porcentaje";
  const dias = i.detalle?.diasMasAntigua;
  return (
    <article className="kpi-card space-y-1" aria-label={i.etiqueta}>
      <h3 className="text-sm">{i.etiqueta}</h3>
      <p className="text-3xl font-display font-bold text-azul">{esPorcentaje && i.porcentaje !== null ? `${numero(i.porcentaje)} %` : i.valor}</p>
      <p className="text-sm">{esPorcentaje ? `${i.valor} de ${i.total} piezas` : `${i.valor === 1 ? "pieza" : "piezas"} de ${i.total}`}</p>
      {dias !== undefined && dias !== null && <p className="text-xs text-gris-2">La que más espera lleva {dias} {dias === 1 ? "día" : "días"} en revisión.</p>}
      {esPorcentaje && <Cambio actual={i.porcentaje} previo={i.lineaBase} nombre="Línea base" />}
      {esPorcentaje && <Cambio actual={i.porcentaje} previo={i.semanaAnterior} nombre="Hace una semana" />}
      <p className="text-xs text-gris-2">Sirve para decidir: {i.decision.charAt(0).toLowerCase()}{i.decision.slice(1)}.</p>
      {i.valor > 0 && i.total > 0 && (esPorcentaje ? i.valor < i.total : true) && (
        <button type="button" className="text-azul underline text-sm font-semibold" onClick={() => onVer(i.filtro)}>{i.verPiezas}</button>
      )}
    </article>
  );
}

/** Tabla por colección: cada porcentaje lleva a las piezas de esa colección a las que les falta lo que mide la columna. */
function PorColeccion({ filas, indicadores, onVer }: { filas: IndicadorColeccion[]; indicadores: Indicador[]; onVer: (filtro: FiltrosConsulta) => void }) {
  const columnas = indicadores.filter((i) => i.tipo === "porcentaje");
  if (!filas.length) return <p className="text-gris-2">No hay desglose por colección con estos filtros o tu rol no ve la colección.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
          <tr><th className="px-4 py-2">Colección</th><th className="px-4 py-2">Piezas</th>{columnas.map((c) => <th key={c.clave} className="px-4 py-2">{c.etiqueta}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {filas.map((f) => (
            <tr key={f.coleccionId ?? "-"}>
              <td className="px-4 py-2">{f.coleccion}</td><td className="px-4 py-2">{f.totalPiezas}</td>
              {columnas.map((c) => {
                const pct = f.porcentajes[c.clave];
                const faltan = f.totalPiezas - ((f as unknown as Record<string, number>)[c.clave] ?? f.totalPiezas);
                return (
                  <td key={c.clave} className="px-4 py-2">
                    {pct === null || pct === undefined ? "—" : faltan > 0 && f.coleccionId ? (
                      <button type="button" className="text-azul underline" title={`${c.verPiezas} de ${f.coleccion}`}
                              aria-label={`${numero(pct)} %. ${c.verPiezas} de ${f.coleccion}`}
                              onClick={() => onVer({ ...c.filtro, coleccionId: f.coleccionId ?? undefined })}>{numero(pct)} %</button>
                    ) : `${numero(pct)} %`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Indicadores de gestión (P37): se muestra lo que arma el backend; los enlaces aplican el filtro que él mismo devuelve. */
export function Indicadores({ reporte, onVerPiezas }: { reporte: ReporteIndicadores; onVerPiezas: (filtro: FiltrosConsulta) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reporte.indicadores.map((i) => <Tarjeta key={i.clave} i={i} onVer={onVerPiezas} />)}
      </div>
      {!reporte.historia.disponible && reporte.historia.motivo && <p role="note" className="text-sm text-gris-2">{reporte.historia.motivo}</p>}
      <section className="space-y-2">
        <h3>Por colección</h3>
        <PorColeccion filas={reporte.porColeccion} indicadores={reporte.indicadores} onVer={onVerPiezas} />
      </section>
    </div>
  );
}
