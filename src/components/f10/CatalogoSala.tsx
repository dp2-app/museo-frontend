import { LayoutGrid, List, MapPin, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { FotoPieza } from "../SistemaVisual";
import type { PiezaSala } from "../../types";

export type VistaSala = "catalogo" | "lista";

export function SelectorVistaSala({ vista, onCambiar }: { vista: VistaSala; onCambiar: (vista: VistaSala) => void }) {
  return <div className="view-switch" role="group" aria-label="Vista de las piezas propuestas">
    <button type="button" aria-pressed={vista === "catalogo"} onClick={() => onCambiar("catalogo")}><LayoutGrid size={18} aria-hidden="true" />Catálogo</button>
    <button type="button" aria-pressed={vista === "lista"} onClick={() => onCambiar("lista")}><List size={18} aria-hidden="true" />Lista</button>
  </div>;
}

/** Las dos vistas usan las mismas piezas, en el orden del ranking y con la misma selección. */
export function CatalogoSala({ piezas, elegidas, vista, onAlternar }: {
  piezas: PiezaSala[]; elegidas: Set<string>; vista: VistaSala; onAlternar: (id: string) => void;
}) {
  return <ul className={`sala-results sala-results-${vista}`} aria-label="Piezas propuestas para la sala">
    {piezas.map((p) => {
      const nombre = p.denominacion || "Pieza sin denominación";
      return <li key={p.piezaId} className={`sala-piece ${elegidas.has(p.piezaId) ? "sala-piece-selected" : ""}`}>
        <div className="sala-piece-image">
          <FotoPieza url={p.fotoPrincipal?.url} nombre={nombre} ampliable />
          <span className="sala-rank" aria-label={`Posición ${p.posicion} en la propuesta`}>#{p.posicion}</span>
        </div>
        <div className="sala-piece-body">
          <div className="sala-piece-topline">
            <span className="sala-affinity" title="Puntaje comparativo de afinidad con el tema; no es una probabilidad.">Afinidad <strong>{p.puntaje}<span>/100</span></strong></span>
            <label className="sala-piece-check"><input type="checkbox" checked={elegidas.has(p.piezaId)} onChange={() => onAlternar(p.piezaId)} aria-label={`Elegir ${nombre}`} /><span>{elegidas.has(p.piezaId) ? "Elegida" : "Elegir"}</span></label>
          </div>
          <h3><Link to={`/coleccion/${p.piezaId}`}>{nombre}</Link></h3>
          <p className="sala-piece-code">{[p.codigo, p.tipoBien].filter(Boolean).join(" · ") || "Sin código registrado"}</p>
          <dl className="sala-piece-data">
            {p.materiales && <div><dt>Material</dt><dd>{p.materiales}</dd></div>}
            {p.procedencia && <div><dt>Procedencia</dt><dd>{p.procedencia}</dd></div>}
            {vista === "lista" && p.autor && <div><dt>Autor</dt><dd>{p.autor}</dd></div>}
          </dl>
          {p.ubicacion && <p className="sala-piece-location"><MapPin size={15} aria-hidden="true" />{p.ubicacion}</p>}
          {p.alertas.length > 0 && <ul className="sala-piece-alerts" aria-label={`Alertas de ${nombre}`}>{p.alertas.map((a) => <li key={a.codigo}><TriangleAlert size={15} aria-hidden="true" />{a.mensaje}</li>)}</ul>}
          <Link className="sala-piece-link" to={`/coleccion/${p.piezaId}`}>Ver ficha</Link>
        </div>
      </li>;
    })}
  </ul>;
}
