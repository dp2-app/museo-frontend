import { useState } from "react";
import type { OpcionesFiltro } from "../../hooks/useOpcionesFiltro";
import { CAMPO_DE_FILTRO, parametros, type FiltrosConsulta } from "../../lib/reportes";
import type { ValorLista } from "../../types";

interface Props {
  opciones: OpcionesFiltro; camposOcultos: string[]; veNoAprobadas: boolean; aplicados: FiltrosConsulta; onAplicar: (filtros: FiltrosConsulta) => void;
}

/** Los mismos filtros de la búsqueda (F7) para la búsqueda y para todos los reportes. Un filtro sobre un campo oculto para el rol no se muestra. */
export function FiltrosReporte({ opciones, camposOcultos, veNoAprobadas, aplicados, onAplicar }: Props) {
  const [f, setF] = useState<FiltrosConsulta>({});
  const [abierto, setAbierto] = useState(false);
  const activos = Object.keys(parametros(aplicados)).length;
  const sinAplicar = JSON.stringify(parametros(f)) !== JSON.stringify(parametros(aplicados));
  const visible = (clave: keyof FiltrosConsulta) => !CAMPO_DE_FILTRO[clave] || !camposOcultos.includes(CAMPO_DE_FILTRO[clave]!);
  const cambiar = (clave: keyof FiltrosConsulta, valor: string | boolean) => setF((previo) => ({ ...previo, [clave]: valor }));
  const texto = (clave: keyof FiltrosConsulta, etiqueta: string) => visible(clave) && (
    <label className="form-label">{etiqueta}<input className="glass-input" value={String(f[clave] ?? "")} onChange={(e) => cambiar(clave, e.target.value)} /></label>);
  const seleccion = (clave: keyof FiltrosConsulta, etiqueta: string, valores: { id: string; nombre: string }[]) => visible(clave) && (
    <label className="form-label">{etiqueta}
      <select className="glass-input" value={String(f[clave] ?? "")} onChange={(e) => cambiar(clave, e.target.value)}>
        <option value="">Todos</option>{valores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
      </select></label>);
  const deLista = (valores: ValorLista[]) => valores.map((v) => ({ id: v.id, nombre: v.activo ? v.etiqueta : `${v.etiqueta} (inactivo)` }));

  return (
    <div className="space-y-2 print:hidden">
      {/* En el móvil el formulario ocupa varias pantallas: se pliega y el botón dice cuántos filtros hay aplicados. */}
      <button type="button" className="btn-glass sm:hidden w-full justify-center" aria-expanded={abierto} aria-controls="filtros-reporte"
              onClick={() => setAbierto(!abierto)}>
        {abierto ? "Ocultar filtros" : `Filtros${activos ? ` (${activos} ${activos === 1 ? "aplicado" : "aplicados"})` : ""}`}
      </button>
      <form id="filtros-reporte" className={`glass-panel-sm p-4 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:grid ${abierto ? "grid" : "hidden"}`}
            onSubmit={(e) => { e.preventDefault(); onAplicar(f); setAbierto(false); }}>
      {texto("q", "Texto de la ficha")}
      {texto("codigo", "Código del museo")}
      {seleccion("coleccionId", "Colección", opciones.colecciones)}
      {seleccion("ubicacionId", "Ubicación", opciones.ubicaciones.map((u) => ({ id: u.id, nombre: u.etiqueta })))}
      {seleccion("estadoPiezaId", "Estado de la pieza", deLista(opciones.estadoPieza))}
      {seleccion("estadoConservacionId", "Estado de conservación", deLista(opciones.estadoConservacion))}
      {seleccion("materialId", "Material", deLista(opciones.material))}
      {seleccion("tipoBienId", "Tipo de bien", deLista(opciones.tipoBien))}
      {seleccion("clasificacionId", "Clasificación", deLista(opciones.clasificacion))}
      {texto("autor", "Autor")}
      {texto("procedencia", "Procedencia")}
      {texto("epoca", "Época")}
      {veNoAprobadas && seleccion("estadoFicha", "Estado de ficha", [
        { id: "borrador", nombre: "Borrador" }, { id: "en_revision", nombre: "En revisión" },
        { id: "aprobada", nombre: "Aprobada" }, { id: "rechazada", nombre: "Rechazada" }])}
      <label className="flex items-center gap-2 text-sm self-end pb-2">
        <input type="checkbox" checked={Boolean(f.soloIncompletas)} onChange={(e) => cambiar("soloIncompletas", e.target.checked)} />
        Solo incompletas
      </label>
      <div className="flex flex-wrap items-center gap-2 self-end">
        <button className="btn-primary">Aplicar filtros</button>
        <button type="button" className="btn-glass" onClick={() => { setF({}); onAplicar({}); }}>Limpiar</button>
        {sinAplicar && <p role="status" className="text-xs text-gris-2 w-full">Cambiaste los filtros: pulsa «Aplicar filtros» para ver y exportar con ellos.</p>}
      </div>
      </form>
    </div>
  );
}
