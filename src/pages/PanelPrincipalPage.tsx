import { CabeceraPagina } from "../components/SistemaVisual";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Info, LayoutDashboard } from "lucide-react";
import { api } from "../lib/api";
import { enlaceColeccion } from "../lib/reportes";
import { Cargando } from "../components/SistemaVisual";
import { ErrorConsulta } from "../components/FichaComun";
import type { ReportePanelPrincipal } from "../types";

function TarjetaPendiente({ etiqueta, valor, filtro }: { etiqueta: string; valor: number | null | undefined; filtro?: Record<string, string | boolean> | null }) {
  if (valor === null || valor === undefined) return null;
  return (
    <div className="kpi-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-gris-2">{etiqueta}</p>
      <p className="font-display text-3xl font-extrabold text-azul">{valor.toLocaleString("es-PE")}</p>
      {filtro && valor > 0 && <Link className="text-azul underline text-xs font-semibold" to={enlaceColeccion(filtro)}>Ver las piezas</Link>}
    </div>
  );
}

/** Inicio: un resumen de las mismas cifras de Consultas y reportes (un solo servicio en el backend, #208). */
export function PanelPrincipalPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reportes", "panel-principal"],
    queryFn: async () => (await api.get<ReportePanelPrincipal>("/reportes/panel-principal")).data,
  });
  const maximo = Math.max(1, ...(data?.distribucionPorColeccion.map((d) => d.total) ?? [1]));
  const motivos = Object.values(data?.motivosIncompletas ?? {});
  const incompletas = data?.piezasIncompletas ?? 0;

  return (
    <div className="space-y-6">
      <CabeceraPagina titulo="Inicio" icono={LayoutDashboard} descripcion="Cómo va la catalogación del museo y qué conviene completar primero." />

      {error ? <div className="space-y-3"><ErrorConsulta error={error} /><button className="btn-glass" onClick={() => void refetch()}>Reintentar</button></div> : isLoading || !data ? (
        <Cargando />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="kpi-card dashboard-summary">
              <p className="text-xs font-semibold uppercase tracking-wide text-gris-2">Total de piezas</p>
              <p className="font-display text-3xl font-extrabold text-azul">{data.totalPiezas.toLocaleString("es-PE")}</p>
            </div>
            <div className="kpi-card dashboard-summary">
              <p className="text-xs font-semibold uppercase tracking-wide text-gris-2 flex items-center gap-1">
                Fichas completas
                <span title="Una ficha está completa cuando tiene todos los datos que el museo exige: campos obligatorios, código del museo y fotografía." className="inline-flex" tabIndex={0} aria-label="Qué es una ficha completa">
                  <Info size={14} aria-hidden="true" />
                </span>
              </p>
              <p className="font-display text-3xl font-extrabold text-azul">{data.porcentajeCompleto.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%</p>
              {incompletas > 0 && <p className="text-xs text-gris-2">{incompletas.toLocaleString("es-PE")} por completar</p>}
            </div>
            <TarjetaPendiente etiqueta="Requieren atención" valor={data.piezasRequierenAtencion} />
          </div>

          {incompletas > 0 && motivos.length > 0 && (
            <section className="glass-panel p-5 space-y-3" aria-label="Por qué hay fichas incompletas">
              <h2 className="section-title">Por qué hay {incompletas.toLocaleString("es-PE")} fichas incompletas</h2>
              <p className="text-sm text-gris-2">Una ficha puede tener varios motivos a la vez, por eso los números no suman el total.</p>
              <ul className="divide-y divide-linea">
                {motivos.map((m) => (
                  <li key={m.clave} className="py-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-texto">{m.etiqueta}: <strong>{m.total.toLocaleString("es-PE")}</strong></span>
                    {m.total > 0 && <Link className="btn-glass !py-1 !px-3 text-sm" to={enlaceColeccion(m.filtro)}>Completar</Link>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2" aria-label="Pendientes">
            <h2 className="section-title">Pendientes</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <TarjetaPendiente etiqueta="Sin código I" valor={data.piezasSinCodigoI} filtro={data.filtros?.piezasSinCodigoI} />
              <TarjetaPendiente etiqueta="Sin ubicación" valor={data.piezasSinUbicacion} filtro={data.filtros?.piezasSinUbicacion} />
              <TarjetaPendiente etiqueta="Sin fotografía" valor={data.piezasSinFoto} filtro={data.filtros?.piezasSinFoto} />
              <TarjetaPendiente etiqueta="Por aprobar" valor={data.piezasPorAprobar} filtro={data.filtros?.piezasPorAprobar} />
            </div>
          </section>

          <div className="glass-panel p-5">
            <h2 className="section-title mb-4">Colecciones con más piezas</h2>
            {data.distribucionPorColeccion.length === 0 ? (
              <p className="text-sm text-gris-2">Aún no hay piezas catalogadas en ninguna colección.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.distribucionPorColeccion.slice(0, 8).map((fila) => (
                  <li key={fila.coleccion} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm text-texto truncate">{fila.coleccion}</span>
                    <div className="flex-1 h-3 rounded-pill bg-fondo-suave overflow-hidden">
                      <div className="h-full rounded-pill bg-rojo" style={{ width: `${(fila.total / maximo) * 100}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-sm text-gris-2 text-right">{fila.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
