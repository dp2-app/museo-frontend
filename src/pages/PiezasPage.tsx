import { Cargando, EstadoVacio, FotoPieza } from "../components/SistemaVisual";
import { ArrowUpRight, Camera, LayoutGrid, LayoutTemplate, List, Upload } from "lucide-react";
import { CabeceraPagina } from "../components/SistemaVisual";
import { ImportacionModal } from "../components/f5/ImportacionModal";
import { RegistroPiezaModal } from "../components/RegistroPiezaModal";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarraBusquedaIA } from "../components/f10/BarraBusquedaIA";
import { Colecciones } from "../components/Colecciones";
import { FiltrosReporte } from "../components/f8/FiltrosReporte";
import { useOpcionesFiltro } from "../hooks/useOpcionesFiltro";
import { filtrosDeDireccion, parametros, type FiltrosConsulta } from "../lib/reportes";
import { ErrorConsulta } from "../components/FichaComun";
import { useRecurso } from "../lib/recursosFicha";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { AccesosF1 } from "../components/f1/PendienteCodigoI";
import { usePermisos } from "../hooks/usePermisos";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { nombreFicha, piezas as contarPiezas, type Ficha } from "../lib/ficha";
import type { Pagina } from "../types";

/** Lo que `camposFaltantes` nombra además de los campos de la ficha (definición única en el backend: `faltantes()`). */
const ETIQUETAS_FALTA: Record<string, string> = { codigos_externos: "código del museo", fotografias: "fotografía" };

export function PiezasPage() {
  const { puede, puedeAlguno, sesion } = usePermisos();
  const [vista, setVista] = useState<"tarjetas" | "tabla">("tarjetas");
  const [importando, setImportando] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [pagina, setPagina] = useState(1); const [direccion] = useSearchParams(); const [filtros, setFiltros] = useState<Record<string, unknown>>(() => filtrosDeDireccion(direccion));
  // La barra de búsqueda (y la IA) reemplazan los filtros: `version` remonta el formulario para que los muestre.
  const [version, setVersion] = useState(0);
  const aplicar = (f: FiltrosConsulta | Record<string, unknown>) => { setPagina(1); setFiltros(parametros(f as FiltrosConsulta)); setVersion((v) => v + 1); };
  const piezas = useRecurso<Pagina<Ficha>>("piezas", "/piezas", true, { ...filtros, pagina, tamano: 20 });
  const opciones = useOpcionesFiltro(); const catalogo = useCatalogoFicha();
  const etiquetaFalta = (clave: string) => ETIQUETAS_FALTA[clave] ?? catalogo.data?.find((c) => c.clave === clave)?.etiqueta ?? clave;
  /** «Completa» o un botón por cada dato que falta, que lleva a la ficha con ese campo señalado; `camposFaltantes` ya viene filtrado por rol (RF-57). */
  const completitud = (p: Ficha) => p.camposFaltantes.length === 0 && !p.incompleta ? <span>Completa</span>
    : p.camposFaltantes.length === 0 ? <span>Por completar</span>
    : <span className="flex flex-wrap gap-1">{p.camposFaltantes.map((c) => <Link key={c} className="chip !py-0 !px-2 !text-xs" to={`/coleccion/${p.id}?campo=${c}`} title={`Completar: ${etiquetaFalta(c)}`}>{etiquetaFalta(c)}</Link>)}</span>;
  return <div className="collection-page space-y-6"><CabeceraPagina titulo="Colección" descripcion="Registra piezas y completa las fichas del inventario." acciones={<>{puede("ia.usar") && <Link className="btn-glass" to="/asistente-ia"><LayoutTemplate size={18} aria-hidden="true" />Armar sala con IA</Link>}{puedeAlguno("importacion.ver", "importacion.cargar") && <button type="button" className="btn-carga-masiva" onClick={() => setImportando(true)}><Upload size={18} aria-hidden="true" />Carga masiva</button>}<button className="btn-primary" aria-haspopup="dialog" disabled={!puede("piezas.crear")} title={!puede("piezas.crear") ? "Tu rol no puede registrar piezas" : undefined} onClick={() => setNueva(true)}>Registrar pieza</button></>} />
    {importando && <ImportacionModal alCerrar={() => setImportando(false)} />}
    {nueva && <RegistroPiezaModal alCerrar={() => setNueva(false)} />}
    <div className="collection-utilities"><AccesosF1 />
      {/* La mayoría del inventario aún no tiene foto: este acceso deja ver primero las piezas fotografiadas. */}
      <button type="button" className="btn-glass" aria-pressed={Boolean(filtros.conFotografia)}
        onClick={() => aplicar(filtros.conFotografia ? { ...filtros, conFotografia: false } : { ...filtros, conFotografia: true, sinFotografia: false })}>
        <Camera size={20} aria-hidden="true" />{filtros.conFotografia ? "Ver todas las piezas" : "Ver piezas con fotografía"}</button>
      {puede("colecciones.gestionar") && <details><summary>Gestionar colecciones</summary><Colecciones /></details>}
    </div>

    <BarraBusquedaIA key={`barra-${direccion.toString()}`} filtros={filtros} onAplicar={aplicar} />
    <FiltrosReporte key={`${direccion.toString()}-${version}`} inicial={filtros as FiltrosConsulta} opciones={opciones} camposOcultos={sesion?.camposOcultos ?? []} veNoAprobadas={puede("piezas.ver_no_aprobadas")} aplicados={filtros}
      onAplicar={aplicar} /><ErrorConsulta error={piezas.error} />{piezas.isPending && <Cargando>Cargando piezas…</Cargando>}
    <div className="collection-toolbar"><p className="text-sm text-gris-2">Resultados de la colección</p>
      <div className="view-switch" role="group" aria-label="Vista de la colección"><button type="button" aria-pressed={vista === "tarjetas"} onClick={() => setVista("tarjetas")}><LayoutGrid size={18} aria-hidden="true" />Tarjetas</button><button type="button" aria-pressed={vista === "tabla"} onClick={() => setVista("tabla")}><List size={18} aria-hidden="true" />Tabla</button></div>
    </div>
    {vista === "tarjetas" && <div className="collection-grid">{piezas.data?.items.map((p) => <article key={p.id} className="piece-card">
      <Link to={`/coleccion/${p.id}`} className="catalog-photo" aria-label={`Ver fotografía y ficha de ${nombreFicha(p)}`}><FotoPieza url={p.fotoPrincipal?.url} nombre={nombreFicha(p)} /></Link>
      <div className="piece-card-top"><span className="catalog-eyebrow">Registro de colección</span><ChipEstadoFicha estado={p.estadoFicha} /></div>
      <h2 className="piece-card-title"><Link to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link></h2>
      <p className="text-sm text-gris-2 break-words">{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</p>
      {"coleccion_id" in p.campos && <p className="text-sm text-azul">{p.etiquetas.coleccion_id || "Sin colección"}</p>}
      <div className="piece-card-footer"><p className="text-xs text-gris-2 mb-2">{p.camposFaltantes.length ? "Le falta" : "Información de la ficha"}</p>{completitud(p)}</div>
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-azul hover:underline" to={`/coleccion/${p.id}`} aria-label={`Abrir ficha de ${nombreFicha(p)}`}>Abrir ficha<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </article>)}</div>}
    {vista === "tabla" && <div className="glass-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-4">Pieza / códigos</th><th className="p-4">Colección</th><th className="p-4">Estado de la ficha</th><th className="p-4">Qué le falta</th></tr></thead>
      <tbody>{piezas.data?.items.map((p) => <tr key={p.id} className="border-t border-linea"><td className="p-4"><Link className="text-azul underline font-semibold" to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link><p>{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</p></td><td className="p-4">{p.etiquetas.coleccion_id || "Sin colección"}</td><td className="p-4"><ChipEstadoFicha estado={p.estadoFicha} /></td><td className="p-4">{completitud(p)}</td></tr>)}</tbody></table>
    </div>}
    {piezas.data?.total === 0 && <EstadoVacio titulo="No se encontraron piezas." descripcion="Prueba con otros términos o ajusta los filtros de la colección." />}
    <div className="flex flex-wrap gap-3 items-center"><button className="btn-glass" disabled={pagina === 1 || piezas.isFetching} onClick={() => setPagina(pagina - 1)}>Anterior</button><p>Página {pagina} · {contarPiezas(piezas.data?.total ?? 0)}</p><button className="btn-glass" disabled={!piezas.data || pagina * 20 >= piezas.data.total || piezas.isFetching} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>
  </div>;
}
