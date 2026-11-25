import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FileSpreadsheet, Upload } from "lucide-react";
import { CabeceraPagina } from "../components/SistemaVisual";
import { ImportacionModal } from "../components/f5/ImportacionModal";
import { NuevaPlantillaForm } from "../components/f5/FormatoColumnas";
import { ReglasImportacion } from "../components/f5/ReglasImportacion";
import { datosApi, extraerMensajeError } from "../lib/api";
import { ESTADOS_CARGA } from "../lib/importacion";
import { usePermisos } from "../hooks/usePermisos";
import type { CargaExcel } from "../types";

/** Historial y acceso directo; la operación completa ocurre en el asistente modal. */
export function ImportacionPage() {
  const { puede } = usePermisos();
  const cache = useQueryClient();
  const [abierta, setAbierta] = useState(false);
  const [cargaId, setCargaId] = useState<string>();
  const [estado, setEstado] = useState("");
  const [visibles, setVisibles] = useState(20);
  const cargas = useQuery({ queryKey: ["cargas"], enabled: puede("importacion.ver"),
    queryFn: async () => (await datosApi.get<CargaExcel[]>("/importacion/cargas")).data });
  const filtradas = (cargas.data ?? []).filter((c) => !estado || c.estado === estado);
  function abrir(id?: string) { setCargaId(id); setAbierta(true); }
  return <div className="space-y-6 f5-importacion">
    <CabeceraPagina titulo="Importación" icono={Upload} descripcion="Incorpora inventarios con una revisión guiada y retoma las cargas de tu equipo."
      acciones={puede("importacion.cargar") && <button className="btn-primary" onClick={() => abrir()}><Upload size={18} aria-hidden="true" />Importar Excel</button>} />
    <div className="importacion-accesos"><p><FileSpreadsheet size={22} aria-hidden="true" />Archivo, columnas, revisión y confirmación: todo en un solo asistente.</p>
      {puede("importacion.ver") && puede("piezas.ver") && <Link className="btn-glass" to="/importacion/curacion">Ver pendientes de curación</Link>}</div>
    {puede("importacion.ver") && <section aria-labelledby="historial-importacion-titulo" className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-3"><h2 id="historial-importacion-titulo" className="section-title">Historial de cargas</h2>
        <label>Estado<select className="glass-input block" value={estado} onChange={(e) => { setEstado(e.target.value); setVisibles(20); }}><option value="">Todos los estados</option>{Object.entries(ESTADOS_CARGA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
      {cargas.isLoading && <p role="status">Cargando historial…</p>}
      {cargas.isError && <p role="alert">{extraerMensajeError(cargas.error)} <button className="underline" onClick={() => { void cargas.refetch(); }}>Reintentar</button></p>}
      <div className="glass-panel overflow-x-auto"><table className="tabla-apilable w-full text-sm text-left"><thead><tr>{["Archivo y hoja", "Fecha", "Estado", "Filas", ""].map((h, i) => <th key={i} className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody>{filtradas.slice(0, visibles).map((c) => <tr key={c.id} className="border-t border-linea"><td className="px-4 py-3" data-label="Archivo y hoja"><strong>{c.archivoNombre}</strong><span className="block text-gris-2">{c.hojaNombre}</span></td>
          <td className="px-4 py-3" data-label="Fecha">{new Date(c.iniciadaEn).toLocaleString("es-PE")}{c.usuarioNombre && <span className="block text-gris-2">{c.usuarioNombre}</span>}</td>
          <td className="px-4 py-3" data-label="Estado">{ESTADOS_CARGA[c.estado]}{c.motivoRechazo && <span className="block text-gris-2">{c.motivoRechazo}</span>}</td>
          <td className="px-4 py-3" data-label="Filas">{c.totalFilas.toLocaleString("es-PE")}</td><td className="px-4 py-3"><button className="btn-glass" onClick={() => abrir(c.id)}>{c.estado === "en_revision" || c.estado === "pendiente_aprobacion" ? "Retomar carga" : "Ver resultado"}</button></td></tr>)}</tbody></table>
        {!cargas.isPending && !cargas.isError && filtradas.length === 0 && <p className="p-6">{estado ? "No hay cargas con ese estado." : "Aún no hay cargas. Empieza importando un Excel."}</p>}</div>
      {filtradas.length > visibles && <button className="btn-glass" onClick={() => setVisibles((n) => n + 20)}>Mostrar más cargas</button>}
    </section>}
    {puede("importacion.ver") && <ReglasImportacion />}
    {puede("importacion.configurar") && <NuevaPlantillaForm columnas={[]} onCreada={() => { void cache.invalidateQueries({ queryKey: ["plantillas-mapeo"] }); }} />}
    {abierta && <ImportacionModal cargaInicialId={cargaId} alCerrar={() => setAbierta(false)} />}
  </div>;
}

/** Conserva enlaces de lotes compartidos sin volver al antiguo formulario de página completa. */
export function CargaImportacionPage() {
  const { cargaId } = useParams<{ cargaId: string }>();
  const navegar = useNavigate();
  return <><ImportacionPage /><ImportacionModal cargaInicialId={cargaId} alCerrar={() => navegar("/importacion", { replace: true })} /></>;
}
