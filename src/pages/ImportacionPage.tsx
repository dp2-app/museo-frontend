import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import type { CargaExcel } from "../types";

export function ImportacionPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: cargas, isLoading } = useQuery({
    queryKey: ["cargas"],
    queryFn: async () => (await api.get<CargaExcel[]>("/importacion/cargas")).data,
  });

  const subir = useMutation({
    mutationFn: async (archivo: File) => {
      const form = new FormData();
      form.append("archivo", archivo);
      return (await api.post<CargaExcel>("/importacion/cargas", form)).data;
    },
    onSuccess: () => {
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const archivo = fileInputRef.current?.files?.[0];
    if (archivo) subir.mutate(archivo);
  }

  const etiquetaEstado: Record<CargaExcel["estado"], string> = {
    en_revision: "En revisión",
    pendiente_aprobacion: "Pendiente de aprobación",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Importación de Excel</h2>
        <p className="text-sm text-stone-500">
          RF-021: ingesta → mapeo → normalización → matching → clasificación → previsualización → aprobación → bitácora.
          Nada se escribe en el catálogo hasta que apruebas la carga.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 items-center bg-white p-4 rounded-lg border border-stone-200">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" required className="text-sm" />
        <button
          type="submit"
          disabled={subir.isPending}
          className="bg-stone-900 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
        >
          {subir.isPending ? "Subiendo..." : "Subir archivo"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-stone-500">Cargando bitácora...</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-stone-600 text-left">
              <tr>
                <th className="px-4 py-2">Archivo</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Nuevas</th>
                <th className="px-4 py-2">Actualización</th>
                <th className="px-4 py-2">Duplicadas</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cargas?.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-stone-900">{c.archivoNombre}</td>
                  <td className="px-4 py-2">{etiquetaEstado[c.estado]}</td>
                  <td className="px-4 py-2">{c.filasNuevas}</td>
                  <td className="px-4 py-2">{c.filasActualizacion}</td>
                  <td className="px-4 py-2">{c.filasDuplicadas}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/importacion/${c.id}`} className="text-amber-700 hover:underline">
                      Revisar
                    </Link>
                  </td>
                </tr>
              ))}
              {cargas?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-stone-500">
                    Aún no se ha subido ningún archivo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
