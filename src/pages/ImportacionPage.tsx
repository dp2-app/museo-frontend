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
        <h2 className="font-display text-2xl font-semibold text-ink-800">Importación de Excel</h2>
        <p className="text-sm text-ink-400 max-w-2xl">
          RF-021 · ingesta → mapeo → normalización → matching → clasificación → previsualización → aprobación →
          bitácora. Nada se escribe en el catálogo hasta que apruebas la carga.
        </p>
      </div>

      <NuevaPlantillaForm onCreada={() => queryClient.invalidateQueries({ queryKey: ["plantillas-mapeo"] })} />

      <form onSubmit={onSubmit} className="glass-panel-sm flex flex-wrap gap-3 items-center p-4">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" required className="text-sm text-ink-600" />
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">
            Plantilla de mapeo (opcional)
          </label>
          <select
            value={plantillaSeleccionada}
            onChange={(e) => setPlantillaSeleccionada(e.target.value)}
            className="glass-input min-w-[14rem]"
          >
            <option value="">Sin mapeo (usar columnas tal cual)</option>
            {plantillas?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.fuenteOrigen}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={subir.isPending} className="btn-primary">
          {subir.isPending ? "Subiendo..." : "Subir archivo"}
        </button>
      </form>
      {error && <p className="text-sm text-clay-700">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-400">Cargando bitácora...</p>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Archivo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Nuevas</th>
                  <th className="px-5 py-3 font-medium">Actualización</th>
                  <th className="px-5 py-3 font-medium">Duplicadas</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {cargas?.map((c) => (
                  <tr key={c.id} className="hover:bg-white/40 transition">
                    <td className="px-5 py-3 font-medium text-ink-800">{c.archivoNombre}</td>
                    <td className="px-5 py-3">
                      <span className="chip">{etiquetaEstado[c.estado]}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{c.filasNuevas}</td>
                    <td className="px-5 py-3 text-ink-600">{c.filasActualizacion}</td>
                    <td className="px-5 py-3 text-ink-600">{c.filasDuplicadas}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/importacion/${c.id}`} className="btn-danger-text">
                        Revisar →
                      </Link>
                    </td>
                  </tr>
                ))}
                {cargas?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-4 text-ink-400">
                      Aún no se ha subido ningún archivo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
      <button onClick={() => setAbierto(true)} className="btn-glass">
        + Nueva plantilla de mapeo de columnas
      </button>
    );
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        crear.mutate();
      }}
      className="glass-panel p-5 space-y-4"
    >
      <div className="flex justify-between items-start">
        <h3 className="section-title">Nueva plantilla de mapeo</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-ink-400 hover:text-ink-600 hover:underline">
          Cancelar
        </button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Nombre</label>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Fuente de origen</label>
          <input
            required
            placeholder="p. ej. excel_deposito_2"
            value={fuenteOrigen}
            onChange={(e) => setFuenteOrigen(e.target.value)}
            className="glass-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-ink-400">Columna del Excel → campo del modelo</p>
        {filas.map((fila, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              placeholder="Columna en el Excel (p. ej. CODIGO_I)"
              value={fila.columnaOrigen}
              onChange={(e) => actualizarFila(i, "columnaOrigen", e.target.value)}
              className="glass-input flex-1"
            />
            <span className="text-clay-500">→</span>
            <input
              list="campos-destino-sugeridos"
              placeholder="Campo destino (p. ej. codigo_i)"
              value={fila.campoDestino}
              onChange={(e) => actualizarFila(i, "campoDestino", e.target.value)}
              className="glass-input flex-1"
            />
            <button
              type="button"
              onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-clay-600 hover:underline text-xs shrink-0"
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
          className="text-xs text-clay-700 hover:underline"
        >
          + Añadir fila de mapeo
        </button>
      </div>

      {error && <p className="text-sm text-clay-700">{error}</p>}
      <button type="submit" disabled={crear.isPending} className="btn-primary">
        Guardar plantilla
      </button>
    </form>
  );
}
