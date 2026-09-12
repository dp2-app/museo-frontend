import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import type { CargaExcel, PlantillaMapeo } from "../types";

const CAMPOS_DESTINO_SUGERIDOS = [
  "codigo_i",
  "denominacion",
  "descripcion",
  "procedencia",
  "autor",
  "materiales",
  "tecnica",
  "medidas",
  "observaciones",
];

export function ImportacionPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState("");

  const { data: cargas, isLoading } = useQuery({
    queryKey: ["cargas"],
    queryFn: async () => (await api.get<CargaExcel[]>("/importacion/cargas")).data,
  });

  const { data: plantillas } = useQuery({
    queryKey: ["plantillas-mapeo"],
    queryFn: async () => (await api.get<PlantillaMapeo[]>("/importacion/plantillas")).data,
  });

  const subir = useMutation({
    mutationFn: async (archivo: File) => {
      const form = new FormData();
      form.append("archivo", archivo);
      if (plantillaSeleccionada) form.append("plantilla_mapeo_id", plantillaSeleccionada);
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

      <NuevaPlantillaForm
        onCreada={() => queryClient.invalidateQueries({ queryKey: ["plantillas-mapeo"] })}
      />

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-center bg-white p-4 rounded-lg border border-stone-200">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" required className="text-sm" />
        <div>
          <label className="block text-xs text-stone-500">Plantilla de mapeo (RF-022, opcional)</label>
          <select
            value={plantillaSeleccionada}
            onChange={(e) => setPlantillaSeleccionada(e.target.value)}
            className="rounded border border-stone-300 px-2 py-1.5 text-sm min-w-[14rem]"
          >
            <option value="">Sin mapeo (usar columnas tal cual)</option>
            {plantillas?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.fuenteOrigen}
              </option>
            ))}
          </select>
        </div>
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

interface FilaMapeo {
  columnaOrigen: string;
  campoDestino: string;
}

function NuevaPlantillaForm({ onCreada }: { onCreada: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fuenteOrigen, setFuenteOrigen] = useState("");
  const [filas, setFilas] = useState<FilaMapeo[]>([{ columnaOrigen: "", campoDestino: "" }]);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => {
      const mapeoColumnas = Object.fromEntries(
        filas.filter((f) => f.columnaOrigen.trim() && f.campoDestino.trim()).map((f) => [f.columnaOrigen.trim(), f.campoDestino.trim()]),
      );
      return (
        await api.post<PlantillaMapeo>("/importacion/plantillas", { nombre, fuenteOrigen, mapeoColumnas })
      ).data;
    },
    onSuccess: () => {
      setError(null);
      setNombre("");
      setFuenteOrigen("");
      setFilas([{ columnaOrigen: "", campoDestino: "" }]);
      setAbierto(false);
      onCreada();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function actualizarFila(i: number, campo: keyof FilaMapeo, valor: string) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-sm text-amber-700 hover:underline"
      >
        + Nueva plantilla de mapeo de columnas (RF-022)
      </button>
    );
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        crear.mutate();
      }}
      className="bg-white p-4 rounded-lg border border-stone-200 space-y-3"
    >
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-stone-900">Nueva plantilla de mapeo</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-stone-500 hover:underline">
          Cancelar
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <div>
          <label className="block text-xs text-stone-500">Nombre</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500">Fuente de origen</label>
          <input
            required
            placeholder="p. ej. excel_deposito_2"
            value={fuenteOrigen}
            onChange={(e) => setFuenteOrigen(e.target.value)}
            className="rounded border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-stone-500">Columna del Excel → campo del modelo</p>
        {filas.map((fila, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              placeholder="Columna en el Excel (p. ej. CODIGO_I)"
              value={fila.columnaOrigen}
              onChange={(e) => actualizarFila(i, "columnaOrigen", e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-sm flex-1"
            />
            <span className="text-stone-400">→</span>
            <input
              list="campos-destino-sugeridos"
              placeholder="Campo destino (p. ej. codigo_i)"
              value={fila.campoDestino}
              onChange={(e) => actualizarFila(i, "campoDestino", e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-red-500 hover:underline text-xs"
            >
              Quitar
            </button>
          </div>
        ))}
        <datalist id="campos-destino-sugeridos">
          {CAMPOS_DESTINO_SUGERIDOS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => setFilas((prev) => [...prev, { columnaOrigen: "", campoDestino: "" }])}
          className="text-xs text-amber-700 hover:underline"
        >
          + Añadir fila de mapeo
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={crear.isPending}
        className="bg-stone-900 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
      >
        Guardar plantilla
      </button>
    </form>
  );
}
