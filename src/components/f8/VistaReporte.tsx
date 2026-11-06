import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ETIQUETA_FILTRO, type ClaveReporte, type EncabezadoReporte, type FiltrosConsulta, type ReporteIncompletos, type ReporteIndicadores,
  type ReporteInventario, type ReportePorEstado, type ReporteUbicacion, type ResumenInventario,
} from "../../lib/reportes";
import { Anillo, BarraProgreso, BarrasHorizontales } from "./Graficos";
import { Indicadores } from "./Indicadores";

const ESTADO_FICHA: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", aprobada: "Aprobada", rechazada: "Rechazada" };
const FALTANTE: Record<string, string> = { codigos_externos: "Código del museo", fotografias: "Fotografía" };

/** RF-45 y RF-59: institución (nombre, logo y dirección), título, fecha, filtros aplicados y total, tal como los devuelve el backend. */
export function Encabezado({ reporte, total, nombres }: { reporte: EncabezadoReporte; total: number; nombres: Record<string, string> }) {
  const filtros = Object.entries(reporte.filtros);
  const { nombre, logoUrl, direccion } = reporte.institucion;
  const [logoFallido, setLogoFallido] = useState<string | null>(null);
  const logo = logoUrl && /^https?:\/\//i.test(logoUrl) && logoFallido !== logoUrl ? logoUrl : null;
  const valor = (clave: string, v: string | boolean) =>
    v === true ? "Sí" : clave === "estadoFicha" ? ESTADO_FICHA[String(v)] ?? String(v) : nombres[String(v)] ?? String(v);
  return (
    <header className="space-y-1">
      <div className="flex items-center gap-3">
        {logo && <img src={logo} alt="Logo de la institución" className="max-h-14 max-w-[8rem] object-contain" referrerPolicy="no-referrer"
                      onError={() => setLogoFallido(logo)} />}
        <div>
          <p className="text-sm font-semibold text-gris-2">{nombre}</p>
          {direccion && <p className="text-xs text-gris-2">{direccion}</p>}
        </div>
      </div>
      <h2 className="text-azul">{reporte.titulo}</h2>
      <p className="text-sm">Generado el {new Date(reporte.generadoEn).toLocaleString("es-PE", { timeZone: "America/Lima" })}</p>
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

/** Las ubicaciones tienen dos niveles (sede › ubicación): se agrupan por sede con su subtotal, sumando lo que ya trae el backend. */
function PorUbicacion({ r }: { r: ReporteUbicacion }) {
  const sedes = new Map<string, { total: number; filas: { clave: string; nombre: string; total: number }[] }>();
  for (const u of r.porUbicacion) {
    const [sede, ...resto] = u.ubicacion.split(" › ");
    const grupo = sedes.get(sede) ?? { total: 0, filas: [] };
    grupo.total += u.total;
    grupo.filas.push({ clave: u.ubicacionId, nombre: resto.join(" › ") || sede, total: u.total });
    sedes.set(sede, grupo);
  }
  // Con una sola sede el nivel «Sede» no aporta: se muestra una lista plana de ubicaciones (la base conserva los dos niveles).
  const unaSede = sedes.size === 1;
  const filas = unaSede ? r.porUbicacion.map((u) => {
    const [sede, ...resto] = u.ubicacion.split(" › ");
    return <tr key={u.ubicacionId}><td className="px-4 py-2">{resto.join(" › ") || sede}</td><td className="px-4 py-2">{u.total}</td></tr>;
  }) : [...sedes].flatMap(([sede, g]) => [
    <tr key={`sede-${sede}`} className="bg-fondo-suave font-semibold"><td className="px-4 py-2">{sede}</td><td className="px-4 py-2">{g.total}</td></tr>,
    ...g.filas.map((f) => <tr key={f.clave}><td className="pl-8 pr-4 py-2">{f.nombre}</td><td className="px-4 py-2">{f.total}</td></tr>),
  ]);
  if (r.sinUbicacion) filas.push(<tr key="sin" className="border-t-2 border-linea"><td className="px-4 py-2 text-gris-2">(sin ubicación)</td><td className="px-4 py-2">{r.sinUbicacion}</td></tr>);
  return (
    <section className="space-y-2">
      <h3>Por ubicación</h3>
      {unaSede && <p className="text-sm text-gris-2">Sede: {[...sedes.keys()][0]}</p>}
      <Tabla columnas={[unaSede ? "Ubicación" : "Sede › ubicación", "Piezas"]} vacio="No hay datos para este grupo o tu rol no ve este campo.">{filas}</Tabla>
    </section>
  );
}

const VISIBLES_ESTADO = 10;

/** Por estado en una sola vista: el estado de la pieza (pocos valores) como tarjetas y el de conservación (decenas) como barras con los
 *  10 mayores; el resto se despliega y al imprimir se muestra completo. No se unen valores parecidos: eso es limpieza de datos (F0/F4). */
function PorEstado({ r }: { r: ReportePorEstado }) {
  const [todos, setTodos] = useState(false);
  const conservacion = r.porEstadoConservacion.map((g) => ({ clave: g.valorId ?? "-", etiqueta: g.valor, total: g.total }));
  const resto = conservacion.length - VISIBLES_ESTADO;
  const maximo = Math.max(1, ...conservacion.map((g) => g.total));
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3>Por estado de la pieza</h3>
        {r.porEstadoPieza.length ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {r.porEstadoPieza.map((g) => (
              <div key={g.valorId ?? "-"} className="kpi-card">
                <p className="text-xs text-gris-2">{g.valor}</p>
                <p className="text-2xl font-display font-bold text-azul">{g.total.toLocaleString("es-PE")}</p>
                <p className="text-xs text-gris-2">piezas</p>
              </div>
            ))}
          </div>
        ) : <p className="text-gris-2">No hay datos para este grupo o tu rol no ve este campo.</p>}
      </section>
      <section className="space-y-2">
        <h3>Por estado de conservación</h3>
        {conservacion.length ? (
          <>
            <BarrasHorizontales items={conservacion.slice(0, VISIBLES_ESTADO)} maximo={maximo} />
            {resto > 0 && (
              <>
                <div className={todos ? "" : "hidden print:block"}><BarrasHorizontales items={conservacion.slice(VISIBLES_ESTADO)} maximo={maximo} /></div>
                <button type="button" className="text-azul underline text-sm font-semibold print:hidden" aria-expanded={todos} onClick={() => setTodos(!todos)}>
                  {todos ? "Ver solo los 10 mayores" : `Ver los ${resto} restantes`}
                </button>
              </>
            )}
          </>
        ) : <p className="text-gris-2">No hay datos para este grupo o tu rol no ve este campo.</p>}
      </section>
    </div>
  );
}

/** Información incompleta: el resumen y las barras salen de los números del backend; el detalle llega por páginas del servidor. */
function Incompletas({ r, etiquetas }: { r: ReporteIncompletos; etiquetas: Record<string, string> }) {
  const nombre = (c: string) => etiquetas[c] ?? FALTANTE[c] ?? c;
  return (
    <div className="space-y-6">
      <div className="kpi-card !flex-row items-center gap-4">
        <Anillo porcentaje={r.porcentajeIncompleto} etiqueta="Piezas incompletas" tamano={80} />
        <div>
          <p className="text-3xl font-display font-bold text-azul">{r.porcentajeIncompleto.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %</p>
          <p className="text-sm">{r.piezasIncompletas.toLocaleString("es-PE")} de {r.totalPiezas.toLocaleString("es-PE")} piezas incompletas</p>
        </div>
      </div>
      <section className="space-y-2">
        <h3>Completitud por colección</h3>
        {r.porColeccion.length ? (
          <ul className="space-y-1.5">
            {r.porColeccion.map((g) => (
              <li key={g.coleccionId ?? "-"} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-2 text-sm">
                <span className="truncate" title={g.coleccion}>{g.coleccion}</span>
                <BarraProgreso porcentaje={g.porcentajeCompleto} etiqueta={`Completitud de ${g.coleccion}`} />
                <span className="text-xs text-gris-2 text-right">{g.piezasIncompletas.toLocaleString("es-PE")} de {g.totalPiezas.toLocaleString("es-PE")} incompletas</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-gris-2">Sin datos por colección (o tu rol no ve la colección).</p>}
      </section>
      <section className="space-y-2">
        <h3>Qué falta más</h3>
        {r.porFaltante?.length
          ? <BarrasHorizontales items={r.porFaltante.map((f) => ({ clave: f.campo, etiqueta: nombre(f.campo), total: f.total }))} />
          : <p className="text-gris-2">No hay campos faltantes con estos filtros.</p>}
      </section>
      <section className="space-y-2">
        <h3>Piezas incompletas</h3>
        <Tabla columnas={["Pieza", "Le falta"]} vacio="No hay piezas incompletas con estos filtros.">
          {r.detalle.map((d) => (
            <tr key={d.piezaId}>
              <td className="px-4 py-2"><Link className="text-azul underline" to={`/coleccion/${d.piezaId}`}>{d.denominacion ?? "Sin denominación"}</Link></td>
              <td className="px-4 py-2">
                <span className="flex flex-wrap gap-1">{d.camposFaltantes.map((c) => <span key={c} className="chip !py-0 !px-2 !text-xs">{nombre(c)}</span>)}</span>
              </td>
            </tr>
          ))}
        </Tabla>
      </section>
    </div>
  );
}

function VerPiezas({ filtro, onVerPiezas }: { filtro: FiltrosConsulta; onVerPiezas: (filtro: FiltrosConsulta) => void }) {
  return <button type="button" className="text-azul underline text-xs font-semibold print:hidden" onClick={() => onVerPiezas(filtro)}>Ver las piezas</button>;
}

/** Tarjetas sobre el Inventario: salen del `resumen` del backend (todo el conjunto filtrado), nunca de las filas de la página. */
function ResumenDeInventario({ r, onVerPiezas }: { r: ResumenInventario; onVerPiezas: (filtro: FiltrosConsulta) => void }) {
  const n = (v: number) => v.toLocaleString("es-PE");
  const maximo = Math.max(1, ...r.topColecciones.map((c) => c.totalPiezas));
  return (
    <section className="space-y-3" aria-label="Resumen del inventario">
      <h3>Resumen</h3>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="kpi-card">
          <p className="text-xs text-gris-2">Total de piezas</p>
          <p className="text-2xl font-display font-bold text-azul">{n(r.totalPiezas)}</p>
        </div>
        <div className="kpi-card !flex-row items-center gap-3">
          {r.porcentajeCompletas !== null && <Anillo porcentaje={r.porcentajeCompletas} etiqueta="Fichas completas" tamano={56} />}
          <div>
            <p className="text-xs text-gris-2">Completas</p>
            <p className="text-2xl font-display font-bold text-azul">{n(r.completas)}</p>
            {r.porcentajeCompletas !== null && <p className="text-xs text-gris-2">{r.porcentajeCompletas.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %</p>}
          </div>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-gris-2">Por completar</p>
          <p className="text-2xl font-display font-bold text-azul">{n(r.porCompletar)}</p>
          <VerPiezas filtro={{ soloIncompletas: true }} onVerPiezas={onVerPiezas} />
        </div>
        <div className="kpi-card">
          <p className="text-xs text-gris-2">Sin código I</p>
          <p className="text-2xl font-display font-bold text-azul">{n(r.sinCodigoI)}</p>
          <VerPiezas filtro={{ sinCodigoPrincipal: true }} onVerPiezas={onVerPiezas} />
        </div>
        {r.sinColeccion !== null && (
          <div className="kpi-card">
            <p className="text-xs text-gris-2">Sin colección</p>
            <p className="text-2xl font-display font-bold text-azul">{n(r.sinColeccion)}</p>
          </div>
        )}
      </div>
      {r.topColecciones.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Las {r.topColecciones.length} colecciones con más piezas</h4>
          <BarrasHorizontales items={r.topColecciones.map((c) => ({ clave: c.coleccionId, etiqueta: c.coleccion, total: c.totalPiezas }))} maximo={maximo} />
        </div>
      )}
    </section>
  );
}

/** Muestra el reporte tal cual lo arma el backend: no recalcula totales, porcentajes ni faltantes. */
export function CuerpoReporte({ clave, datos, etiquetas, onVerPiezas }: {
  clave: ClaveReporte; datos: unknown; etiquetas: Record<string, string>; onVerPiezas: (filtro: FiltrosConsulta) => void;
}) {
  if (clave === "indicadores") return <Indicadores reporte={datos as ReporteIndicadores} onVerPiezas={onVerPiezas} />;
  if (clave === "inventario") {
    const r = datos as ReporteInventario;
    return (
      <div className="space-y-6">
      {r.resumen && <ResumenDeInventario r={r.resumen} onVerPiezas={onVerPiezas} />}
      <Tabla columnas={["Código I", "Otros códigos", "Denominación", "Colección", "Información"]} vacio="Ninguna pieza cumple los filtros.">
        {r.piezas.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2">{p.codigoPrincipal ?? "Sin código I"}</td>
            <td className="px-4 py-2">{p.otrosCodigos?.join(" · ") || "—"}</td>
            <td className="px-4 py-2"><Link className="text-azul underline" to={`/coleccion/${p.id}`}>{p.denominacion ?? "Sin denominación"}</Link></td>
            <td className="px-4 py-2">{p.coleccion ?? "—"}</td>
            <td className="px-4 py-2">{p.incompleta ? "Por completar" : "Completa"}</td>
          </tr>
        ))}
      </Tabla>
      </div>
    );
  }
  if (clave === "por-estado") return <PorEstado r={datos as ReportePorEstado} />;
  if (clave === "por-ubicacion") return <PorUbicacion r={datos as ReporteUbicacion} />;
  return <Incompletas r={datos as ReporteIncompletos} etiquetas={etiquetas} />;
}
