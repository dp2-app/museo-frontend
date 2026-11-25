import { useState } from "react";
import { Camera, ChevronDown, CircleCheck, MapPin, Tags, TriangleAlert } from "lucide-react";
import type { FiltrosConsulta, ReporteIndicadores } from "../../lib/reportes";
import { GraficoCompletitud } from "./Graficos";

const numero = (valor: number) => valor.toLocaleString("es-PE", { maximumFractionDigits: 1 });
const ICONOS = { fichasCompletas: CircleCheck, conFotografia: Camera, conUbicacion: MapPin, conCodigoI: Tags };

/** Una lectura visual de las cifras de F8: cada acción reutiliza el filtro que entregó la API. */
export function PanoramaCatalogo({ reporte, onVerPiezas }: { reporte: ReporteIndicadores; onVerPiezas: (f: FiltrosConsulta) => void }) {
  const [orden, setOrden] = useState("piezas");
  const porcentajes = reporte.indicadores.filter((i) => i.tipo === "porcentaje");
  const completo = porcentajes.find((i) => i.clave === "fichasCompletas");
  const cobertura = porcentajes.filter((i) => i.clave !== "fichasCompletas");
  const faltantes = [...(reporte.faltantes ?? [])].filter((f) => f.total > 0).sort((a, b) => b.total - a.total);
  const colecciones = [...reporte.porColeccion].sort((a, b) => orden === "completitud"
    ? (a.porcentajes.fichasCompletas ?? 0) - (b.porcentajes.fichasCompletas ?? 0) || b.totalPiezas - a.totalPiezas
    : b.totalPiezas - a.totalPiezas);
  const mayor = Math.max(1, ...colecciones.map((c) => c.totalPiezas));

  return <div className="catalog-overview">
    <div className="insight-metrics">{porcentajes.map((i) => {
      const Icono = ICONOS[i.clave as keyof typeof ICONOS] ?? CircleCheck;
      const cambio = i.porcentaje !== null && i.semanaAnterior ? Math.round((i.porcentaje - i.semanaAnterior.porcentaje) * 10) / 10 : null;
      return <article key={i.clave} className="insight-metric"><div><span className="insight-metric-icon"><Icono size={20} aria-hidden="true" /></span><h3>{i.etiqueta}</h3></div><strong>{i.porcentaje === null ? "—" : `${numero(i.porcentaje)} %`}</strong><p>{numero(i.valor)} de {numero(i.total)} piezas</p>{reporte.historia.disponible && cambio !== null && <span className="insight-comparison">{cambio > 0 ? "+" : ""}{numero(cambio)} puntos frente a la semana anterior</span>}{i.valor < i.total && <button type="button" onClick={() => onVerPiezas(i.filtro)}>{i.verPiezas}</button>}</article>;
    })}</div>

    {reporte.totalPiezas === 0 && <p className="insight-empty" role="status">No hay piezas con los filtros actuales. Cambia o limpia los filtros para explorar el catálogo.</p>}
    <div className="insight-analysis-grid">
      <section className="insight-coverage" aria-labelledby="insight-cobertura"><div className="dashboard-section-heading"><div><p className="catalog-eyebrow">Calidad del registro</p><h3 id="insight-cobertura">Una mirada a la cobertura</h3></div></div><div className="insight-coverage-body">
        {completo && <div className="insight-completion"><GraficoCompletitud porcentaje={completo.porcentaje ?? 0} total={reporte.totalPiezas} /><p><strong>{numero(completo.valor)}</strong> fichas completas</p></div>}
        <ul className="insight-coverage-bars">{cobertura.map((i) => <li key={i.clave}><div><span>{i.etiqueta}</span><strong>{i.porcentaje === null ? "—" : `${numero(i.porcentaje)} %`}</strong></div><div className="dashboard-bar-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, i.porcentaje ?? 0))}%` }} /></div><p>{numero(i.total - i.valor)} por completar</p></li>)}</ul>
      </div></section>

      <section className="insight-priorities" aria-labelledby="insight-pendientes"><p className="catalog-eyebrow">Oportunidades de avance</p><h3 id="insight-pendientes">Dónde falta más información</h3><p className="text-sm text-gris-2">Los campos con más pendientes, conectados con sus piezas.</p>{faltantes.length ? <ol>{faltantes.slice(0, 3).map((f) => <li key={f.campo}><span className="insight-priority-icon"><TriangleAlert size={18} aria-hidden="true" /></span><div><strong>{f.etiqueta}</strong><p>{numero(f.total)} piezas</p></div><button type="button" className="btn-glass" aria-label={`${f.verPiezas}: ${f.etiqueta}`} onClick={() => onVerPiezas(f.filtro)}>Revisar</button></li>)}</ol> : <p className="insight-empty">{reporte.totalPiezas ? "No hay faltantes de los campos visibles para tu cuenta." : "Los pendientes aparecerán al registrar piezas."}</p>}<p className="insight-overlap-note">Una pieza puede tener varios faltantes. Estos grupos no se suman.</p></section>
    </div>

    <section className="insight-collections" aria-labelledby="insight-colecciones"><div className="dashboard-section-heading"><div><p className="catalog-eyebrow">Volumen y avance</p><h3 id="insight-colecciones">El registro, colección por colección</h3></div><label className="insight-sort">Ordenar por<div><select value={orden} onChange={(e) => setOrden(e.target.value)}><option value="piezas">Más piezas</option>{completo && <option value="completitud">Menor completitud</option>}</select><ChevronDown size={16} aria-hidden="true" /></div></label></div>
      {colecciones.length ? <><div className="insight-collection-legend"><span>Fichas completas</span><span>Por completar</span></div><ol className="insight-collection-bars">{colecciones.slice(0, 8).map((c) => {
        const pct = c.porcentajes.fichasCompletas;
        return <li key={c.coleccionId ?? "sin-coleccion"}><div className="insight-collection-name"><strong>{c.coleccion}</strong><span>{numero(c.totalPiezas)} piezas</span></div><div className="insight-collection-track" aria-hidden="true" style={{ width: `${c.totalPiezas / mayor * 100}%` }}><span style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} /></div><div className="insight-collection-caption"><span>{pct === null || pct === undefined ? "Completitud no disponible" : `${numero(pct)} % completo`}</span>{completo && c.coleccionId && c.fichasCompletas < c.totalPiezas && <button type="button" aria-label={`Ver pendientes de ${c.coleccion}`} onClick={() => onVerPiezas({ ...completo.filtro, coleccionId: c.coleccionId! })}>Ver pendientes</button>}</div></li>;
      })}</ol>{colecciones.length > 8 && <p className="text-sm text-gris-2">Se muestran 8 de {numero(colecciones.length)} colecciones. El detalle completo está en la tabla inferior.</p>}</> : <p className="insight-empty">No hay un desglose por colección con estos filtros o tu cuenta no ve ese campo.</p>}
    </section>
  </div>;
}
