import { useEffect, useRef } from "react";
import { Anillo, BarraProgreso } from "./Graficos";
import { PanoramaCatalogo } from "./PanoramaCatalogo";
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
      <div className="flex items-center gap-3">
        {esPorcentaje && i.porcentaje !== null && <Anillo porcentaje={i.porcentaje} etiqueta={i.etiqueta} />}
        <p className="text-3xl font-display font-bold text-azul">{esPorcentaje && i.porcentaje !== null ? `${numero(i.porcentaje)} %` : i.valor}</p>
      </div>
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
                    {pct === null || pct === undefined ? "—" : (
                      <div className="space-y-0.5">
                        <BarraProgreso porcentaje={pct} etiqueta={`${c.etiqueta} de ${f.coleccion}`} />
                        {faltan > 0 && f.coleccionId && (
                          <button type="button" className="text-azul underline text-xs print:hidden" title={`${c.verPiezas} de ${f.coleccion}`}
                                  aria-label={`${c.verPiezas} de ${f.coleccion}`}
                                  onClick={() => onVer({ ...c.filtro, coleccionId: f.coleccionId ?? undefined })}>Ver {faltan.toLocaleString("es-PE")}</button>
                        )}
                      </div>
                    )}
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
  const contenido = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cerradas = new Set<HTMLDetailsElement>();
    // Imprimir incluye el detalle aunque la persona prefiera tenerlo plegado en pantalla.
    const antes = () => contenido.current?.querySelectorAll<HTMLDetailsElement>("details.insight-details").forEach((d) => {
      if (!d.open) { cerradas.add(d); d.open = true; }
    });
    const despues = () => { cerradas.forEach((d) => { d.open = false; }); cerradas.clear(); };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    return () => { window.removeEventListener("beforeprint", antes); window.removeEventListener("afterprint", despues); despues(); };
  }, []);
  return (
    <div ref={contenido} className="space-y-6">
      <PanoramaCatalogo reporte={reporte} onVerPiezas={onVerPiezas} />
      <details className="insight-details">
      <summary>Indicadores e historia del catálogo</summary>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
        {reporte.indicadores.map((i) => <Tarjeta key={i.clave} i={i} onVer={onVerPiezas} />)}
      </div>
      </details>
      {!reporte.historia.disponible && reporte.historia.motivo && <p role="note" className="text-sm text-gris-2">{reporte.historia.motivo}</p>}
      {reporte.faltantes && reporte.faltantes.length > 0 && (
        <details className="insight-details" aria-label="Qué falta, campo por campo">
          <summary>Ver todos los faltantes, campo por campo</summary>
          <p className="text-sm text-gris-2">En Inicio ves los motivos agrupados; aquí, cada campo por separado.</p>
          <ul className="divide-y divide-linea glass-panel">
            {reporte.faltantes.map((f) => (
              <li key={f.campo} className="insight-missing-row px-4 py-2 text-sm">
                <span className="truncate" title={f.etiqueta}>{f.etiqueta}</span>
                <div role="progressbar" aria-label={`Piezas a las que les falta ${f.etiqueta}`} aria-valuemin={0} aria-valuemax={reporte.totalPiezas} aria-valuenow={f.total}
                     className="h-2.5 rounded-pill bg-fondo-suave overflow-hidden">
                  <div className="h-full bg-rojo" style={{ width: `${reporte.totalPiezas ? Math.min(100, (f.total / reporte.totalPiezas) * 100) : 0}%`, minWidth: f.total > 0 ? "2px" : 0 }} />
                </div>
                <strong className="tabular-nums text-right w-14">{f.total.toLocaleString("es-PE")}</strong>
                <button type="button" className="text-azul underline font-semibold print:hidden" onClick={() => onVerPiezas(f.filtro)}>{f.verPiezas}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="insight-details">
        <summary>Tabla detallada por colección</summary>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3>Por colección</h3>
          <p className="text-sm text-gris-2">Ordenado por piezas · {reporte.porColeccion.length} {reporte.porColeccion.length === 1 ? "colección" : "colecciones"}</p>
        </div>
        <PorColeccion filas={reporte.porColeccion} indicadores={reporte.indicadores} onVer={onVerPiezas} />
        <p className="text-xs text-gris-2">Las cifras salen del mismo servicio que Inicio: nunca pueden dar números distintos.</p>
      </details>
    </div>
  );
}
