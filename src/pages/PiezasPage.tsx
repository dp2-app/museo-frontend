import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { IconoRetablo } from "../components/IconoRetablo";
import { ErrorOperacion } from "../components/f0/Comun";
import { FormMotivo } from "../components/f2/FichaComun";
import { usePermisos } from "../hooks/usePermisos";
import { api } from "../lib/api";
import type { Coleccion, Pagina, PiezaV3 } from "../types";

const denominacion = (p: PiezaV3) => String(p.campos.denominacion ?? "") || "(sin denominación)";

function useColecciones() {
  return useQuery({ queryKey: ["colecciones"], queryFn: async () => (await api.get<Coleccion[]>("/colecciones")).data });
}

function Desplegable({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="glass-panel-sm">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-azul">
        {titulo}{abierto ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      {abierto && <div className="px-4 pb-4 space-y-3 border-t border-linea pt-3">{children}</div>}
    </div>
  );
}

function GestionarColecciones() {
  const queryClient = useQueryClient();
  const colecciones = useColecciones();
  const [nombre, setNombre] = useState("");
  const crear = useMutation({
    mutationFn: async () => api.post("/colecciones", { nombre: nombre.trim() }),
    onSuccess: () => { setNombre(""); queryClient.invalidateQueries({ queryKey: ["colecciones"] }); },
  });
  return (
    <>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (nombre.trim()) crear.mutate(); }} className="flex gap-2 max-w-md">
        <label className="sr-only" htmlFor="nueva-coleccion">Nombre de la nueva colección</label>
        <input id="nueva-coleccion" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la nueva colección" className="glass-input" />
        <button type="submit" disabled={crear.isPending} className="btn-primary shrink-0">Crear</button>
      </form>
      <ErrorOperacion error={crear.error} />
      <div className="flex flex-wrap gap-2">{colecciones.data?.map((c) => <span key={c.id} className="chip">{c.nombre}</span>)}</div>
    </>
  );
}

function PiezasDadasDeBaja() {
  const queryClient = useQueryClient();
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const eliminadas = useQuery({ queryKey: ["piezas-eliminadas"], queryFn: async () => (await api.get<PiezaV3[]>("/piezas/eliminadas")).data });
  const restaurar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => api.post(`/piezas/${id}/restaurar`, { motivo }),
    onSuccess: () => {
      setRestaurando(null);
      queryClient.invalidateQueries({ queryKey: ["piezas-eliminadas"] });
      queryClient.invalidateQueries({ queryKey: ["piezas"] });
    },
  });
  return (
    <>
      <ErrorOperacion error={eliminadas.error ?? restaurar.error} />
      <ul className="space-y-2 text-sm">
        {eliminadas.data?.map((p) => (
          <li key={p.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{denominacion(p)}</span>
              {restaurando !== p.id && <button type="button" onClick={() => setRestaurando(p.id)} className="btn-danger-text">Restaurar</button>}
            </div>
            {restaurando === p.id && <FormMotivo etiqueta="Motivo de la restauración" boton="Restaurar" pendiente={restaurar.isPending}
              onConfirmar={(motivo) => restaurar.mutate({ id: p.id, motivo })} onCancelar={() => setRestaurando(null)} />}
          </li>
        ))}
        {eliminadas.data?.length === 0 && <li className="text-gris-2">No hay piezas dadas de baja.</li>}
      </ul>
    </>
  );
}

export function PiezasPage() {
  const { puede } = usePermisos();
  const colecciones = useColecciones();
  const [filtros, setFiltros] = useState({ q: "", codigo: "", coleccionId: "", soloIncompletas: false });
  const [aplicados, setAplicados] = useState(filtros);
  const [pagina, setPagina] = useState(1);
  const tamano = 25;

  const piezas = useQuery({
    queryKey: ["piezas", aplicados, pagina],
    queryFn: async () => (await api.get<Pagina<PiezaV3>>("/piezas", { params: {
      pagina, tamano, q: aplicados.q || undefined, codigo: aplicados.codigo || undefined,
      coleccionId: aplicados.coleccionId || undefined, soloIncompletas: aplicados.soloIncompletas || undefined,
    } })).data,
  });
  const paginas = Math.max(1, Math.ceil((piezas.data?.total ?? 0) / tamano));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconoRetablo size={28} className="text-azul" />
          <div>
            <h1>Colección</h1>
            <p className="text-sm text-gris-2">Busca por texto, código o colección.</p>
          </div>
        </div>
        {puede("piezas.crear") && <Link to="/coleccion/nueva" className="btn-primary"><Plus size={18} aria-hidden="true" /> Registrar pieza</Link>}
      </div>

      {puede("colecciones.gestionar") && <Desplegable titulo="Gestionar colecciones"><GestionarColecciones /></Desplegable>}
      {puede("piezas.restaurar") && <Desplegable titulo="Piezas dadas de baja"><PiezasDadasDeBaja /></Desplegable>}

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); setPagina(1); setAplicados(filtros); }} className="glass-panel-sm flex flex-wrap gap-3 items-end p-4" role="search">
        <div>
          <label className="form-label" htmlFor="buscar-texto">Texto</label>
          <input id="buscar-texto" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} className="glass-input" placeholder="Denominación, autor, procedencia…" />
        </div>
        <div>
          <label className="form-label" htmlFor="buscar-codigo">Código</label>
          <input id="buscar-codigo" value={filtros.codigo} onChange={(e) => setFiltros({ ...filtros, codigo: e.target.value })} className="glass-input" placeholder="I-04381, MMZ 300…" />
        </div>
        <div>
          <label className="form-label" htmlFor="buscar-coleccion">Colección</label>
          <select id="buscar-coleccion" value={filtros.coleccionId} onChange={(e) => setFiltros({ ...filtros, coleccionId: e.target.value })} className="glass-input min-w-[10rem]">
            <option value="">Todas</option>
            {colecciones.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm pb-2">
          <input type="checkbox" checked={filtros.soloIncompletas} onChange={(e) => setFiltros({ ...filtros, soloIncompletas: e.target.checked })} />
          Solo incompletas
        </label>
        <button type="submit" className="btn-primary">Buscar</button>
      </form>

      <ErrorOperacion error={piezas.error} />
      {piezas.isPending ? <p role="status">Buscando…</p> : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gris-2 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Denominación</th>
                  <th className="px-5 py-3 font-medium">Código</th>
                  <th className="px-5 py-3 font-medium">Ficha</th>
                  <th className="px-5 py-3 font-medium">Información</th>
                  <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {piezas.data?.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        {p.fotoPrincipal ? <img src={p.fotoPrincipal.url} alt="" className="w-10 h-10 rounded-lg object-cover border border-linea" />
                          : <span className="w-10 h-10 rounded-lg border border-dashed border-linea" aria-hidden="true" />}
                        {denominacion(p)}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono">{p.codigos[0]?.valor ?? "—"}</td>
                    <td className="px-5 py-3"><ChipEstadoFicha estado={p.estadoFicha} /></td>
                    <td className="px-5 py-3">{p.incompleta ? <span className="chip">Incompleta</span> : <span className="chip !bg-verde/15 !border-verde/40 !text-verde">Completa</span>}</td>
                    <td className="px-5 py-3 text-right"><Link to={`/coleccion/${p.id}`} className="btn-danger-text">Ver ficha →</Link></td>
                  </tr>
                ))}
                {piezas.data?.items.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-gris-2">No se encontraron piezas con estos criterios.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-gris-2 border-t border-linea">
            <span>{piezas.data?.total ?? 0} resultado(s)</span>
            {paginas > 1 && (
              <span className="flex items-center gap-2">
                <button type="button" className="btn-glass !min-h-0 !py-1 !px-2" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                Página {pagina} de {paginas}
                <button type="button" className="btn-glass !min-h-0 !py-1 !px-2" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
