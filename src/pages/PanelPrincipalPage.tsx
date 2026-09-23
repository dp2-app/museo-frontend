import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LayoutDashboard, MapPinOff } from "lucide-react";
import { api } from "../lib/api";
import type { ReportePanelPrincipal } from "../types";

function TarjetaKpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-gris-2">{etiqueta}</p>
      <p className="font-display text-3xl font-extrabold text-azul">{valor}</p>
      {detalle && <p className="text-xs text-gris-2 mt-0.5">{detalle}</p>}
    </div>
  );
}

// HU-17: dashboard ejecutivo. Todos los roles con sesión lo ven (spec §6).
export function PanelPrincipalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reportes", "panel-principal"],
    queryFn: async () => (await api.get<ReportePanelPrincipal>("/reportes/panel-principal")).data,
  });

  const maximo = Math.max(1, ...(data?.distribucionPorColeccion.map((d) => d.total) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <LayoutDashboard size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Panel principal</h1>
          <p className="text-sm text-gris-2">HU-17, HU-09 · resumen ejecutivo del catálogo.</p>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-gris-2">Cargando panel...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TarjetaKpi etiqueta="Total de piezas" valor={String(data.totalPiezas)} />
            <TarjetaKpi etiqueta="Catalogación completa" valor={`${data.porcentajeCompleto}%`} />
            <TarjetaKpi
              etiqueta="Sin ubicación"
              valor={String(data.piezasSinUbicacion)}
              detalle="RF-019, HU-09"
            />
            <TarjetaKpi
              etiqueta="Requieren restauración"
              valor={String(data.piezasRequierenRestauracion)}
              detalle="HU-03"
            />
          </div>

          <div className="glass-panel p-5">
            <h2 className="section-title mb-4">Distribución por colección</h2>
            {data.distribucionPorColeccion.length === 0 ? (
              <p className="text-sm text-gris-2">Aún no hay piezas catalogadas en ninguna colección.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.distribucionPorColeccion.map((fila) => (
                  <li key={fila.coleccion} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm text-texto truncate">{fila.coleccion}</span>
                    <div className="flex-1 h-3 rounded-pill bg-fondo-suave overflow-hidden">
                      <div
                        className="h-full rounded-pill bg-rojo"
                        style={{ width: `${(fila.total / maximo) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-sm text-gris-2 text-right">{fila.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-panel p-5">
            <h2 className="section-title mb-4 flex items-center gap-2">
              <MapPinOff size={18} className="text-rojo" aria-hidden="true" />
              Alertas · piezas con ubicación o fotografía en blanco
            </h2>
            {data.alertas.length === 0 ? (
              <p className="text-sm text-gris-2">Sin alertas pendientes: todas las piezas tienen ubicación y foto.</p>
            ) : (
              <ul className="divide-y divide-linea">
                {data.alertas.slice(0, 20).map((a) => (
                  <li key={a.piezaId} className="py-2 flex items-center justify-between gap-3">
                    <Link to={`/coleccion/${a.piezaId}`} className="text-sm text-azul hover:underline truncate">
                      {a.denominacion || "(sin denominación)"}
                    </Link>
                    <span className="flex gap-1.5 shrink-0">
                      {a.camposFaltantes.includes("ubicacion") && <span className="chip">Sin ubicación</span>}
                      {a.camposFaltantes.includes("foto") && <span className="chip">Sin foto</span>}
                    </span>
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
