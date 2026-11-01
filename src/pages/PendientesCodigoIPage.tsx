import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Search } from "lucide-react";
import { useConsultaF0 } from "../hooks/useConsultaF0";
import { usePermisos } from "../hooks/usePermisos";
import { useTiposCodigo } from "../hooks/useCatalogosF1";
import { puedeCorregir } from "../lib/f1";
import { api } from "../lib/api";
import type { Pagina } from "../types";
import type { EstadoFicha } from "../types";
import type { Codigo, PiezaResumenF1 } from "../types/f1";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { IconoRetablo } from "../components/IconoRetablo";
import { EstadoConsulta } from "../components/f0/Comun";
import { InsigniaPendienteI } from "../components/f1/PendienteCodigoI";
import { AgregarCodigo } from "../components/f1/CampoCodigo";
import { CorregirCodigo } from "../components/f1/CorregirCodigo";

const TAMANO = 20;

interface Asignado { piezaId: string; denominacion: string; codigo: Codigo; }

/** RF-06 (F1-D6): piezas sin código I cuyo régimen lo admite. El criterio lo aplica el backend con
 * `sinCodigoPrincipal=true`; las piezas en comodato o préstamo nunca aparecen. Desde aquí se asigna el I
 * (con validación en vivo y el correlativo sugerido) y, si hubo un error al tipearlo, se corrige (RF-05). */
export function PendientesCodigoIPage() {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const { puede } = usePermisos();
  const cache = useQueryClient();
  const principal = useTiposCodigo().data?.find((t) => t.esPrincipal);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [asignados, setAsignados] = useState<Asignado[]>([]);
  const consulta = useConsultaF0({
    queryKey: ["f1", "pendientes-i", q, pagina],
    queryFn: async () => (await api.get<Pagina<PiezaResumenF1>>("/piezas", {
      params: { sinCodigoPrincipal: true, q: q || undefined, pagina, tamano: TAMANO, orden: "denominacion" },
    })).data,
  });
  const total = consulta.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANO));
  function buscar(e: FormEvent) { e.preventDefault(); setPagina(1); setQ(texto.trim()); }

  return <div className="space-y-6">
    <div>
      <Link to="/coleccion" className="btn-danger-text inline-flex items-center gap-1 text-sm"><ChevronLeft size={20} aria-hidden="true" />Colección</Link>
      <div className="mt-2 flex items-center gap-4">
        <span className="hidden sm:flex h-14 w-14 items-center justify-center rounded-card bg-white border border-linea"><IconoRetablo size={24} className="text-azul" /></span>
        <div>
          <h1>Pendientes de código I</h1>
          <p className="text-sm text-gris-2">Piezas registradas sin código de inventario cuyo régimen lo admite. Las piezas en comodato o préstamo no aparecen.</p>
        </div>
      </div>
    </div>

    <form className="f0-toolbar f0-catalogue" role="search" onSubmit={buscar}>
      <div className="relative flex-1 min-w-0"><Search size={20} className="absolute left-3 top-3 text-texto/60 pointer-events-none" aria-hidden="true" />
        <input className="glass-input !pl-10 text-base" type="search" aria-label="Buscar entre las pendientes" placeholder="Denominación, autor, procedencia…" value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
      <button className="btn-glass">Buscar</button>
    </form>

    {asignados.length > 0 && <section className="f0-surface space-y-3" aria-label="Códigos asignados">
      <h2 className="section-title">Asignados en esta visita</h2>
      <ul className="divide-y divide-linea">{asignados.map((a) => <li key={a.codigo.id} className="py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p><Link to={`/coleccion/${a.piezaId}`} className="font-accent italic text-azul hover:underline">{a.denominacion}</Link>
            {" · "}{a.codigo.tipoNombre} <span className="font-mono">{a.codigo.valor}</span>{a.codigo.bloqueado && <Lock size={14} className="inline ml-1 text-gris-2" aria-label="Bloqueado (RN-02)" />}</p>
          {puedeCorregir(a.codigo, puede) && corrigiendo !== a.codigo.id && <button type="button" className="f0-action" onClick={() => setCorrigiendo(a.codigo.id)}>Corregir {a.codigo.valor}</button>}
        </div>
        {corrigiendo === a.codigo.id && <CorregirCodigo piezaId={a.piezaId} codigo={a.codigo} alCancelar={() => setCorrigiendo(null)}
          alTerminar={(codigo) => { setCorrigiendo(null); setAsignados(asignados.map((x) => x.codigo.id === codigo.id ? { ...x, codigo } : x)); }} />}
      </li>)}</ul>
    </section>}

    {consulta.isPending ? <p role="status">Cargando piezas pendientes…</p>
      : <EstadoConsulta cargando={false} error={consulta.error} reintentar={() => { void consulta.refetch(); }} />}
    {consulta.data && <>
      <p role="status" className="text-sm text-texto/70">{total === 1 ? "1 pieza pendiente" : `${total} piezas pendientes`}{q && ` que coinciden con «${q}»`}</p>
      {consulta.data.items.length === 0
        ? <div className="f0-surface text-center space-y-2"><IconoRetablo size={32} className="text-gris-1 mx-auto" />
            <p className="font-semibold text-azul">{q ? "Ninguna pieza pendiente coincide con la búsqueda" : "No hay piezas pendientes de código I"}</p>
            {q && <button type="button" className="f0-action" onClick={() => { setTexto(""); setQ(""); setPagina(1); }}>Limpiar búsqueda</button>}</div>
        : <ul className="f0-catalogue divide-y divide-linea">{consulta.data.items.map((p) => <li key={p.id} className="p-4 space-y-4"><div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-btn bg-fondo-suave">
              {p.fotoPrincipal && <img src={p.fotoPrincipal.url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
            <div className="flex-1 min-w-[12rem]">
              <Link to={`/coleccion/${p.id}`} className="font-accent italic text-lg text-azul hover:underline">{String(p.campos.denominacion ?? "Sin denominación")}</Link>
              <p className="text-sm text-texto/70 mt-1">{p.tenenciaVigente?.regimenNombre ?? "Sin régimen"}
                {p.codigos.length > 0 && ` · ${p.codigos.map((c) => `${c.tipoNombre} ${c.valor}`).join(" · ")}`}</p>
              <div className="mt-2 flex flex-wrap gap-2"><InsigniaPendienteI /><ChipEstadoFicha estado={p.estadoFicha as EstadoFicha} /></div>
            </div>
            {puede("codigos.gestionar") && principal && asignando !== p.id
              ? <button type="button" className="btn-glass" onClick={() => setAsignando(p.id)} aria-label={`Asignar código I a ${String(p.campos.denominacion ?? "la pieza")}`}>Asignar código I</button>
              : asignando !== p.id && <Link to={`/coleccion/${p.id}`} className="btn-glass">Ver ficha</Link>}
          </div>
          {asignando === p.id && principal && <div className="glass-panel p-4 space-y-2">
            <AgregarCodigo piezaId={p.id} tipoFijo={principal.id} alGuardar={(codigo) => {
              setAsignando(null);
              setAsignados([{ piezaId: p.id, denominacion: String(p.campos.denominacion ?? "Sin denominación"), codigo }, ...asignados]);
              void cache.invalidateQueries({ queryKey: ["f1"] });
            }} />
            <button type="button" className="btn-danger-text text-sm" onClick={() => setAsignando(null)}>Cancelar</button>
          </div>}
          </li>)}</ul>}
      {paginas > 1 && <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
        <button type="button" className="f0-action" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft size={20} aria-hidden="true" /></button>
        <span className="text-sm" aria-current="page">Página {pagina} de {paginas}</span>
        <button type="button" className="f0-action" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label="Página siguiente"><ChevronRight size={20} aria-hidden="true" /></button>
      </nav>}
    </>}
  </div>;
}
