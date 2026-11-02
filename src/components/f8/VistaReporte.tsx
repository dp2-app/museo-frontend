import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ETIQUETA_FILTRO, type ClaveReporte, type EncabezadoReporte, type ReporteIncompletos, type ReporteInventario,
  type ReportePorEstado, type ReporteUbicacion,
} from "../../lib/reportes";

const ESTADO_FICHA: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", aprobada: "Aprobada", rechazada: "Rechazada" };
const FALTANTE: Record<string, string> = { codigos_externos: "Código del museo", fotografias: "Fotografía" };

/** RF-45: título, fecha, filtros aplicados y total, tal como los devuelve el backend. */
export function Encabezado({ reporte, total, nombres }: { reporte: EncabezadoReporte; total: number; nombres: Record<string, string> }) {
  const filtros = Object.entries(reporte.filtros);
  const valor = (clave: string, v: string | boolean) =>
    v === true ? "Sí" : clave === "estadoFicha" ? ESTADO_FICHA[String(v)] ?? String(v) : nombres[String(v)] ?? String(v);
  return (
    <header className="space-y-1">
      <p className="text-sm text-gris-2">{reporte.institucion.nombre}</p>
      <h2 className="text-azul">{reporte.titulo}</h2>
      <p className="text-sm">Generado el {new Date(reporte.generadoEn).toLocaleString("es-PE")}</p>
      <p className="text-sm">
        Filtros: {filtros.length ? filtros.map(([k, v]) => `${ETIQUETA_FILTRO[k] ?? k}: ${valor(k, v)}`).join(" · ") : "ninguno (todo el catálogo visible para tu rol)"}
      </p>
      <p className="font-semibold">Total: {total} pieza(s)</p>
    </header>
  );
}

function Tabla({ columnas, children, vacio }: { columnas: string[]; children: ReactNode[]; vacio: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
          <tr>{columnas.map((c) => <th key={c} className="px-4 py-2 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {children.length ? children : <tr><td colSpan={columnas.length} className="px-4 py-3 text-gris-2">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const Grupos = ({ titulo, grupos, columna }: { titulo: string; grupos: { clave: string; valor: string; total: number }[]; columna: string }) => (
  <section className="space-y-2">
    <h3>{titulo}</h3>
    <Tabla columnas={[columna, "Piezas"]} vacio="No hay datos para este grupo o tu rol no ve este campo.">
      {grupos.map((g) => <tr key={g.clave}><td className="px-4 py-2">{g.valor}</td><td className="px-4 py-2">{g.total}</td></tr>)}
    </Tabla>
  </section>
);

/** Muestra el reporte tal cual lo arma el backend: no recalcula totales, porcentajes ni faltantes. */
export function CuerpoReporte({ clave, datos, etiquetas }: { clave: ClaveReporte; datos: unknown; etiquetas: Record<string, string> }) {
  if (clave === "inventario") {
    const r = datos as ReporteInventario;
    return (
      <Tabla columnas={["Código principal", "Denominación", "Colección", "Información"]} vacio="Ninguna pieza cumple los filtros.">
        {r.piezas.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2">{p.codigoPrincipal ?? "Sin código"}</td>
            <td className="px-4 py-2"><Link className="text-azul underline" to={`/coleccion/${p.id}`}>{p.denominacion ?? "Sin denominación"}</Link></td>
            <td className="px-4 py-2">{p.coleccion ?? "—"}</td>
            <td className="px-4 py-2">{p.incompleta ? "Por completar" : "Completa"}</td>
          </tr>
        ))}
      </Tabla>
    );
  }
  if (clave === "por-estado") {
    const r = datos as ReportePorEstado;
    const filas = (g: ReportePorEstado["porEstadoPieza"]) => g.map((x) => ({ clave: x.valorId ?? "-", valor: x.valor, total: x.total }));
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Grupos titulo="Por estado de la pieza" columna="Estado" grupos={filas(r.porEstadoPieza)} />
        <Grupos titulo="Por estado de conservación" columna="Estado" grupos={filas(r.porEstadoConservacion)} />
      </div>
    );
  }
  if (clave === "por-ubicacion") {
    const r = datos as ReporteUbicacion;
    return <Grupos titulo="Por ubicación" columna="Ubicación"
                   grupos={[...r.porUbicacion.map((u) => ({ clave: u.ubicacionId, valor: u.ubicacion, total: u.total })),
                            ...(r.sinUbicacion ? [{ clave: "-", valor: "(sin ubicación)", total: r.sinUbicacion }] : [])]} />;
  }
  const r = datos as ReporteIncompletos;
  return (
    <div className="space-y-6">
      <p className="kpi-card inline-block">{r.piezasIncompletas} de {r.totalPiezas} piezas incompletas ({r.porcentajeIncompleto} %)</p>
      <section className="space-y-2">
        <h3>Completitud por colección</h3>
        <Tabla columnas={["Colección", "Piezas", "Incompletas", "% completo"]} vacio="Sin datos por colección (o tu rol no ve la colección).">
          {r.porColeccion.map((g) => (
            <tr key={g.coleccionId ?? "-"}>
              <td className="px-4 py-2">{g.coleccion}</td><td className="px-4 py-2">{g.totalPiezas}</td>
              <td className="px-4 py-2">{g.piezasIncompletas}</td><td className="px-4 py-2">{g.porcentajeCompleto} %</td>
            </tr>
          ))}
        </Tabla>
      </section>
      <section className="space-y-2">
        <h3>Piezas incompletas</h3>
        <Tabla columnas={["Pieza", "Le falta"]} vacio="No hay piezas incompletas con estos filtros.">
          {r.detalle.map((d) => (
            <tr key={d.piezaId}>
              <td className="px-4 py-2"><Link className="text-azul underline" to={`/coleccion/${d.piezaId}`}>{d.denominacion ?? "Sin denominación"}</Link></td>
              <td className="px-4 py-2">{d.camposFaltantes.map((c) => etiquetas[c] ?? FALTANTE[c] ?? c).join(", ")}</td>
            </tr>
          ))}
        </Tabla>
      </section>
    </div>
  );
}
