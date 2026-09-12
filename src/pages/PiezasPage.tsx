import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import type { Coleccion, Pagina, Pieza } from "../types";

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
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Piezas</h2>
        <p className="text-sm text-stone-500">RF-031/RF-032: búsqueda por código, colección y filtros combinados.</p>
      </div>

      <form onSubmit={onBuscar} className="flex flex-wrap gap-2 items-end bg-white p-4 rounded-lg border border-stone-200">
        <div>
          <label className="block text-xs text-stone-500">Código (cualquier tipo)</label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500">Colección</label>
          <select
            value={coleccionId}
            onChange={(e) => setColeccionId(e.target.value)}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm min-w-[10rem]"
          >
            <option value="">Todas</option>
            {colecciones?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-stone-700 pb-1.5">
          <input type="checkbox" checked={soloIncompletas} onChange={(e) => setSoloIncompletas(e.target.checked)} />
          Solo incompletas
        </label>
        <button type="submit" className="bg-stone-900 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-stone-800">
          Buscar
        </button>
      </form>

      <form onSubmit={onCrear} className="flex gap-2 max-w-lg">
        <input
          value={nuevaDenominacion}
          onChange={(e) => setNuevaDenominacion(e.target.value)}
          placeholder="Denominación de la nueva pieza (RF-006)"
          className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={crear.isPending}
          className="bg-amber-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          Registrar pieza
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-stone-500">Buscando...</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-stone-600 text-left">
              <tr>
                <th className="px-4 py-2">Denominación</th>
                <th className="px-4 py-2">Disponibilidad</th>
                <th className="px-4 py-2">Info. completa</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-stone-900">{p.denominacion || "(sin denominación)"}</td>
                  <td className="px-4 py-2 text-stone-500">{p.disponibilidad}</td>
                  <td className="px-4 py-2">
                    {p.informacionCompleta ? (
                      <span className="text-green-700">Completa</span>
                    ) : (
                      <span className="text-amber-600">Incompleta</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/piezas/${p.id}`} className="text-amber-700 hover:underline">
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-stone-500">
                    No se encontraron piezas con estos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-stone-400">{data?.total ?? 0} resultado(s)</p>
        </div>
      )}
    </div>
  );
}
