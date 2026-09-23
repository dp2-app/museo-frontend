import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { IconoRetablo } from "../components/IconoRetablo";
import { api, extraerMensajeError } from "../lib/api";
import type { Coleccion, Pagina, Pieza } from "../types";

function GestionarColecciones() {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["colecciones"],
    queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { pageSize: 100 } })).data,
  });

  const crear = useMutation({
    mutationFn: async (nombreNuevo: string) => (await api.post("/colecciones", { nombre: nombreNuevo })).data,
    onSuccess: () => {
      setNombre("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["colecciones"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  return (
    <div className="glass-panel-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-azul"
      >
        Gestionar colecciones (RF-010)
        {abierto ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      {abierto && (
        <div className="px-4 pb-4 space-y-3 border-t border-linea pt-3">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (nombre.trim()) crear.mutate(nombre.trim());
            }}
            className="flex gap-2 max-w-md"
          >
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la nueva colección" className="glass-input" />
            <button type="submit" disabled={crear.isPending} className="btn-primary shrink-0">
              Crear
            </button>
          </form>
          {error && <p className="text-sm text-rojo">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {data?.items.map((c) => (
              <span key={c.id} className="chip">
                {c.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PiezasPage() {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [coleccionId, setColeccionId] = useState("");
  const [soloIncompletas, setSoloIncompletas] = useState(false);

  const { data: colecciones } = useQuery({
    queryKey: ["colecciones"],
    queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { pageSize: 100 } })).data,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["piezas", codigo, coleccionId, soloIncompletas],
    queryFn: async () =>
      (
        await api.get<Pagina<Pieza>>("/piezas", {
          params: {
            pageSize: 50,
            codigo: codigo || undefined,
            coleccionId: coleccionId || undefined,
            soloIncompletas: soloIncompletas || undefined,
          },
        })
      ).data,
  });

  const [nuevaDenominacion, setNuevaDenominacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation({
    mutationFn: async (denominacion: string) => (await api.post<Pieza>("/piezas", { denominacion })).data,
    onSuccess: () => {
      setNuevaDenominacion("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["piezas"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function onBuscar(e: FormEvent) {
    e.preventDefault();
    refetch();
  }

  function onCrear(e: FormEvent) {
    e.preventDefault();
    if (nuevaDenominacion.trim()) crear.mutate(nuevaDenominacion.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <IconoRetablo size={28} className="text-azul" />
        <div>
          <h1>Colección</h1>
          <p className="text-sm text-gris-2">RF-031/RF-032 · búsqueda por código, colección y filtros combinados.</p>
        </div>
      </div>

      <GestionarColecciones />

      <form onSubmit={onBuscar} className="glass-panel-sm flex flex-wrap gap-3 items-end p-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Código</label>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Colección</label>
          <select
            value={coleccionId}
            onChange={(e) => setColeccionId(e.target.value)}
            className="glass-input min-w-[10rem]"
          >
            <option value="">Todas</option>
            {colecciones?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink-600 pb-2">
          <input
            type="checkbox"
            checked={soloIncompletas}
            onChange={(e) => setSoloIncompletas(e.target.checked)}
            className="accent-clay-600"
          />
          Solo incompletas
        </label>
        <button type="submit" className="btn-primary">
          Buscar
        </button>
      </form>

      <form onSubmit={onCrear} className="flex gap-2 max-w-lg">
        <input
          value={nuevaDenominacion}
          onChange={(e) => setNuevaDenominacion(e.target.value)}
          placeholder="Denominación de la nueva pieza (RF-006)"
          className="glass-input"
        />
        <button type="submit" disabled={crear.isPending} className="btn-primary shrink-0">
          Registrar
        </button>
      </form>
      {error && <p className="text-sm text-clay-700">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-400">Buscando...</p>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Denominación</th>
                  <th className="px-5 py-3 font-medium">Disponibilidad</th>
                  <th className="px-5 py-3 font-medium">Info. completa</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {data?.items.map((p) => (
                  <tr key={p.id} className="hover:bg-white/40 transition">
                    <td className="px-5 py-3 font-medium text-ink-800">{p.denominacion || "(sin denominación)"}</td>
                    <td className="px-5 py-3 text-ink-600">{p.disponibilidad}</td>
                    <td className="px-5 py-3">
                      {p.informacionCompleta ? (
                        <span className="chip !bg-emerald-100/80 !border-emerald-200 !text-emerald-800">Completa</span>
                      ) : (
                        <span className="chip">Incompleta</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/coleccion/${p.id}`} className="btn-danger-text">
                        Ver ficha →
                      </Link>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-4 text-ink-400">
                      No se encontraron piezas con estos criterios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-ink-400 border-t border-white/50">{data?.total ?? 0} resultado(s)</p>
        </div>
      )}
    </div>
  );
}
