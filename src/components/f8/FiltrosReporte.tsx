import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { nombresDeOpciones, type OpcionesFiltro } from "../../hooks/useOpcionesFiltro";
import { CAMPO_DE_FILTRO, ETIQUETA_FILTRO, parametros, type FiltrosConsulta } from "../../lib/reportes";
import type { ValorLista } from "../../types";

interface Props {
  opciones: OpcionesFiltro; camposOcultos: string[]; veNoAprobadas: boolean; aplicados: FiltrosConsulta; inicial?: FiltrosConsulta; onAplicar: (filtros: FiltrosConsulta) => void;
}

const AVANZADOS: (keyof FiltrosConsulta)[] = ["estadoPiezaId", "estadoConservacionId", "materialId", "tipoBienId", "clasificacionId", "autor",
  "procedencia", "epoca", "estadoFicha", "soloIncompletas", "sinFotografia", "sinUbicacion", "sinCodigoPrincipal"];
const ESTADO_FICHA: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", aprobada: "Aprobada", rechazada: "Rechazada" };

/** Los mismos filtros de la búsqueda (F7) para la búsqueda y para todos los reportes. Un filtro sobre un campo oculto para el rol no se muestra. */
export function FiltrosReporte({ opciones, camposOcultos, veNoAprobadas, aplicados, inicial, onAplicar }: Props) {
  const [f, setF] = useState<FiltrosConsulta>(inicial ?? {});
  const [abierto, setAbierto] = useState(false);
  const aplicadosParams = parametros(aplicados);
  const activos = Object.keys(aplicadosParams).length;
  // Los filtros principales siempre se ven; el resto va en «Filtros avanzados», que se abre solo si alguno está aplicado.
  const avanzadosAplicados = AVANZADOS.filter((k) => k in aplicadosParams).length;
  const [avanzado, setAvanzado] = useState(avanzadosAplicados > 0);
  const nombres = nombresDeOpciones(opciones);
  const quitar = (clave: string) => {
    const resto = { ...aplicados } as Record<string, unknown>;
    delete resto[clave];
    setF(resto as FiltrosConsulta);
    onAplicar(resto as FiltrosConsulta);
  };
  const firma = (x: FiltrosConsulta) => JSON.stringify(Object.entries(parametros(x)).sort());
  const sinAplicar = firma(f) !== firma(aplicados);
  const visible = (clave: keyof FiltrosConsulta) => !CAMPO_DE_FILTRO[clave] || !camposOcultos.includes(CAMPO_DE_FILTRO[clave]!);
  const cambiar = (clave: keyof FiltrosConsulta, valor: string | boolean) => setF((previo) => ({ ...previo, [clave]: valor }));
  const texto = (clave: keyof FiltrosConsulta, etiqueta: string) => visible(clave) && (
    <label className="form-label">{etiqueta}<input className="glass-input" value={String(f[clave] ?? "")} onChange={(e) => cambiar(clave, e.target.value)} /></label>);
  const seleccion = (clave: keyof FiltrosConsulta, etiqueta: string, valores: { id: string; nombre: string }[]) => visible(clave) && (
    <label className="form-label">{etiqueta}
      <select className="glass-input" value={String(f[clave] ?? "")} onChange={(e) => cambiar(clave, e.target.value)}>
        <option value="">Todos</option>{valores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
      </select></label>);
  const casilla = (clave: keyof FiltrosConsulta, etiqueta: string) => visible(clave) && (
    <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(f[clave])} onChange={(e) => cambiar(clave, e.target.checked)} />{etiqueta}</label>);
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
      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-glass !py-1.5 !px-3 !text-sm" aria-expanded={avanzado} aria-controls="filtros-avanzados"
                onClick={() => setAvanzado(!avanzado)}>
          Filtros avanzados{avanzadosAplicados ? ` · ${avanzadosAplicados}` : ""}
          <ChevronDown size={16} aria-hidden="true" className={`transition ${avanzado ? "rotate-180" : ""}`} />
        </button>
        <span className="flex-1" />
        <button className="btn-primary">Aplicar filtros</button>
        <button type="button" className="btn-glass" onClick={() => { setF({}); onAplicar({}); }}>Limpiar</button>
      </div>
      <div id="filtros-avanzados" className={`sm:col-span-2 lg:col-span-4 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${avanzado ? "grid" : "hidden"}`}>
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm self-end pb-2 sm:col-span-2">
          {casilla("soloIncompletas", "Solo incompletas")}
          {casilla("sinFotografia", "Sin fotografía")}
          {casilla("sinUbicacion", "Sin ubicación")}
          {casilla("sinCodigoPrincipal", "Pendientes de código I")}
        </div>
      </div>
      {sinAplicar && <p role="status" className="text-xs text-gris-2 sm:col-span-2 lg:col-span-4">Cambiaste los filtros: pulsa «Aplicar filtros» para ver y exportar con ellos.</p>}
      </form>
      {activos > 0 && (
        <ul aria-label="Filtros aplicados" className="flex flex-wrap gap-1.5 text-xs">
          {Object.entries(aplicadosParams).map(([clave, valor]) => (
            <li key={clave} className="chip !py-0.5 !px-2 !text-xs inline-flex items-center gap-1">
              {ETIQUETA_FILTRO[clave] ?? clave}{valor === true ? "" : `: ${clave === "estadoFicha" ? ESTADO_FICHA[String(valor)] ?? String(valor) : nombres[String(valor)] ?? String(valor)}`}
              <button type="button" aria-label={`Quitar el filtro ${ETIQUETA_FILTRO[clave] ?? clave}`} className="inline-flex" onClick={() => quitar(clave)}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
