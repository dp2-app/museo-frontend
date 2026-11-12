import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Database, FileDown, Info, Printer, Search } from "lucide-react";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { FiltrosReporte } from "../components/f8/FiltrosReporte";
import { CuerpoReporte, Encabezado } from "../components/f8/VistaReporte";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { nombresDeOpciones, useOpcionesFiltro } from "../hooks/useOpcionesFiltro";
import { usePermisos } from "../hooks/usePermisos";
import { nombreFicha, piezas as contarPiezas, type Ficha } from "../lib/ficha";
import { get, useRecurso } from "../lib/recursosFicha";
import {
  descargarExcel, esPaginado, filasDeImpresion, MAX_FILAS_IMPRESION, mensajeReporte, parametros, TAMANO_PAGINA_REPORTE, totalDe,
  type ClaveReporte, type EncabezadoReporte, type FiltrosConsulta, type PaginacionReporte,
} from "../lib/reportes";
import type { Pagina } from "../types";

/** Error de una consulta con mensaje según el caso y «Reintentar» sin perder los filtros (QA F8-01 y F8-05). */
function ErrorReporte({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3">
      <p className="text-rojo">{mensajeReporte(error)}</p>
      <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" onClick={onReintentar}>Reintentar</button>
    </div>
  );
}

type Pestana = "busqueda" | ClaveReporte;

/** Qué es cada pestaña y qué trae su Excel (el (i) de la barra de pestañas). */
const AYUDA: Record<Pestana, string> = {
  busqueda: "Lista de piezas (20 por página) con los filtros de arriba; no es un reporte. Su Excel trae la ficha completa de todas las piezas que cumplen los filtros, con los campos que tu rol puede ver.",
  indicadores: "Indicadores de gestión: qué porcentaje del catálogo tiene la ficha completa, fotografía, ubicación y código I, comparado con la línea base y con la semana anterior. Cada número lleva a la lista de piezas que le falta. Su Excel trae las mismas tarjetas y la tabla por colección.",
  inventario: "Inventario: una fila por pieza con su código I, otros códigos, denominación, colección y si le falta información. Su Excel trae las mismas filas.",
  "por-estado": "Cuántas piezas hay por estado de la pieza y por estado de conservación. Los valores se muestran como están registrados. Su Excel trae una hoja por cada grupo.",
  "por-ubicacion": "Cuántas piezas hay en cada ubicación, más las que no tienen ubicación. Su Excel trae la misma tabla.",
  "informacion-incompleta": "Qué piezas tienen campos obligatorios, código del museo o fotografía sin completar, cuántas son por colección y qué falta más. Su Excel trae el resumen por colección, qué falta más y el detalle por pieza.",
};
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
  const [paginaReporte, setPaginaReporte] = useState(1);
  // Reportes paginados por el servidor: para imprimir se pide el conjunto completo (hasta MAX_FILAS_IMPRESION) y se dibuja solo al imprimir.
  const [impresion, setImpresion] = useState<{ clave: Pestana; datos: EncabezadoReporte } | null>(null);
  const [preparandoImpresion, setPreparandoImpresion] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [versionFormulario, setVersionFormulario] = useState(0);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const params = parametros(filtros);
  const verUbicacion = !camposOcultos.includes("ubicacion_actual_id");
  const verEstado = !camposOcultos.includes("estado_pieza_id");

  const pestanas: [Pestana, string][] = [
    ["busqueda", "Búsqueda"], ["indicadores", "Indicadores"], ["inventario", "Inventario"], ["por-estado", "Por estado"],
    ...(camposOcultos.includes("ubicacion_actual_id") ? [] : [["por-ubicacion", "Por ubicación"] as [Pestana, string]]),
    ["informacion-incompleta", "Información incompleta"],
  ];
  const busqueda = useRecurso<Pagina<Ficha>>("f8-busqueda", "/piezas", pestana === "busqueda", { ...params, pagina, tamano: TAMANO });
  const paginado = esPaginado(pestana);
  const reporte = useRecurso<EncabezadoReporte & Partial<PaginacionReporte>>(
    "f8-reporte", `/reportes/${pestana}`, pestana !== "busqueda", paginado ? { ...params, pagina: paginaReporte, tamano: TAMANO_PAGINA_REPORTE } : params);

  async function exportar(ruta: string, nombre: string, conFiltros = true) {
    setDescargando(true);
    setMensaje("");
    try {
      const filas = await descargarExcel(ruta, conFiltros ? params : {}, nombre);
      setMensaje(filas > 0 ? `Exportación lista: ${filas} pieza(s).` : "No hay piezas para exportar con los filtros actuales.");
    } catch (error) {
      setMensaje(mensajeReporte(error, "No se pudo generar el Excel. Tus filtros se mantienen."));
    } finally {
      setDescargando(false);
    }
  }
  const reportePendiente = reporte.isPending || reporte.isFetching;
  const consultando = pestana === "busqueda" ? busqueda.isPending || busqueda.isFetching : reportePendiente;
  const filasImpresion = reporte.data && pestana !== "busqueda" ? filasDeImpresion(pestana, reporte.data) : 0;
  const hayVariasPaginas = (reporte.data?.paginas ?? 1) > 1;
  const demasiadasParaImprimir = filasImpresion > MAX_FILAS_IMPRESION;
  /** Desde un indicador: abre la búsqueda con los filtros vigentes más el que lista lo que falta. */
  function verPiezas(filtro: FiltrosConsulta) {
    setFiltros({ ...filtros, ...filtro });
    setPagina(1);
    setPaginaReporte(1);
    olvidarImpresion();
    setMensaje("");
    setPestana("busqueda");
    setVersionFormulario((v) => v + 1);
  }
  function olvidarImpresion() { setImpresion(null); setPreparandoImpresion(false); }
  /** Imprime lo que corresponde a los filtros, no a la página que se ve: con varias páginas pide primero el conjunto completo. */
  async function imprimir() {
    if (pestana === "busqueda" || !hayVariasPaginas) { window.print(); return; }
    setPreparandoImpresion(true);
    setMensaje("");
    try {
      setImpresion({ clave: pestana, datos: await get<EncabezadoReporte>(`/reportes/${pestana}`, params) });
    } catch (error) {
      setMensaje(mensajeReporte(error, "No se pudo preparar la impresión. Tus filtros se mantienen."));
      setPreparandoImpresion(false);
    }
  }
  useEffect(() => {
    if (!impresion || !preparandoImpresion) return;
    // Espera a que el navegador dibuje la copia completa antes de abrir el diálogo de impresión.
    const t = window.setTimeout(() => { window.print(); setPreparandoImpresion(false); }, 150);
    return () => window.clearTimeout(t);
  }, [impresion, preparandoImpresion]);
  const hoy = new Date().toISOString().slice(0, 10);
  // Al imprimir, el título de la ventana pasa a ser el del reporte (el navegador lo pone en el encabezado de la hoja).
  const tituloReporte = pestana !== "busqueda" ? reporte.data?.titulo : undefined;
  useEffect(() => {
    if (!tituloReporte) return;
    let original = document.title;
    const antes = () => { original = document.title; document.title = tituloReporte; };
    const despues = () => { document.title = original; };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    return () => { window.removeEventListener("beforeprint", antes); window.removeEventListener("afterprint", despues); };
  }, [tituloReporte]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5 print:hidden">
        <Search size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Consultas y reportes</h1>
          <p className="text-sm text-gris-2">Busca con filtros combinados, genera reportes y expórtalos sin los campos restringidos para tu rol.</p>
        </div>
      </div>

      <FiltrosReporte key={versionFormulario} inicial={filtros} opciones={opciones} camposOcultos={camposOcultos} veNoAprobadas={puede("piezas.ver_no_aprobadas")} aplicados={filtros}
                      onAplicar={(f) => { setFiltros(f); setPagina(1); setPaginaReporte(1); olvidarImpresion(); setMensaje(""); }} />

      <div role="tablist" aria-label="Consultas y reportes" className="flex flex-wrap gap-2 border-b border-linea print:hidden">
        {pestanas.map(([clave, etiqueta]) => (
          <button key={clave} role="tab" aria-selected={pestana === clave} onClick={() => { setPestana(clave); setPaginaReporte(1); olvidarImpresion(); setMensaje(""); }}
                  className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition ${
                    pestana === clave ? "border-rojo text-azul" : "border-transparent text-gris-2 hover:text-azul"}`}>
            {etiqueta}
          </button>
        ))}
        <button type="button" className="ml-auto self-center p-1.5 text-azul" aria-expanded={ayudaAbierta} aria-controls="ayuda-pestana"
                aria-label={`Qué es la pestaña ${pestanas.find(([c]) => c === pestana)?.[1] ?? ""}`} title="Qué muestra esta pestaña" onClick={() => setAyudaAbierta(!ayudaAbierta)}>
          <Info size={18} aria-hidden="true" />
        </button>
      </div>
      {ayudaAbierta && <p id="ayuda-pestana" role="note" className="text-sm bg-fondo-suave rounded-card px-4 py-3 print:hidden">{AYUDA[pestana]}</p>}

      <div className="flex flex-wrap gap-2 items-center print:hidden">
        {puede("reportes.exportar") && (
          <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" disabled={descargando || consultando}
                  title={consultando ? "Disponible cuando termine de generarse el reporte" : undefined}
                  onClick={() => pestana === "busqueda"
                    ? exportar("/exportaciones/piezas.xlsx", `piezas_${hoy}.xlsx`)
                    : exportar(`/exportaciones/reportes/${pestana}.xlsx`, `${pestana}_${hoy}.xlsx`)}>
            <FileDown size={16} aria-hidden="true" /> Exportar Excel
          </button>
        )}
        {pestana !== "busqueda" && (
          <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" disabled={reportePendiente || !reporte.data || demasiadasParaImprimir || preparandoImpresion} onClick={imprimir}
                  title={demasiadasParaImprimir ? "Demasiadas piezas para imprimir" : undefined}>
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
        {pestana !== "busqueda" && reportePendiente && <span className="text-sm text-gris-2">Generando el reporte… Podrás imprimirlo cuando termine.</span>}
        {consultando && <span className="text-sm text-gris-2">Exportar Excel se habilita cuando termine de generarse.</span>}
        {demasiadasParaImprimir && (
          <p role="status" className="text-sm">
            Este reporte tiene {filasImpresion.toLocaleString("es-PE")} piezas y el navegador no puede imprimirlo completo (máximo {MAX_FILAS_IMPRESION.toLocaleString("es-PE")}).
            Acota con filtros o usa Exportar Excel.
          </p>
        )}
        {preparandoImpresion && <span className="text-sm text-gris-2">Preparando la impresión…</span>}
        {descargando && (
          <span className="text-sm text-gris-2">
            Preparando el archivo… {pestana === "busqueda" ? "con muchas piezas puede tardar hasta un minuto." : "puede tardar unos segundos."} No cierres esta pantalla.
          </span>
        )}
        {mensaje && <p role="status" className="text-sm">{mensaje}</p>}
      </div>

      {/* Tabla de maquetación solo para imprimir: su encabezado y pie vacíos se repiten en cada hoja y hacen de margen (ver index.css). */}
      <table role="presentation" className="print-hoja"><thead aria-hidden="true"><tr><td><div className="print-espacio" /></td></tr></thead><tbody><tr><td>
      <div role="tabpanel" className="glass-panel p-4 space-y-4 print:p-0">
        {pestana === "busqueda" ? (
          <>
            <ErrorReporte error={busqueda.error} onReintentar={() => busqueda.refetch()} />
            {(busqueda.isPending || busqueda.isFetching) && <p role="status">Buscando…</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
                  <tr><th className="px-4 py-2">Pieza</th><th className="px-4 py-2">Códigos</th><th className="px-4 py-2">Colección</th>
                    {verUbicacion && <th className="px-4 py-2">Ubicación</th>}{verEstado && <th className="px-4 py-2">Estado</th>}
                    <th className="px-4 py-2">Ficha</th><th className="px-4 py-2">Información</th></tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {busqueda.data?.items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2"><Link className="text-azul underline font-semibold" to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link></td>
                      <td className="px-4 py-2">{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</td>
                      <td className="px-4 py-2">{p.etiquetas.coleccion_id || "—"}</td>
                      {verUbicacion && <td className="px-4 py-2">{p.etiquetas.ubicacion_actual_id || "—"}</td>}
                      {verEstado && <td className="px-4 py-2">{p.etiquetas.estado_pieza_id || "—"}</td>}
                      <td className="px-4 py-2"><ChipEstadoFicha estado={p.estadoFicha} /></td>
                      <td className="px-4 py-2">{p.incompleta ? "Por completar" : "Completa"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {busqueda.data?.total === 0 && !busqueda.isFetching && <p className="p-4 text-gris-2">Ninguna pieza cumple los filtros.</p>}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="btn-glass" disabled={pagina === 1 || busqueda.isFetching} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              {busqueda.data && !busqueda.isFetching && <p>Página {pagina} · {contarPiezas(busqueda.data.total)}</p>}
              <button className="btn-glass" disabled={!busqueda.data || pagina * TAMANO >= busqueda.data.total || busqueda.isFetching}
                      onClick={() => setPagina(pagina + 1)}>Siguiente</button>
            </div>
          </>
        ) : (
          <>
            <ErrorReporte error={reporte.error} onReintentar={() => reporte.refetch()} />
            {reportePendiente && <p role="status">Generando el reporte…</p>}
            {reporte.data && !reporte.isFetching && (
              <div className={impresion?.clave === pestana ? "space-y-4 print:hidden" : "space-y-4"}>
                <Encabezado reporte={reporte.data} total={totalDe(pestana, reporte.data)} nombres={nombresDeOpciones(opciones)} />
                <CuerpoReporte clave={pestana} datos={reporte.data} etiquetas={etiquetas} onVerPiezas={verPiezas} />
                {paginado && hayVariasPaginas && (
                  <div className="flex flex-wrap gap-3 items-center print:hidden">
                    <button type="button" className="btn-glass" disabled={paginaReporte <= 1} onClick={() => setPaginaReporte(paginaReporte - 1)}>Anterior</button>
                    <p>Página {reporte.data.pagina} de {reporte.data.paginas} · {filasImpresion.toLocaleString("es-PE")} piezas</p>
                    <button type="button" className="btn-glass" disabled={paginaReporte >= (reporte.data.paginas ?? 1)} onClick={() => setPaginaReporte(paginaReporte + 1)}>Siguiente</button>
                  </div>
                )}
              </div>
            )}
            {impresion?.clave === pestana && (
              <div className="hidden print:block space-y-4" aria-hidden="true">
                <Encabezado reporte={impresion.datos} total={totalDe(pestana, impresion.datos)} nombres={nombresDeOpciones(opciones)} />
                <CuerpoReporte clave={pestana} datos={impresion.datos} etiquetas={etiquetas} onVerPiezas={verPiezas} />
              </div>
            )}
          </>
        )}
      </div>
      </td></tr></tbody><tfoot aria-hidden="true"><tr><td><div className="print-espacio" /></td></tr></tfoot></table>
    </div>
  );
}
