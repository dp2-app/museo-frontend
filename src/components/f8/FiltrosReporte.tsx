import { useState } from "react";
import type { OpcionesFiltro } from "../../hooks/useOpcionesFiltro";
import { CAMPO_DE_FILTRO, type FiltrosConsulta } from "../../lib/reportes";
import type { ValorLista } from "../../types";

interface Props {
  opciones: OpcionesFiltro; camposOcultos: string[]; veNoAprobadas: boolean; onAplicar: (filtros: FiltrosConsulta) => void;
}

/** Los mismos filtros de la búsqueda (F7) para la búsqueda y para todos los reportes. Un filtro sobre un campo oculto para el rol no se muestra. */
export function FiltrosReporte({ opciones, camposOcultos, veNoAprobadas, onAplicar }: Props) {
  const [f, setF] = useState<FiltrosConsulta>({});
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
    <form className="glass-panel-sm p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden"
          onSubmit={(e) => { e.preventDefault(); onAplicar(f); }}>
      {texto("q", "Texto de la ficha")}
      {texto("codigo", "Código del museo")}
      {seleccion("coleccionId", "Colección", opciones.colecciones)}
      {seleccion("ubicacionId", "Ubicación", opciones.ubicaciones.map((u) => ({ id: u.id, nombre: u.etiqueta })))}
      {seleccion("estadoPiezaId", "Estado de la pieza", deLista(opciones.estadoPieza))}
      {seleccion("estadoConservacionId", "Estado de conservación", deLista(opciones.estadoConservacion))}
      {seleccion("materialId", "Material", deLista(opciones.material))}
      {texto("autor", "Autor")}
      {texto("epoca", "Época")}
      {veNoAprobadas && seleccion("estadoFicha", "Estado de ficha", [
        { id: "borrador", nombre: "Borrador" }, { id: "en_revision", nombre: "En revisión" },
        { id: "aprobada", nombre: "Aprobada" }, { id: "rechazada", nombre: "Rechazada" }])}
      <label className="flex items-center gap-2 text-sm self-end pb-2">
        <input type="checkbox" checked={Boolean(f.soloIncompletas)} onChange={(e) => cambiar("soloIncompletas", e.target.checked)} />
        Solo incompletas
      </label>
      <div className="flex gap-2 self-end">
        <button className="btn-primary">Aplicar filtros</button>
        <button type="button" className="btn-glass" onClick={() => { setF({}); onAplicar({}); }}>Limpiar</button>
      </div>
    </form>
  );
}
