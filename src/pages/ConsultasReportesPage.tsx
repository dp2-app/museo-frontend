import { useState } from "react";
import { Link } from "react-router-dom";
import { Database, FileDown, Printer, Search } from "lucide-react";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { ErrorConsulta } from "../components/FichaComun";
import { FiltrosReporte } from "../components/f8/FiltrosReporte";
import { CuerpoReporte, Encabezado } from "../components/f8/VistaReporte";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { nombresDeOpciones, useOpcionesFiltro } from "../hooks/useOpcionesFiltro";
import { usePermisos } from "../hooks/usePermisos";
import { extraerMensajeError } from "../lib/api";
import { nombreFicha, type Ficha } from "../lib/ficha";
import { useRecurso } from "../lib/recursosFicha";
import { descargarExcel, parametros, totalDe, type ClaveReporte, type EncabezadoReporte, type FiltrosConsulta } from "../lib/reportes";
import type { Pagina } from "../types";

type Pestana = "busqueda" | ClaveReporte;
const TAMANO = 20;

// F8 · Consultas y reportes (RF-45..RF-49) sobre el contrato v3. La búsqueda y los reportes usan los mismos filtros
// de GET /piezas (F7); el backend aplica la visibilidad por rol y solo fichas aprobadas a quien no ve las demás.
// La autorización real la valida el backend: los botones solo se ocultan por permiso para no ofrecer un 403.
export function ConsultasReportesPage() {
  const { puede, sesion } = usePermisos();
  const camposOcultos = sesion?.camposOcultos ?? [];
  const opciones = useOpcionesFiltro();
  const catalogo = useCatalogoFicha();
  const etiquetas = Object.fromEntries((catalogo.data ?? []).map((c) => [c.clave, c.etiqueta]));
  const [filtros, setFiltros] = useState<FiltrosConsulta>({});
  const [pestana, setPestana] = useState<Pestana>("busqueda");
  const [pagina, setPagina] = useState(1);
  const [mensaje, setMensaje] = useState("");
  const [descargando, setDescargando] = useState(false);
  const params = parametros(filtros);

  const pestanas: [Pestana, string][] = [
    ["busqueda", "Búsqueda"], ["inventario", "Inventario"], ["por-estado", "Por estado"],
    ...(camposOcultos.includes("ubicacion_actual_id") ? [] : [["por-ubicacion", "Por ubicación"] as [Pestana, string]]),
    ["informacion-incompleta", "Información incompleta"],
  ];
  const busqueda = useRecurso<Pagina<Ficha>>("f8-busqueda", "/piezas", pestana === "busqueda", { ...params, pagina, tamano: TAMANO });
  const reporte = useRecurso<EncabezadoReporte>("f8-reporte", `/reportes/${pestana}`, pestana !== "busqueda", params);

  async function exportar(ruta: string, nombre: string, conFiltros = true) {
    setDescargando(true);
    setMensaje("");
    try {
      const filas = await descargarExcel(ruta, conFiltros ? params : {}, nombre);
      setMensaje(`Exportación lista: ${filas} pieza(s).`);
    } catch (error) {
      setMensaje(extraerMensajeError(error));
    } finally {
      setDescargando(false);
    }
  }
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5 print:hidden">
        <Search size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Consultas y reportes</h1>
          <p className="text-sm text-gris-2">Busca con filtros combinados, genera reportes y expórtalos sin los campos restringidos para tu rol.</p>
        </div>
      </div>

      <FiltrosReporte opciones={opciones} camposOcultos={camposOcultos} veNoAprobadas={puede("piezas.ver_no_aprobadas")}
                      onAplicar={(f) => { setFiltros(f); setPagina(1); }} />

      <div role="tablist" aria-label="Consultas y reportes" className="flex flex-wrap gap-2 border-b border-linea print:hidden">
        {pestanas.map(([clave, etiqueta]) => (
          <button key={clave} role="tab" aria-selected={pestana === clave} onClick={() => { setPestana(clave); setMensaje(""); }}
                  className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition ${
                    pestana === clave ? "border-rojo text-azul" : "border-transparent text-gris-2 hover:text-azul"}`}>
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center print:hidden">
        {puede("reportes.exportar") && (
          <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" disabled={descargando}
                  onClick={() => pestana === "busqueda"
                    ? exportar("/exportaciones/piezas.xlsx", `piezas_${hoy}.xlsx`)
                    : exportar(`/exportaciones/reportes/${pestana}.xlsx`, `${pestana}_${hoy}.xlsx`)}>
            <FileDown size={16} aria-hidden="true" /> Exportar Excel
          </button>
        )}
        {pestana !== "busqueda" && (
          <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Imprimir o guardar como PDF
          </button>
        )}
        {puede("reportes.exportar_total") && (
          <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" disabled={descargando}
                  title="Todas las piezas con todos los campos que tu rol ve; no aplica los filtros (RF-49)"
                  onClick={() => exportar("/exportaciones/catalogo-completo.xlsx", `catalogo_completo_${hoy}.xlsx`, false)}>
            <Database size={16} aria-hidden="true" /> Exportar catálogo completo
          </button>
        )}
        {descargando && <span className="text-sm text-gris-2">Preparando el archivo…</span>}
        {mensaje && <p role="status" className="text-sm">{mensaje}</p>}
      </div>

      <div role="tabpanel" className="glass-panel p-4 space-y-4">
        {pestana === "busqueda" ? (
          <>
            <ErrorConsulta error={busqueda.error} />
            {busqueda.isPending && <p>Buscando…</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
                  <tr><th className="px-4 py-2">Pieza</th><th className="px-4 py-2">Códigos</th><th className="px-4 py-2">Colección</th>
                    <th className="px-4 py-2">Ficha</th><th className="px-4 py-2">Información</th></tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {busqueda.data?.items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2"><Link className="text-azul underline font-semibold" to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link></td>
                      <td className="px-4 py-2">{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</td>
                      <td className="px-4 py-2">{p.etiquetas.coleccion_id || "—"}</td>
                      <td className="px-4 py-2"><ChipEstadoFicha estado={p.estadoFicha} /></td>
                      <td className="px-4 py-2">{p.incompleta ? "Por completar" : "Completa"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {busqueda.data?.total === 0 && <p className="p-4 text-gris-2">Ninguna pieza cumple los filtros.</p>}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="btn-glass" disabled={pagina === 1 || busqueda.isFetching} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <p>Página {pagina} · {busqueda.data?.total ?? 0} piezas</p>
              <button className="btn-glass" disabled={!busqueda.data || pagina * TAMANO >= busqueda.data.total || busqueda.isFetching}
                      onClick={() => setPagina(pagina + 1)}>Siguiente</button>
            </div>
          </>
        ) : (
          <>
            <ErrorConsulta error={reporte.error} />
            {reporte.isPending && <p>Generando el reporte…</p>}
            {reporte.data && (
              <>
                <Encabezado reporte={reporte.data} total={totalDe(pestana, reporte.data)} nombres={nombresDeOpciones(opciones)} />
                <CuerpoReporte clave={pestana} datos={reporte.data} etiquetas={etiquetas} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
