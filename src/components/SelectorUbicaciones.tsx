import { useEffect, useId, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronRight, MapPin, Search, X } from "lucide-react";
import type { Ubicacion } from "../lib/ficha";
import { ErrorConsulta } from "./FichaComun";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
function filtrar(nodos: Ubicacion[], texto: string): Ubicacion[] {
  return nodos.filter(n => n.activo).flatMap(n => {
    const coincide = !texto || normalizar(`${n.nombre} ${n.codigo ?? ""}`).includes(texto);
    const hijos = filtrar(n.hijos ?? [], coincide ? "" : texto);
    return coincide || hijos.length ? [{ ...n, hijos }] : [];
  });
}
function PanelUbicaciones({ nodos, elegido, elegir, error, cargando }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const scope = useId();
  const texto = normalizar(busqueda);
  const visibles = filtrar(nodos, texto);
  const padres: string[] = [];
  function buscarPadres(ns: Ubicacion[], camino: string[]): boolean {
    return ns.some(n => n.id === elegido ? (padres.push(...camino), true) : buscarPadres(n.hijos ?? [], [...camino, n.id]));
  }
  buscarPadres(nodos, []);
  const alternar = (id: string, abierta: boolean) => setAbiertas(prev => ({ ...prev, [id]: !abierta }));
  function ramas(ns: Ubicacion[], nivel = 0) {
    return <ul className={nivel ? "location-branches" : "space-y-1"}>{ns.map(n => {
      const hijos = n.hijos ?? [];
      const abierta = Boolean(texto) || (abiertas[n.id] ?? padres.includes(n.id));
      const Icono = n.nivelTipo === "sede" ? Building2 : MapPin;
      return <li key={n.id}>
        <div className="location-node">
          {hijos.length ? <button type="button" className="location-expand" aria-expanded={abierta} aria-controls={`${scope}-${n.id}`} aria-label={`${abierta ? "Contraer" : "Expandir"} ubicaciones de ${n.nombre}`} onClick={() => alternar(n.id, abierta)} disabled={Boolean(texto)}>{abierta ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button> : <span className="w-8 shrink-0" aria-hidden="true" />}
          <button type="button" className="location-choice" aria-pressed={elegido === n.id} onClick={() => elegir(n.id)} title={n.nombre}><Icono size={16} className="shrink-0" aria-hidden="true" /><span>{n.nombre}</span></button>
        </div>
        {hijos.length > 0 && <div id={`${scope}-${n.id}`} hidden={!abierta}>{abierta && ramas(hijos, nivel + 1)}</div>}
      </li>;
    })}</ul>;
  }
  return <nav aria-label="Sedes y ubicaciones" className="location-picker-body">
    <div className="space-y-3 p-4 border-b border-linea">
      <div><h2 className="section-title">Dónde</h2><p className="text-xs text-gris-2 mt-1">Abre una sede o busca una ubicación.</p></div>
      <label className="block"><span className="sr-only">Buscar ubicación</span><div className="relative"><Search size={17} className="absolute left-3 top-3.5 text-gris-2" aria-hidden="true" /><input type="search" className="glass-input !pl-9" placeholder="Buscar ubicación…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div></label>
      <div className="space-y-1"><button type="button" className="location-choice w-full" aria-pressed={elegido === ""} onClick={() => elegir("")}>Todas las piezas</button><button type="button" className="location-choice w-full" aria-pressed={elegido === "__sin__"} onClick={() => elegir("__sin__")}>Sin ubicación</button></div>
    </div>
    <div className="location-tree-scroll" tabIndex={0} role="region" aria-label="Árbol de ubicaciones">
      {cargando ? <p role="status" className="p-3 text-sm">Cargando ubicaciones…</p> : ramas(visibles)}
      {!cargando && !visibles.length && <p role="status" className="p-3 text-sm text-gris-2">{texto ? "No se encontraron ubicaciones. Prueba otro nombre o código." : "No hay ubicaciones activas."}</p>}
      <ErrorConsulta error={error} />
    </div>
  </nav>;
}
interface Props { nodos: Ubicacion[]; elegido: string; elegir: (id: string) => void; error: unknown; cargando: boolean; }
export function SelectorUbicaciones(props: Props) {
  const [abierto, setAbierto] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { const d = dialog.current; if (!d) return; if (abierto && !d.open) d.showModal(); if (!abierto && d.open) d.close(); }, [abierto]);
  useEffect(() => { const media = window.matchMedia("(min-width: 1024px)"); const cerrar = () => { if (media.matches) setAbierto(false); }; media.addEventListener("change", cerrar); return () => media.removeEventListener("change", cerrar); }, []);
  return <>
    <div className="location-picker-desktop glass-panel hidden lg:block self-start"><PanelUbicaciones {...props} /></div>
    <button ref={trigger} type="button" className="btn-glass lg:hidden justify-start" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(true)}><MapPin size={18} aria-hidden="true" />Filtrar por ubicación</button>
    <dialog id={id} ref={dialog} onKeyDownCapture={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAbierto(false); } }} aria-label="Filtrar por ubicación" className="location-picker-dialog backdrop:bg-azul/60" onClose={() => { setAbierto(false); trigger.current?.focus(); }} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) setAbierto(false); } }}>
      <div className="flex justify-end border-b border-linea p-2"><button type="button" className="btn-glass" aria-label="Cerrar filtro de ubicación" onClick={() => setAbierto(false)}><X size={20} aria-hidden="true" /></button></div>
      <PanelUbicaciones {...props} elegir={id => { props.elegir(id); setAbierto(false); }} />
    </dialog>
  </>;
}
