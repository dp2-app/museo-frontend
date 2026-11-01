import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { usePermisos } from "../hooks/usePermisos";
import { nombreFicha, type Ficha } from "../lib/ficha";
import type { Pagina } from "../types";
import { ErrorConsulta } from "../components/FichaComun";
import { useRecurso } from "../lib/recursosFicha";
import { EstadoUbicacion } from "../components/EstadoUbicacion";
import { GestionUbicaciones } from "../components/GestionUbicaciones";

export function UbicacionMovimientosPage() {
  const { puede } = usePermisos(); const [q, setQ] = useState(""); const [codigo, setCodigo] = useState(""); const [filtro, setFiltro] = useState({ q: "", codigo: "" });
  const [id, setId] = useState(""); const [pagina, setPagina] = useState(1); const [qr, setQr] = useState<{ id: string; url: string } | null>(null);
  const piezas = useRecurso<Pagina<Ficha>>("piezas", "/piezas", puede("piezas.ver"), { q: filtro.q || undefined, codigo: filtro.codigo || undefined, tamano: 20, pagina });
  const pieza = useRecurso<Ficha>("pieza", `/piezas/${id}`, !!id && puede("piezas.ver"));
  useEffect(() => { let actual = true; if (id) void QRCode.toDataURL(`${window.location.origin}/coleccion/${id}`, { width: 180, margin: 1 }).then((url) => { if (actual) setQr({ id, url }); }).catch(() => { if (actual) setQr(null); }); return () => { actual = false; }; }, [id]);
  return <div className="space-y-6"><h1>Ubicación y movimientos</h1><p>Consulta y registra por separado el estado y la ubicación de cada pieza.</p>
    {puede("ubicaciones.gestionar") && <details><summary className="font-semibold cursor-pointer">Gestionar sedes y ubicaciones</summary><GestionUbicaciones /></details>}
    {puede("piezas.ver") && <section className="glass-panel p-5 space-y-3"><form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); setFiltro({ q, codigo }); setPagina(1); }}>
      <label>Denominación o descripción<input className="glass-input" value={q} onChange={(e) => setQ(e.target.value)} /></label><label>Código de pieza<input className="glass-input" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label><button className="btn-primary">Buscar pieza</button></form>
      <ErrorConsulta error={piezas.error || pieza.error} /><label>Pieza<select aria-label="Pieza" className="glass-input" value={id} onChange={(e) => setId(e.target.value)}><option value="">Seleccionar…</option>{piezas.data?.items.map((p) => <option key={p.id} value={p.id}>{nombreFicha(p)} · {p.codigos.map((c) => c.valor).join(", ") || p.id.slice(0, 8)}</option>)}</select></label>
      <div className="flex gap-3 items-center"><button className="btn-glass" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><p>Página {pagina} · {piezas.data?.total ?? 0} piezas</p><button className="btn-glass" disabled={!piezas.data || pagina * 20 >= piezas.data.total} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>
    </section>}
    {pieza.data && <><div className="flex gap-4 items-center">{qr?.id === id && <img src={qr.url} width="120" height="120" alt="Código QR de la ficha" />}<div><Link className="text-azul underline" to={`/coleccion/${id}`}>{nombreFicha(pieza.data)}</Link><button className="btn-glass print:hidden" onClick={() => window.print()}>Imprimir QR</button></div></div><EstadoUbicacion key={id} pieza={pieza.data} /></>}
  </div>;
}
