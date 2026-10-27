import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { datosApi, extraerMensajeError } from "../lib/api";
import { detectarExcel, ESTADOS_CARGA, subirExcel, validarArchivoExcel, valorLegible } from "../lib/importacion";
import { usePermisos } from "../hooks/usePermisos";
import { ReglasImportacion } from "../components/f5/ReglasImportacion";
import type { CargaExcel, DeteccionExcel, DestinoImportacion, PlantillaMapeo } from "../types";

export function ImportacionPage() {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const permisos = usePermisos();
  const [error, setError] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hoja, setHoja] = useState("");
  const [deteccion, setDeteccion] = useState<DeteccionExcel | null>(null);
  const [plantilla, setPlantilla] = useState("");
  const solicitud = useRef(0);
  const puedeCargar = permisos.puede("importacion.cargar");
  const puedeVer = permisos.puede("importacion.ver");
  const cargas = useQuery({ queryKey: ["cargas"], enabled: puedeVer,
    queryFn: async () => (await datosApi.get<CargaExcel[]>("/importacion/cargas")).data });
  const plantillas = useQuery({ queryKey: ["plantillas-mapeo"], enabled: puedeVer,
    queryFn: async () => (await datosApi.get<PlantillaMapeo[]>("/importacion/plantillas")).data });

  const detectar = useMutation({
    mutationFn: ({ file, sheet }: { file: File; sheet?: string; numero: number }) => detectarExcel(file, sheet),
    onSuccess: (data, variables) => {
      if (variables.numero !== solicitud.current) return;
      setDeteccion(data); setHoja(data.hoja); setError(null);
    },
    onError: (e, variables) => { if (variables.numero === solicitud.current) setError(extraerMensajeError(e)); },
  });
  const subir = useMutation({
    mutationFn: () => subirExcel(archivo!, hoja, plantilla || null),
    onSuccess: (carga) => { void cache.invalidateQueries({ queryKey: ["cargas"] }); navigate(`/importacion/${carga.id}`); },
    onError: (e) => setError(extraerMensajeError(e)),
  });
  function seleccionarArchivo(file: File | null) {
    solicitud.current++; setArchivo(file); setDeteccion(null); setHoja(""); setError(null);
    if (!file) return;
    const invalido = validarArchivoExcel(file);
    if (invalido) { setError(invalido); return; }
    detectar.mutate({ file, numero: solicitud.current });
  }
  function seleccionarHoja(sheet: string) {
    setHoja(sheet); setError(null);
    if (archivo) detectar.mutate({ file: archivo, sheet, numero: ++solicitud.current });
  }

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><Upload size={28} aria-hidden="true" /><div>
      <h1>Importación</h1><p className="text-sm text-gris-2">Carga una hoja del inventario, revisa sus filas y confirma qué debe registrarse.</p>
    </div></div>

    {puedeCargar && <form onSubmit={(e: FormEvent) => { e.preventDefault(); setError(null); subir.mutate(); }} className="glass-panel p-5 space-y-4">
      <div><label htmlFor="importacion-archivo" className="block font-semibold mb-1">Archivo Excel</label>
        <input id="importacion-archivo" type="file" accept=".xlsx" required disabled={subir.isPending}
          onChange={(e) => seleccionarArchivo(e.target.files?.[0] ?? null)} className="block max-w-full" />
        <p className="text-sm text-ink-500 mt-1">Formato .xlsx sin contraseña, hasta 25 MB. Cada carga corresponde a una hoja.</p>
      </div>
      {detectar.isPending && <p role="status">Leyendo las hojas del archivo…</p>}
      {deteccion && <div className="grid gap-4 md:grid-cols-2">
        <div><label htmlFor="importacion-hoja" className="block font-semibold mb-1">Hoja del archivo</label>
          <select id="importacion-hoja" value={hoja} onChange={(e) => seleccionarHoja(e.target.value)} disabled={subir.isPending || detectar.isPending} className="glass-input w-full">
            {deteccion.hojas.map((name) => <option key={name}>{name}</option>)}
          </select>
          <p className="text-sm text-ink-500 mt-1">Selecciona Inventario o AJB para el archivo preparado. Las hojas de consulta se conservan sin importarlas como piezas.</p>
        </div>
        <div><label htmlFor="importacion-formato" className="block font-semibold mb-1">Formato de columnas</label>
          <select id="importacion-formato" value={plantilla} onChange={(e) => setPlantilla(e.target.value)} disabled={subir.isPending || plantillas.isLoading} className="glass-input w-full">
            <option value="">Reconocer encabezados automáticamente</option>
            {plantillas.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <p className="text-sm text-ink-500 mt-1">Para el Excel preparado, elige «Inventario MATP (formato habitual)».</p>
        </div>
      </div>}
      {deteccion && !detectar.isPending && <div className="text-sm space-y-2">
        <p role="status">Hoja {hoja}: {deteccion.columnas[0]?.total ?? 0} filas y {deteccion.columnas.length} columnas.</p>
        <details><summary className="cursor-pointer font-semibold">Ver columnas y muestra del archivo</summary>
          <div className="max-h-72 overflow-auto mt-2"><table className="w-full text-left"><thead><tr><th className="p-2">Columna</th><th className="p-2">Primeros valores</th></tr></thead>
            <tbody>{deteccion.columnas.map((c) => <tr key={c.columna}><th className="p-2 font-medium">{c.columna}</th><td className="p-2 whitespace-pre-wrap">{c.muestra.map(valorLegible).join("; ")}</td></tr>)}</tbody>
          </table></div>
        </details>
        <p>La carga conserva los valores originales. Todavía no se crean ni modifican piezas.</p>
      </div>}
      {error && <p role="alert" className="text-rojo">{error}</p>}
      {plantillas.isError && <p role="alert">{extraerMensajeError(plantillas.error)}</p>}
      <button type="submit" className="btn-primary" disabled={!archivo || !deteccion || deteccion.hoja !== hoja || detectar.isPending || subir.isPending}>
        {subir.isPending ? "Validando el inventario…" : "Cargar hoja para revisión"}
      </button>
      {subir.isPending && <p role="status" className="text-sm">Un inventario completo puede tardar varios minutos. Espera el resultado de la validación.</p>}
    </form>}

    {puedeVer && <ReglasImportacion />}

    {permisos.puede("importacion.configurar") && <NuevaPlantillaForm onCreada={() => { void cache.invalidateQueries({ queryKey: ["plantillas-mapeo"] }); }} columnas={deteccion?.columnas.map((c) => c.columna) ?? []} />}

    {puedeVer && <section className="space-y-3" aria-label="Historial de cargas">
      <h2 className="section-title">Historial de cargas</h2>
      {cargas.isLoading && <p role="status">Cargando historial…</p>}
      {cargas.isError && <p role="alert">{extraerMensajeError(cargas.error)}</p>}
      <div className="glass-panel overflow-x-auto"><table className="w-full text-sm text-left">
        <thead><tr>{["Archivo y hoja", "Estado", "Nuevas", "Actualizaciones", "Posibles duplicados", ""].map((h, i) => <th key={i} className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody>{cargas.data?.map((c) => <tr key={c.id} className="border-t border-ink-100">
          <td className="px-4 py-3">{c.archivoNombre}<span className="block text-ink-500">{c.hojaNombre}</span></td>
          <td className="px-4 py-3">{ESTADOS_CARGA[c.estado]}</td><td className="px-4 py-3">{c.filasNuevas}</td>
          <td className="px-4 py-3">{c.filasActualizacion}</td><td className="px-4 py-3">{c.filasDuplicadas}</td>
          <td className="px-4 py-3"><Link to={`/importacion/${c.id}`} className="text-clay-700 underline">Revisar carga</Link></td>
        </tr>)}</tbody>
      </table>{cargas.data?.length === 0 && <p className="p-4">Aún no hay cargas.</p>}</div>
    </section>}
  </div>;
}

function NuevaPlantillaForm({ onCreada, columnas }: { onCreada: () => void; columnas: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fuente, setFuente] = useState("");
  const [filas, setFilas] = useState([{ origen: "", destino: "" }]);
  const [error, setError] = useState("");
  const destinos = useQuery({ queryKey: ["importacion-destinos"], enabled: abierto,
    queryFn: async () => (await datosApi.get<DestinoImportacion[]>("/importacion/destinos")).data });
  const crear = useMutation({
    mutationFn: async () => {
      const normalizadas = filas.map((f) => ({ ...f, origen: f.origen.trim().replace(/\s+/g, " ") }));
      if (normalizadas.some((f) => !!f.origen !== !!f.destino)) throw new Error("Completa la columna y el dato de destino de cada asignación.");
      const completas = normalizadas.filter((f) => f.origen && f.destino);
      if (!completas.length) throw new Error("Asigna al menos una columna del archivo.");
      if (new Set(completas.map((f) => f.origen)).size !== completas.length) throw new Error("No repitas una columna de origen.");
      return (await datosApi.post<PlantillaMapeo>("/importacion/plantillas", { nombre, fuenteOrigen: fuente,
        mapeoColumnas: Object.fromEntries(completas.map((f) => [f.origen, f.destino])) })).data;
    },
    onSuccess: () => { setAbierto(false); setNombre(""); setFuente(""); setFilas([{ origen: "", destino: "" }]); setError(""); onCreada(); },
    onError: (e) => setError("isAxiosError" in e ? extraerMensajeError(e) : e.message),
  });
  if (!abierto) return <button className="btn-glass" onClick={() => setAbierto(true)}>Configurar un formato de columnas</button>;
  return <form className="glass-panel p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); setError(""); crear.mutate(); }}>
    <h2 className="section-title">Nuevo formato de columnas</h2>
    <p className="text-sm">Asocia el nombre habitual de cada columna con un dato de la ficha. Esta configuración se reutiliza en las siguientes cargas.</p>
    <div className="grid gap-3 sm:grid-cols-2"><label>Nombre del formato<input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="glass-input w-full" /></label>
      <label>Inventario de origen<input required value={fuente} onChange={(e) => setFuente(e.target.value)} className="glass-input w-full" /></label></div>
    {filas.map((fila, i) => <div key={i} className="flex flex-wrap gap-2 items-end">
      <label className="flex-1 min-w-48">Columna del Excel<input aria-label={`Columna de origen ${i + 1}`} list="columnas-archivo" value={fila.origen} onChange={(e) => setFilas((prev) => prev.map((f, n) => n === i ? { ...f, origen: e.target.value } : f))} className="glass-input w-full" /></label>
      <label className="flex-1 min-w-48">Dato de la ficha<select aria-label={`Dato de destino ${i + 1}`} value={fila.destino} onChange={(e) => setFilas((prev) => prev.map((f, n) => n === i ? { ...f, destino: e.target.value } : f))} className="glass-input w-full">
        <option value="">Elegir dato</option>{destinos.data?.map((d) => <option key={d.clave} value={d.clave}>{d.etiqueta}</option>)}
      </select></label><button type="button" className="btn-glass" onClick={() => setFilas((prev) => prev.filter((_, n) => n !== i))}>Quitar</button>
    </div>)}
    <datalist id="columnas-archivo">{columnas.map((c) => <option key={c} value={c} />)}</datalist>
    <button type="button" className="btn-glass" onClick={() => setFilas((prev) => [...prev, { origen: "", destino: "" }])}>Añadir columna</button>
    {destinos.isError && <p role="alert">{extraerMensajeError(destinos.error)}</p>}{error && <p role="alert">{error}</p>}
    <div className="flex gap-3"><button className="btn-primary" disabled={crear.isPending || !destinos.data}>Guardar formato</button>
      <button type="button" className="btn-glass" onClick={() => setAbierto(false)}>Cancelar</button></div>
  </form>;
}
