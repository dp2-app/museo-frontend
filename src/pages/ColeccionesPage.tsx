import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extraerMensajeError } from "../lib/api";
import type { Coleccion, Pagina } from "../types";

export function ColeccionesPage() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim()) crear.mutate(nombre.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Colecciones</h2>
        <p className="text-sm text-stone-500">RF-010: sin límite fijo de colecciones.</p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 max-w-md">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la nueva colección"
          className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={crear.isPending}
          className="bg-stone-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
        >
          Crear
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-stone-500">Cargando...</p>
      ) : (
        <ul className="divide-y divide-stone-200 bg-white rounded-lg shadow-sm border border-stone-200">
          {data?.items.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <p className="font-medium text-stone-900">{c.nombre}</p>
              {c.descripcion && <p className="text-sm text-stone-500">{c.descripcion}</p>}
            </li>
          ))}
          {data?.items.length === 0 && (
            <li className="px-4 py-3 text-sm text-stone-500">Aún no hay colecciones registradas.</li>
          )}
        </ul>
      )}
    </div>
  );
}
