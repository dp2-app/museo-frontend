import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FormularioFicha } from "../components/f0/FormularioFicha";
import { Colecciones } from "../components/Colecciones";
import { FiltrosReporte } from "../components/f8/FiltrosReporte";
import { useOpcionesFiltro } from "../hooks/useOpcionesFiltro";
import { parametros } from "../lib/reportes";
import { ErrorConsulta, Panel } from "../components/FichaComun";
import { useRecurso } from "../lib/recursosFicha";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { AltaComplementos, type Complementos } from "../components/IdentificacionFicha";
import { errorLocal } from "../lib/f1";
import { AccesosF1 } from "../components/f1/PendienteCodigoI";
import { usePermisos } from "../hooks/usePermisos";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { api } from "../lib/api";
import { nombreFicha, type Ficha } from "../lib/ficha";
import type { Pagina } from "../types";

/** Lo que `camposFaltantes` nombra además de los campos de la ficha (definición única en el backend: `faltantes()`). */
const ETIQUETAS_FALTA: Record<string, string> = { codigos_externos: "código del museo", fotografias: "fotografía" };

export function PiezasPage() {
  const { puede, sesion } = usePermisos(); const navegar = useNavigate(); const cache = useQueryClient();
  const [nueva, setNueva] = useState(false); const [complementos, setComplementos] = useState<Complementos>({ codigos: [] }); const [problemas, setProblemas] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1); const [filtros, setFiltros] = useState<Record<string, unknown>>({});
  const piezas = useRecurso<Pagina<Ficha>>("piezas", "/piezas", true, { ...filtros, pagina, tamano: 20 });
  const opciones = useOpcionesFiltro(); const catalogo = useCatalogoFicha();
  const etiquetaFalta = (clave: string) => ETIQUETAS_FALTA[clave] ?? catalogo.data?.find((c) => c.clave === clave)?.etiqueta ?? clave;
  /** «Completa» o «Faltan N campos», con el detalle en el tooltip; `camposFaltantes` ya viene filtrado por rol (RF-57). */
  const completitud = (p: Ficha) => p.camposFaltantes.length === 0 && !p.incompleta ? <span>Completa</span>
    : <span title={`Falta: ${p.camposFaltantes.map(etiquetaFalta).join(", ") || "información por completar"}`}>{p.camposFaltantes.length === 1 ? "Falta 1 campo" : `Faltan ${p.camposFaltantes.length} campos`}</span>;
  return <div className="space-y-6"><h1>Colección</h1><p>Registra piezas y completa las fichas del inventario.</p>
    <AccesosF1 />
    {puede("colecciones.gestionar") && <details><summary className="cursor-pointer font-semibold">Gestionar colecciones</summary><Colecciones /></details>}
    <button className="btn-primary" disabled={!puede("piezas.crear")} title={!puede("piezas.crear") ? "Tu rol no puede registrar piezas" : undefined} onClick={() => setNueva(!nueva)}>{nueva ? "Cancelar registro" : "Registrar pieza"}</button>
    {nueva && <Panel titulo="Nueva pieza"><AltaComplementos onChange={(v, p) => { setComplementos(v); setProblemas(p); }} /><FormularioFicha onGuardar={async (datos) => { if (problemas.length) throw errorLocal(problemas); const p = (await api.post<Ficha>("/piezas", { ...datos, ...complementos })).data; await cache.invalidateQueries(); navegar(`/coleccion/${p.id}`); }} /></Panel>}
    <FiltrosReporte opciones={opciones} camposOcultos={sesion?.camposOcultos ?? []} veNoAprobadas={puede("piezas.ver_no_aprobadas")} aplicados={filtros}
      onAplicar={(f) => { setPagina(1); setFiltros(parametros(f)); }} /><ErrorConsulta error={piezas.error} />{piezas.isPending && <p>Cargando piezas…</p>}
    <div className="glass-panel overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-4">Pieza / códigos</th><th className="p-4">Colección</th><th className="p-4">Estado de la ficha</th><th className="p-4">Completitud</th></tr></thead>
      <tbody>{piezas.data?.items.map((p) => <tr key={p.id} className="border-t border-linea"><td className="p-4"><Link className="text-azul underline font-semibold" to={`/coleccion/${p.id}`}>{nombreFicha(p)}</Link><p>{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</p></td><td className="p-4">{p.etiquetas.coleccion_id || "Sin colección"}</td><td className="p-4"><ChipEstadoFicha estado={p.estadoFicha} /></td><td className="p-4">{completitud(p)}</td></tr>)}</tbody></table>
      {piezas.data?.total === 0 && <p className="p-4">No se encontraron piezas.</p>}
    </div><div className="flex flex-wrap gap-3 items-center"><button className="btn-glass" disabled={pagina === 1 || piezas.isFetching} onClick={() => setPagina(pagina - 1)}>Anterior</button><p>Página {pagina} · {piezas.data?.total ?? 0} piezas</p><button className="btn-glass" disabled={!piezas.data || pagina * 20 >= piezas.data.total || piezas.isFetching} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>
  </div>;
}
