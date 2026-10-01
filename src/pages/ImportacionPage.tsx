import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import { MensajeError } from "../components/MensajeError";
import { api, extraerMensajeError } from "../lib/api";
import type { CampoDestino, CargaExcel, DeteccionColumnas, PlantillaMapeo } from "../types";

function detectarColumnas(archivo: File, plantillaId?: string) {
  const form = new FormData();
  form.append("archivo", archivo);
  if (plantillaId) form.append("plantilla_mapeo_id", plantillaId);
  return api.post<DeteccionColumnas>("/importacion/columnas", form).then((r) => r.data);
}

export function ImportacionPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivoElegido, setArchivoElegido] = useState<File | null>(null);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState("");

  const { data: cargas, isLoading } = useQuery({
    queryKey: ["cargas"],
    queryFn: async () => (await api.get<CargaExcel[]>("/importacion/cargas")).data,
  });

  const { data: plantillas } = useQuery({
    queryKey: ["plantillas-mapeo"],
    queryFn: async () => (await api.get<PlantillaMapeo[]>("/importacion/plantillas")).data,
  });

  // RF-29: antes de subir, avisa qué columnas de la plantilla no trae el archivo y cuáles sobran.
  const compatibilidad = useQuery({
    queryKey: ["compatibilidad", archivoElegido?.name, archivoElegido?.lastModified, plantillaSeleccionada],
    queryFn: () => detectarColumnas(archivoElegido as File, plantillaSeleccionada),
    enabled: archivoElegido !== null && plantillaSeleccionada !== "",
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
      setArchivoElegido(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (archivoElegido) subir.mutate(archivoElegido);
  }

  const etiquetaEstado: Record<CargaExcel["estado"], string> = {
    en_revision: "En revisión",
    pendiente_aprobacion: "Pendiente de aprobación",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
  };

  const faltantes = compatibilidad.data?.faltantes ?? [];
  const sobrantes = compatibilidad.data?.sobrantes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Upload size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Importación</h1>
          <p className="text-sm text-gris-2 max-w-2xl">
            Sube un Excel, revisa cómo se interpretará cada fila y aprueba la carga. Nada se escribe en el catálogo hasta que la apruebes.
          </p>
        </div>
      </div>

      <NuevaPlantillaForm onCreada={() => queryClient.invalidateQueries({ queryKey: ["plantillas-mapeo"] })} />

      <form onSubmit={onSubmit} className="glass-panel-sm flex flex-wrap gap-3 items-center p-4">
        <div>
          <label htmlFor="archivo-excel" className="form-label">Archivo Excel</label>
          <input
            id="archivo-excel"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            required
            onChange={(e) => setArchivoElegido(e.target.files?.[0] ?? null)}
            className="text-sm text-texto"
          />
        </div>
        <div>
          <label htmlFor="plantilla-mapeo" className="form-label">Plantilla de mapeo (opcional)</label>
          <select
            id="plantilla-mapeo"
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
        {(faltantes.length > 0 || sobrantes.length > 0) && (
          <div className="basis-full text-sm space-y-1" role="status">
            {faltantes.length > 0 && (
              <MensajeError>
                Este archivo no trae {faltantes.length === 1 ? "la columna" : "las columnas"}{" "}
                <strong>{faltantes.join(", ")}</strong> de la plantilla: esos campos quedarán vacíos.
              </MensajeError>
            )}
            {sobrantes.length > 0 && (
              <p className="text-gris-2">
                {sobrantes.length === 1 ? "La columna" : "Las columnas"} <strong>{sobrantes.join(", ")}</strong>{" "}
                {sobrantes.length === 1 ? "no está" : "no están"} en la plantilla: se conservan sin mapear.
              </p>
            )}
          </div>
        )}
      </form>
      {error && <MensajeError>{error}</MensajeError>}
      {compatibilidad.isError && (
        <MensajeError>{extraerMensajeError(compatibilidad.error)}</MensajeError>
      )}

      {isLoading ? (
        <p className="text-sm text-gris-2">Cargando bitácora...</p>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gris-2 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Archivo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Nuevas</th>
                  <th className="px-5 py-3 font-medium">Actualización</th>
                  <th className="px-5 py-3 font-medium">Duplicadas</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {cargas?.map((c) => (
                  <tr key={c.id} className="hover:bg-fondo-suave transition">
                    <td className="px-5 py-3 font-medium text-texto">{c.archivoNombre}</td>
                    <td className="px-5 py-3">
                      <span className="chip">{etiquetaEstado[c.estado]}</span>
                    </td>
                    <td className="px-5 py-3 text-texto">{c.filasNuevas}</td>
                    <td className="px-5 py-3 text-texto">{c.filasActualizacion}</td>
                    <td className="px-5 py-3 text-texto">{c.filasDuplicadas}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/importacion/${c.id}`} className="btn-danger-text">
                        Revisar →
                      </Link>
                    </td>
                  </tr>
                ))}
                {cargas?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-4 text-gris-2">
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

/** RF-29: plantilla guiada por las columnas reales de un Excel de muestra. */
function NuevaPlantillaForm({ onCreada }: { onCreada: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fuenteOrigen, setFuenteOrigen] = useState("");
  const [columnas, setColumnas] = useState<DeteccionColumnas["columnas"]>([]);
  const [asignacion, setAsignacion] = useState<Record<string, string>>({}); // columna → campo destino
  const [error, setError] = useState<string | null>(null);
  const muestraRef = useRef<HTMLInputElement>(null);

  const { data: campos } = useQuery({
    queryKey: ["campos-destino"],
    queryFn: async () => (await api.get<CampoDestino[]>("/importacion/campos-destino")).data,
    enabled: abierto,
  });

  const detectar = useMutation({
    mutationFn: (archivo: File) => detectarColumnas(archivo),
    onSuccess: (d) => {
      setError(null);
      setColumnas(d.columnas);
      setAsignacion({});
    },
    onError: (err) => {
      setColumnas([]);
      setError(extraerMensajeError(err));
    },
  });

  const asignados = Object.values(asignacion).filter(Boolean);
  const obligatoriosSinColumna = (campos ?? []).filter((c) => c.obligatorio && !asignados.includes(c.campo));
  const repetidos = [...new Set(asignados.filter((c, i) => asignados.indexOf(c) !== i))];
  const etiqueta = (campo: string) => campos?.find((c) => c.campo === campo)?.etiqueta ?? campo;
  const listo = asignados.length > 0 && obligatoriosSinColumna.length === 0 && repetidos.length === 0;

  const crear = useMutation({
    mutationFn: async () =>
      (
        await api.post<PlantillaMapeo>("/importacion/plantillas", {
          nombre,
          fuenteOrigen,
          mapeoColumnas: Object.fromEntries(Object.entries(asignacion).filter(([, campo]) => campo)),
        })
      ).data,
    onSuccess: () => {
      setError(null);
      setNombre("");
      setFuenteOrigen("");
      setColumnas([]);
      setAsignacion({});
      setAbierto(false);
      onCreada();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

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
        <div>
          <h3 className="section-title">Nueva plantilla de mapeo</h3>
          <p className="text-sm text-gris-2">
            1. Elige un Excel de muestra. 2. Indica a qué campo de la ficha corresponde cada columna. 3. Guarda la
            plantilla para usarla en otras cargas.
          </p>
        </div>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-gris-2 hover:underline">
          Cancelar
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div>
          <label htmlFor="plantilla-nombre" className="form-label">Nombre</label>
          <input id="plantilla-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label htmlFor="plantilla-fuente" className="form-label">Fuente de origen</label>
          <input
            id="plantilla-fuente"
            required
            placeholder="p. ej. excel_deposito_2"
            value={fuenteOrigen}
            onChange={(e) => setFuenteOrigen(e.target.value)}
            className="glass-input"
          />
        </div>
        <div>
          <label htmlFor="excel-muestra" className="form-label">1. Excel de muestra</label>
          <input
            id="excel-muestra"
            ref={muestraRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) detectar.mutate(archivo);
            }}
            className="text-sm text-texto"
          />
        </div>
      </div>

      {detectar.isPending && <p className="text-sm text-gris-2">Leyendo columnas...</p>}

      {columnas.length > 0 && (
        <div className="space-y-2">
          <p className="form-label">2. Columna del Excel → campo de la ficha</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gris-2 text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-2 pr-4 font-medium">Columna</th>
                  <th className="py-2 pr-4 font-medium">Ejemplos del archivo</th>
                  <th className="py-2 font-medium">Campo de la ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {columnas.map((col) => (
                  <tr key={col.nombre}>
                    <td className="py-2 pr-4 font-mono text-xs text-texto">{col.nombre}</td>
                    <td className="py-2 pr-4 text-gris-2 max-w-xs truncate">{col.ejemplos.join(" · ") || "(vacía)"}</td>
                    <td className="py-2">
                      <select
                        aria-label={`Campo para la columna ${col.nombre}`}
                        value={asignacion[col.nombre] ?? ""}
                        onChange={(e) => setAsignacion((prev) => ({ ...prev, [col.nombre]: e.target.value }))}
                        className="glass-input min-w-[14rem]"
                      >
                        <option value="">No usar esta columna</option>
                        {campos?.map((c) => (
                          <option key={c.campo} value={c.campo}>
                            {c.etiqueta}
                            {c.obligatorio ? " (obligatorio)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {obligatoriosSinColumna.length > 0 && (
            <MensajeError>
              Falta asignar una columna a: <strong>{obligatoriosSinColumna.map((c) => c.etiqueta).join(", ")}</strong>.
            </MensajeError>
          )}
          {repetidos.length > 0 && (
            <MensajeError>
              Hay más de una columna asignada a: <strong>{repetidos.map(etiqueta).join(", ")}</strong>.
            </MensajeError>
          )}
        </div>
      )}

      {error && <MensajeError>{error}</MensajeError>}
      <button type="submit" disabled={crear.isPending || !listo} className="btn-primary">
        3. Guardar plantilla
      </button>
    </form>
  );
}
