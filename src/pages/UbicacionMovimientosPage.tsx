import { CabeceraPagina } from "../components/SistemaVisual";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { usePermisos } from "../hooks/usePermisos";
import { api, extraerMensajeError } from "../lib/api";
import { nombreFicha, piezas as contarPiezas, type Ficha, type Ubicacion } from "../lib/ficha";
import type { Pagina, ValorLista } from "../types";
import { Aviso, ErrorConsulta } from "../components/FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";
import { EstadoUbicacion } from "../components/EstadoUbicacion";
import { GestionUbicaciones } from "../components/GestionUbicaciones";

/** Pantalla propia de sedes y ubicaciones (antes un plegable dentro de Ubicación y movimientos). */
export function SedesPage() {
  return <div className="space-y-6"><Link to="/ubicacion-y-movimientos" className="text-azul underline">← Volver a Ubicación y movimientos</Link><CabeceraPagina titulo="Sedes y ubicaciones" descripcion="Organiza los lugares donde se conservan las piezas." /><GestionUbicaciones /></div>;
}

const SIN_UBICACION = "__sin__";

/** Árbol sede › ubicación: elegir un nodo filtra la tabla de piezas por ese lugar. */
function Arbol({ nodos, elegido, onElegir, nivel = 0 }: { nodos: Ubicacion[]; elegido: string; onElegir: (id: string) => void; nivel?: number }) {
  return <ul className={nivel ? "ml-4 border-l border-linea pl-2" : "space-y-0.5"}>{nodos.filter((n) => n.activo).map((n) => <li key={n.id}>
    <button type="button" aria-pressed={elegido === n.id} onClick={() => onElegir(n.id)}
      className={`w-full text-left rounded-btn px-2 py-1 text-sm ${elegido === n.id ? "bg-azul text-white font-semibold" : "hover:bg-fondo-suave text-texto"} ${n.nivelTipo === "sede" ? "font-semibold" : ""}`}>{n.nombre}</button>
    {n.hijos && n.hijos.length > 0 && <Arbol nodos={n.hijos} elegido={elegido} onElegir={onElegir} nivel={nivel + 1} />}
  </li>)}</ul>;
}

export function UbicacionMovimientosPage() {
  const { puede, sesion } = usePermisos();
  const veUbicacion = Boolean(sesion) && !sesion?.camposOcultos.includes("ubicacion_actual_id");
  const veEstado = Boolean(sesion) && !sesion?.camposOcultos.includes("estado_pieza_id");
  const [q, setQ] = useState(""); const [codigo, setCodigo] = useState(""); const [filtro, setFiltro] = useState({ q: "", codigo: "" });
  const [lugar, setLugar] = useState(""); const [pagina, setPagina] = useState(1);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [id, setId] = useState(""); const [qr, setQr] = useState<{ id: string; url: string } | null>(null);
  const [destino, setDestino] = useState(""); const [motivoMov, setMotivoMov] = useState("");
  const [estado, setEstado] = useState(""); const [motivoEst, setMotivoEst] = useState("");
  const [resultado, setResultado] = useState(""); const [trabajando, setTrabajando] = useState(false);
  const op = useOperacion();

  const arbol = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", veUbicacion && puede("piezas.ver"));
  const estados = useRecurso<ValorLista[]>("estado-pieza", "/listas/estado_pieza/valores", veEstado && puede("estados.cambiar"));
  const piezas = useRecurso<Pagina<Ficha>>("piezas", "/piezas", puede("piezas.ver"), {
    q: filtro.q || undefined, codigo: filtro.codigo || undefined, tamano: 20, pagina,
    ubicacionId: lugar && lugar !== SIN_UBICACION ? lugar : undefined, sinUbicacion: lugar === SIN_UBICACION ? true : undefined });
  const pieza = useRecurso<Ficha>("pieza", `/piezas/${id}`, !!id && puede("piezas.ver"));
  useEffect(() => { let actual = true; if (id) void QRCode.toDataURL(`${window.location.origin}/coleccion/${id}`, { width: 180, margin: 1 }).then((url) => { if (actual) setQr({ id, url }); }).catch(() => { if (actual) setQr(null); }); return () => { actual = false; }; }, [id]);

  const filas = piezas.data?.items ?? [];
  const todasMarcadas = filas.length > 0 && filas.every((p) => marcadas.has(p.id));
  const elegir = (l: string) => { setLugar(l); setPagina(1); setMarcadas(new Set()); setResultado(""); };
  const alternar = (pid: string) => setMarcadas((previas) => { const n = new Set(previas); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const destinos = (nodos: Ubicacion[], prefijo = ""): { id: string; etiqueta: string }[] => nodos.filter((n) => n.activo).flatMap((n) => [{ id: n.id, etiqueta: `${prefijo}${n.nombre}` }, ...destinos(n.hijos ?? [], `${prefijo}${n.nombre} › `)]);

  /** Aplica la misma acción a cada pieza marcada, una por una: el backend registra cada cambio con su historial y motivo (RN-10). */
  async function aplicar(ruta: (pid: string) => string, cuerpo: Record<string, unknown>, verbo: string) {
    setTrabajando(true); setResultado("");
    const ids = [...marcadas]; const fallos: string[] = [];
    for (const pid of ids) {
      try { await api.post(ruta(pid), cuerpo); }
      catch (e) { const p = filas.find((f) => f.id === pid); fallos.push(`${p ? nombreFicha(p) : pid.slice(0, 8)}: ${extraerMensajeError(e)}`); }
    }
    setTrabajando(false); setMarcadas(new Set(fallos.length ? marcadas : [])); void piezas.refetch(); if (id) void pieza.refetch();
    setResultado(fallos.length ? `${verbo} ${ids.length - fallos.length} de ${ids.length} piezas. No se pudo en: ${fallos.join(" · ")}` : `${verbo} ${ids.length} ${ids.length === 1 ? "pieza" : "piezas"}.`);
    if (!fallos.length) { setDestino(""); setMotivoMov(""); setEstado(""); setMotivoEst(""); }
  }

  return <div className="space-y-6"><CabeceraPagina titulo="Ubicación y movimientos" descripcion="Mira dónde está cada pieza y muévela o cambia su estado, de a una o varias a la vez." acciones={puede("ubicaciones.gestionar") && <Link className="btn-glass" to="/ubicacion-y-movimientos/sedes">Gestionar sedes y ubicaciones</Link>} />
    {puede("piezas.ver") && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      {veUbicacion && <nav aria-label="Sedes y ubicaciones" className="glass-panel p-3 space-y-2 self-start"><h2 className="section-title">Dónde</h2>
        <button type="button" aria-pressed={lugar === ""} onClick={() => elegir("")} className={`w-full text-left rounded-btn px-2 py-1 text-sm ${lugar === "" ? "bg-azul text-white font-semibold" : "hover:bg-fondo-suave"}`}>Todas las piezas</button>
        <button type="button" aria-pressed={lugar === SIN_UBICACION} onClick={() => elegir(SIN_UBICACION)} className={`w-full text-left rounded-btn px-2 py-1 text-sm ${lugar === SIN_UBICACION ? "bg-azul text-white font-semibold" : "hover:bg-fondo-suave"}`}>Sin ubicación</button>
        <Arbol nodos={arbol.data ?? []} elegido={lugar} onElegir={elegir} /><ErrorConsulta error={arbol.error} /></nav>}
      <section className="glass-panel p-4 space-y-3">
        <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); setFiltro({ q, codigo }); setPagina(1); setMarcadas(new Set()); }}>
          <label>Denominación o descripción<input className="glass-input" value={q} onChange={(e) => setQ(e.target.value)} /></label><label>Código de pieza<input className="glass-input" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label><button className="btn-primary">Buscar pieza</button></form>
        <ErrorConsulta error={piezas.error || pieza.error} /><Aviso mensaje={op.mensaje} />
        {marcadas.size > 0 && <div className="rounded-card border border-azul p-3 space-y-3" role="region" aria-label="Acciones sobre las piezas marcadas">
          <p className="font-semibold">{marcadas.size} {marcadas.size === 1 ? "pieza marcada" : "piezas marcadas"}</p>
          {veUbicacion && puede("movimientos.registrar") && <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void aplicar((pid) => `/piezas/${pid}/movimientos`, { ubicacionNuevaId: destino, motivo: motivoMov.trim() }, "Se movió"); }}>
            <label>Mover a<select aria-label="Mover a" required className="glass-input" value={destino} onChange={(e) => setDestino(e.target.value)}><option value="">Seleccionar…</option>{destinos(arbol.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}</select></label>
            <label>Motivo del traslado<input required className="glass-input" value={motivoMov} onChange={(e) => setMotivoMov(e.target.value)} /></label>
            <button className="btn-primary" disabled={trabajando || !destino || !motivoMov.trim()}>Mover piezas</button></form>}
          {veEstado && puede("estados.cambiar") && <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void aplicar((pid) => `/piezas/${pid}/estados`, { estadoNuevoId: estado, motivo: motivoEst.trim() }, "Se cambió el estado de"); }}>
            <label>Nuevo estado<select aria-label="Nuevo estado de las piezas marcadas" required className="glass-input" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Seleccionar…</option>{estados.data?.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}</select></label>
            <label>Motivo del cambio de estado<input required className="glass-input" value={motivoEst} onChange={(e) => setMotivoEst(e.target.value)} /></label>
            <button className="btn-primary" disabled={trabajando || !estado || !motivoEst.trim()}>Cambiar estado</button></form>}
          <button type="button" className="btn-glass" onClick={() => setMarcadas(new Set())}>Quitar la marca</button>
        </div>}
        {resultado && <p role="status">{resultado}</p>}
        {piezas.isPending && <p>Cargando piezas…</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave"><tr>
          <th className="px-3 py-2"><input type="checkbox" aria-label="Marcar todas las piezas de la página" checked={todasMarcadas} onChange={() => setMarcadas(todasMarcadas ? new Set() : new Set(filas.map((p) => p.id)))} /></th>
          <th className="px-3 py-2">Pieza / códigos</th>{veUbicacion && <th className="px-3 py-2">Ubicación</th>}{veEstado && <th className="px-3 py-2">Estado</th>}<th className="px-3 py-2"><span className="sr-only">Detalle</span></th></tr></thead>
          <tbody className="divide-y divide-linea">{filas.map((p) => <tr key={p.id} className={p.id === id ? "bg-fondo-suave" : undefined}>
            <td className="px-3 py-2"><input type="checkbox" aria-label={`Marcar ${nombreFicha(p)}`} checked={marcadas.has(p.id)} onChange={() => alternar(p.id)} /></td>
            <td className="px-3 py-2"><span className="font-semibold">{nombreFicha(p)}</span><p className="text-gris-2">{p.codigos.map((c) => c.valor).join(" · ") || "Sin código"}</p></td>
            {veUbicacion && <td className="px-3 py-2">{p.etiquetas.ubicacion_actual_id || "Sin ubicación"}</td>}{veEstado && <td className="px-3 py-2">{p.etiquetas.estado_pieza_id || "Sin estado"}</td>}
            <td className="px-3 py-2"><button type="button" className="text-azul underline font-semibold" aria-label={`Ver historial de ${nombreFicha(p)}`} onClick={() => setId(p.id)}>Historial</button></td></tr>)}</tbody></table>
          {piezas.data?.total === 0 && <p className="p-3">No hay piezas con estos filtros.</p>}</div>
        <div className="flex gap-3 items-center"><button className="btn-glass" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><p>Página {pagina} · {contarPiezas(piezas.data?.total ?? 0)}</p><button className="btn-glass" disabled={!piezas.data || pagina * 20 >= piezas.data.total} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>
      </section>
    </div>}
    {pieza.data && <><div className="flex gap-4 items-center">{qr?.id === id && <img src={qr.url} width="120" height="120" alt="Código QR de la ficha" />}<div><Link className="text-azul underline" to={`/coleccion/${id}`}>{nombreFicha(pieza.data)}</Link><button className="btn-glass print:hidden" onClick={() => window.print()}>Imprimir QR</button></div></div><EstadoUbicacion key={id} pieza={pieza.data} /></>}
  </div>;
}
