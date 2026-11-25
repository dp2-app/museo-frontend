import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChartNoAxesCombined, ChevronDown, CircleCheck, Info, LayoutDashboard, LayoutTemplate, TriangleAlert } from "lucide-react";
import { CabeceraPagina, Cargando, FotoPieza } from "../components/SistemaVisual";
import { ErrorConsulta } from "../components/FichaComun";
import { GraficoCompletitud } from "../components/f8/Graficos";
import { api } from "../lib/api";
import { enlaceColeccion } from "../lib/reportes";
import { usePermisos } from "../hooks/usePermisos";
import { useRecurso } from "../lib/recursosFicha";
import { nombreFicha, type Ficha } from "../lib/ficha";
import type { Pagina, ReportePanelPrincipal } from "../types";

const numero = (valor: number) => valor.toLocaleString("es-PE");

function TarjetaPendiente({ etiqueta, valor, filtro }: { etiqueta: string; valor: number | null | undefined; filtro?: Record<string, string | boolean> | null }) {
  if (valor === null || valor === undefined) return null;
  return <article className="home-pending-card"><p>{etiqueta}</p><strong>{numero(valor)}</strong>{filtro && valor > 0 ? <Link to={enlaceColeccion(filtro)}>Ver las piezas</Link> : <span>{valor === 0 ? "Al día" : "Piezas pendientes"}</span>}</article>;
}

/** Cifras de F8: la presentación no vuelve a definir completitud ni visibilidad. */
export function PanelPrincipalPage() {
  const { puede } = usePermisos();
  const seleccion = useRecurso<Pagina<Ficha>>("panel-seleccion", "/piezas", puede("piezas.ver"), { pagina: 1, tamano: 3 });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reportes", "panel-principal"],
    queryFn: async () => (await api.get<ReportePanelPrincipal>("/reportes/panel-principal")).data,
  });
  const maximo = Math.max(1, ...(data?.distribucionPorColeccion.map((d) => d.total) ?? []));
  const motivos = Object.values(data?.motivosIncompletas ?? {});
  const incompletas = data?.piezasIncompletas;

  return <div className="home-page space-y-6">
    <CabeceraPagina titulo="Inicio" icono={LayoutDashboard} descripcion="Una mirada al patrimonio que cuidamos y al trabajo que sigue."
      acciones={<>{puede("ia.usar") && <Link className="btn-glass" to="/asistente-ia"><LayoutTemplate size={18} aria-hidden="true" />Armar sala con IA</Link>}{puede("reportes.ver") && <Link className="btn-glass" to="/consultas-y-reportes"><ChartNoAxesCombined size={18} aria-hidden="true" />Ver reportes</Link>}</>} />
    {error ? <div className="space-y-3"><ErrorConsulta error={error} /><button className="btn-glass" onClick={() => void refetch()}>Reintentar</button></div> : isLoading || !data ? <Cargando /> : <>
      <div className="home-summary-grid">
        <article className="home-stat home-stat-primary"><p>Total de piezas</p><strong>{numero(data.totalPiezas)}</strong><span>El catálogo visible para tu cuenta</span></article>
        <article className="home-stat"><p>Fichas completas <span title="Una ficha está completa cuando reúne los datos exigidos por la configuración del museo." tabIndex={0} aria-label="Qué es una ficha completa"><Info size={16} aria-hidden="true" /></span></p><strong>{data.porcentajeCompleto.toLocaleString("es-PE", { maximumFractionDigits: 1 })}<small> %</small></strong><span>{incompletas === undefined ? "Según los requisitos del museo" : `${numero(incompletas)} por completar`}</span></article>
        <article className="home-stat"><p>Requieren atención</p><strong>{numero(data.piezasRequierenAtencion)}</strong><span>Conservación y cuidado de las piezas</span></article>
      </div>

      <div className="home-charts-grid">
        <section className="glass-panel home-collections" aria-labelledby="home-colecciones">
          <div className="dashboard-section-heading"><div><p className="catalog-eyebrow">Nuestro patrimonio</p><h2 id="home-colecciones">Colecciones con más piezas</h2></div><span className="dashboard-context">Piezas registradas</span></div>
          {data.distribucionPorColeccion.length === 0 ? <p className="dashboard-empty">Aún no hay piezas catalogadas. Las colecciones aparecerán aquí al registrar el inventario.</p> : <ol className="home-collection-bars">{data.distribucionPorColeccion.slice(0, 6).map((fila) => <li key={fila.coleccion}><div><span>{fila.coleccion}</span><strong>{numero(fila.total)}</strong></div><div className="dashboard-bar-track" aria-hidden="true"><span style={{ width: `${fila.total / maximo * 100}%` }} /></div></li>)}</ol>}
        </section>
        <section className="glass-panel home-progress" aria-labelledby="home-avance"><p className="catalog-eyebrow">Avance del registro</p><h2 id="home-avance">Cada ficha cuenta</h2><GraficoCompletitud porcentaje={data.porcentajeCompleto} total={data.totalPiezas} /><div className="home-chart-legend"><span><CircleCheck size={17} aria-hidden="true" />Fichas completas</span><strong>{incompletas === undefined ? `${data.porcentajeCompleto} %` : numero(data.totalPiezas - incompletas)}</strong></div>{incompletas !== undefined && <div className="home-chart-legend"><span><Info size={17} aria-hidden="true" />Por completar</span><strong>{numero(incompletas)}</strong></div>}<p className="text-sm text-gris-2">{data.totalPiezas ? "Datos, código y fotografía, según lo que exige el museo." : "Registra piezas para empezar a ver el avance."}</p></section>
      </div>

      <section className="space-y-3" aria-labelledby="home-pendientes"><div className="dashboard-section-heading"><div><p className="catalog-eyebrow">Del panorama a la acción</p><h2 id="home-pendientes">Pendientes</h2></div><span className="dashboard-context">Una pieza puede aparecer en más de un grupo.</span></div><div className="home-pending-grid">
        <TarjetaPendiente etiqueta="Sin código I" valor={data.piezasSinCodigoI} filtro={data.filtros?.piezasSinCodigoI} />
        <TarjetaPendiente etiqueta="Sin ubicación" valor={data.piezasSinUbicacion} filtro={data.filtros?.piezasSinUbicacion} />
        <TarjetaPendiente etiqueta="Sin fotografía" valor={data.piezasSinFoto} filtro={data.filtros?.piezasSinFoto} />
        <TarjetaPendiente etiqueta="Por aprobar" valor={data.piezasPorAprobar} filtro={data.filtros?.piezasPorAprobar} />
      </div></section>

      {incompletas !== undefined && incompletas > 0 && motivos.length > 0 && <details className="home-incomplete-details glass-panel"><summary><TriangleAlert size={21} aria-hidden="true" /><span><strong>{numero(incompletas)} fichas por completar</strong><span>Consulta los motivos cuando necesites profundizar.</span></span><span className="home-details-action">Ver motivos <ChevronDown size={18} aria-hidden="true" /></span></summary><section className="home-incomplete-content" aria-label="Por qué hay fichas incompletas"><h2>Por qué hay {numero(incompletas)} fichas incompletas</h2><p>Una ficha puede tener varios motivos a la vez, por eso los números no suman el total.</p><ul>{motivos.map((m) => <li key={m.clave}><span>{m.etiqueta} <strong>{numero(m.total)}</strong></span>{m.total > 0 && <Link className="btn-glass" to={enlaceColeccion(m.filtro)}>Completar</Link>}</li>)}</ul></section></details>}

      {!!seleccion.data?.items.length && <section className="dashboard-gallery" aria-label="Explora la colección"><div className="dashboard-gallery-copy"><span className="catalog-eyebrow">El patrimonio, de cerca</span><h2>Explora la colección</h2><p>Cada ficha reúne una pieza, su historia y el trabajo para conservarla.</p><Link to="/coleccion" className="btn-glass">Abrir catálogo</Link></div><div className="dashboard-gallery-pieces">{seleccion.data.items.slice(0, 3).map((p) => <Link key={p.id} to={`/coleccion/${p.id}`}><FotoPieza url={p.fotoPrincipal?.url} nombre={nombreFicha(p)} /><span>{nombreFicha(p)}</span></Link>)}</div></section>}
    </>}
  </div>;
}
