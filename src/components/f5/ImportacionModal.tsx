import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, FileSpreadsheet, History, LoaderCircle, ShieldCheck, UploadCloud, X } from "lucide-react";
import { datosApi, extraerMensajeError } from "../../lib/api";
import { detectarExcel, ESTADOS_CARGA, subirExcel, validarArchivoExcel, valorLegible } from "../../lib/importacion";
import { usePermisos } from "../../hooks/usePermisos";
import { CargaDetailPage } from "../../pages/CargaDetailPage";
import { NuevaPlantillaForm } from "./FormatoColumnas";
import { ReglasImportacion } from "./ReglasImportacion";
import type { CargaExcel, DestinoImportacion, DeteccionExcel, PlantillaMapeo } from "../../types";

const ETAPAS = [
  { titulo: "Archivo", detalle: "Elige tu inventario" },
  { titulo: "Columnas", detalle: "Comprueba los datos" },
  { titulo: "Revisión", detalle: "Resuelve los pendientes" },
  { titulo: "Confirmación", detalle: "Aprueba la importación" },
];

/** Una sola sesión de trabajo: detectar y validar no aplican cambios al catálogo (RN-08). */
export function ImportacionModal({ alCerrar, cargaInicialId }: { alCerrar: () => void; cargaInicialId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const secuencia = useRef(0);
  const cache = useQueryClient();
  const { puede } = usePermisos();
  const [etapa, setEtapa] = useState(cargaInicialId ? 3 : 1);
  const [cargaId, setCargaId] = useState(cargaInicialId);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hoja, setHoja] = useState("");
  const [plantillaId, setPlantillaId] = useState("");
  const [deteccion, setDeteccion] = useState<DeteccionExcel | null>(null);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [detalleOcupado, setDetalleOcupado] = useState(false);
  const plantillas = useQuery({ queryKey: ["plantillas-mapeo"], enabled: puede("importacion.ver"),
    queryFn: async () => (await datosApi.get<PlantillaMapeo[]>("/importacion/plantillas")).data });
  const destinos = useQuery({ queryKey: ["importacion-destinos"], enabled: puede("importacion.ver"),
    queryFn: async () => (await datosApi.get<DestinoImportacion[]>("/importacion/destinos")).data });
  const cargas = useQuery({ queryKey: ["cargas"], enabled: puede("importacion.ver") && etapa === 1,
    queryFn: async () => (await datosApi.get<CargaExcel[]>("/importacion/cargas")).data });
  const detectar = useMutation({
    mutationFn: ({ file, sheet }: { file: File; sheet?: string; numero: number }) => detectarExcel(file, sheet),
    onSuccess: (data, variables) => {
      if (variables.numero !== secuencia.current) return;
      setDeteccion(data); setHoja(data.hoja); setError("");
    },
    onError: (e, variables) => { if (variables.numero === secuencia.current) setError(extraerMensajeError(e)); },
  });
  const subir = useMutation({
    mutationFn: () => subirExcel(archivo!, hoja, plantillaId || null),
    onSuccess: (carga) => {
      cache.setQueryData(["carga", carga.id], carga);
      void cache.invalidateQueries({ queryKey: ["cargas"] });
      setCargaId(carga.id); setEtapa(3); setError("");
    },
    onError: (e) => setError(extraerMensajeError(e)),
  });
  const ocupado = subir.isPending || detalleOcupado;
  const cerrar = useCallback(() => { if (!ocupado) alCerrar(); }, [ocupado, alCerrar]);
  useEffect(() => {
    const elemento = dialog.current!;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    elemento.showModal(); document.body.style.overflow = "hidden";
    return () => { elemento.close(); document.body.style.overflow = overflow; anterior?.focus(); };
  }, []);
  useEffect(() => { titulo.current?.focus(); }, [etapa, cargaId]);

  function seleccionarArchivo(file: File | null) {
    const numero = ++secuencia.current;
    setArchivo(file); setDeteccion(null); setHoja(""); setError("");
    if (!file) return;
    const invalido = validarArchivoExcel(file);
    if (invalido) { setError(invalido); return; }
    detectar.mutate({ file, numero });
  }
  function soltar(e: DragEvent) { e.preventDefault(); setArrastrando(false); if (!ocupado) seleccionarArchivo(e.dataTransfer.files[0] ?? null); }
  function retomar(id: string) { setCargaId(id); setEtapa(3); }
  const formato = plantillas.data?.find((p) => p.id === plantillaId);
  const filas = deteccion?.columnas[0]?.total ?? 0;
  const tamanoArchivo = archivo ? archivo.size >= 1024 * 1024 ? `${(archivo.size / 1024 / 1024).toLocaleString("es-PE", { maximumFractionDigits: 2 })} MB` : `${Math.max(1, Math.ceil(archivo.size / 1024))} KB` : "";
  const listaEtapa = !!archivo && !!deteccion && hoja === deteccion.hoja && !detectar.isPending;

  return <dialog ref={dialog} className="importacion-dialog" aria-labelledby="importacion-titulo" aria-describedby="importacion-proposito"
    onCancel={(e) => { if (e.target !== e.currentTarget) return; e.preventDefault(); cerrar(); }}>
    <div className="importacion-shell">
      <header className="importacion-cabecera">
        <span className="importacion-emblema"><FileSpreadsheet size={25} aria-hidden="true" /></span>
        <div><p className="importacion-ceja">INVENTARIO · CARGA MASIVA</p><h2 id="importacion-titulo" ref={titulo} tabIndex={-1}>Importar piezas</h2>
          <p id="importacion-proposito">Del Excel a tu colección, con una revisión en cada paso.</p></div>
        <button type="button" className="importacion-cerrar" aria-label="Cerrar importación" disabled={ocupado} onClick={cerrar}><X size={22} aria-hidden="true" /></button>
      </header>
      <nav className="importacion-progreso" aria-label="Etapas de la importación"><ol>
        {ETAPAS.map((paso, i) => {
          const numero = i + 1;
          const anterior = numero < etapa;
          // Un lote validado se conserva; sus pasos de archivo y columnas no se editan retroactivamente.
          const disponible = !ocupado && (numero === etapa || (!cargaId && numero < etapa) || (!!cargaId && numero === 3 && etapa === 4));
          return <li key={paso.titulo} className={numero === etapa ? "actual" : anterior ? "completada" : ""}>
            <button type="button" disabled={!disponible} aria-current={numero === etapa ? "step" : undefined} onClick={() => setEtapa(numero)}>
              <span className="importacion-numero">{anterior ? <Check size={17} aria-hidden="true" /> : numero}</span>
              <span><strong>{paso.titulo}</strong><small>{paso.detalle}</small></span>
            </button>
          </li>;
        })}
      </ol></nav>
      <div className="importacion-espacio">
        {etapa < 3 ? <>
          <div className="importacion-scroll">
            <div className="importacion-intro"><span>Paso {etapa} de 4</span><h3>{etapa === 1 ? "Empecemos por tu archivo" : "Comprueba cómo se leerá tu Excel"}</h3>
              <p>{etapa === 1 ? "Selecciona una hoja de cálculo. Podrás revisar y corregir las piezas antes de incorporarlas." : "Elige la hoja y el formato de columnas. La vista previa muestra sugerencias; la validación confirmará la conversión de cada fila."}</p></div>
            {error && <div className="importacion-error" role="alert"><strong>No se pudo continuar</strong><p>{error}</p>{archivo && !validarArchivoExcel(archivo) && !deteccion && <button type="button" className="underline" disabled={detectar.isPending} onClick={() => seleccionarArchivo(archivo)}>Volver a leer el archivo</button>}</div>}
            {etapa === 1 && <>
              {puede("importacion.cargar") ? <>
                <div className={`importacion-archivo ${arrastrando ? "arrastrando" : ""}`} onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={soltar}>
                  <UploadCloud size={36} strokeWidth={1.5} aria-hidden="true" />
                  <h4>{archivo ? "Tu archivo está seleccionado" : "Arrastra tu inventario aquí"}</h4>
                  <p>Excel .xlsx · Hasta 25 MB · Sin contraseña</p>
                  <input ref={input} id="importacion-archivo" type="file" accept=".xlsx" tabIndex={-1} className="sr-only" aria-label="Archivo Excel" onChange={(e) => { seleccionarArchivo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                  <button type="button" className="btn-primary" onClick={() => input.current?.click()}>{archivo ? "Cambiar archivo" : "Elegir archivo"}</button>
                </div>
                {archivo && <div className="importacion-archivo-elegido"><FileSpreadsheet size={25} aria-hidden="true" /><div><strong>{archivo.name}</strong><span>{tamanoArchivo}{deteccion && ` · ${deteccion.hojas.length} ${deteccion.hojas.length === 1 ? "hoja disponible" : "hojas disponibles"}`}</span></div>{deteccion && !detectar.isPending && <CheckCircle2 size={22} aria-label="Archivo leído" />}</div>}
                <p className="importacion-nota"><ShieldCheck size={19} aria-hidden="true" />Tu catálogo se actualizará únicamente cuando confirmes la aprobación.</p>
              </> : <p className="importacion-nota">Tu rol permite consultar cargas anteriores. Para iniciar una nueva necesitas permiso de carga.</p>}
              {puede("importacion.ver") && <details className="importacion-historial"><summary><History size={18} aria-hidden="true" />Retomar una carga anterior{cargas.data && <span>{cargas.data.length}</span>}</summary>
                {cargas.isPending && <p role="status">Cargando historial…</p>}
                {cargas.isError && <p role="alert">{extraerMensajeError(cargas.error)} <button type="button" className="underline" onClick={() => { void cargas.refetch(); }}>Reintentar</button></p>}
                {cargas.data?.length === 0 && <p>Aún no tienes cargas para retomar.</p>}
                <ul>{cargas.data?.map((c) => <li key={c.id}><div><strong>{c.archivoNombre}</strong><span>{c.hojaNombre} · {c.totalFilas} filas · {ESTADOS_CARGA[c.estado]}</span></div><button type="button" className="btn-glass" onClick={() => retomar(c.id)}>{c.estado === "en_revision" || c.estado === "pendiente_aprobacion" ? "Retomar" : "Ver resultado"}</button></li>)}</ul>
              </details>}
            </>}
            {etapa === 2 && deteccion && <>
              <div className="importacion-configuracion">
                <label htmlFor="importacion-hoja">Hoja del archivo<select id="importacion-hoja" className="glass-input" value={hoja} disabled={detectar.isPending || subir.isPending} onChange={(e) => {
                  setHoja(e.target.value); setError(""); detectar.mutate({ file: archivo!, sheet: e.target.value, numero: ++secuencia.current });
                }}>{deteccion.hojas.map((h) => <option key={h}>{h}</option>)}</select><small>Se importa una hoja por carga.</small></label>
                <label htmlFor="importacion-formato">Formato de columnas<select id="importacion-formato" className="glass-input" value={plantillaId} disabled={plantillas.isPending || subir.isPending} onChange={(e) => setPlantillaId(e.target.value)}>
                  <option value="">Reconocer encabezados automáticamente</option>{plantillas.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select><small>Usa un formato guardado si tu inventario tiene otros encabezados.</small></label>
              </div>
              <div className="importacion-muestra">
                <div><h4>Vista previa de las columnas</h4><p role="status">Hoja {hoja}: {filas.toLocaleString("es-PE")} filas y {deteccion.columnas.length} columnas.</p></div>
                <div className="overflow-x-auto"><table className="tabla-apilable"><thead><tr><th>Columna del Excel</th><th>Dato de la ficha sugerido</th><th>Muestra de tus datos</th></tr></thead><tbody>{deteccion.columnas.map((c) => {
                  const destino = formato?.mapeoColumnas[c.columna] ?? c.destinoSugerido ?? destinos.data?.find((d) => d.clave === c.columna)?.clave;
                  return <tr key={c.columna}><th scope="row" data-label="Columna del Excel">{c.columna}</th><td data-label="Dato sugerido">{destinos.data?.find((d) => d.clave === destino)?.etiqueta ?? destino ?? <span className="text-gris-2">Sin asociación sugerida</span>}</td><td data-label="Muestra">{c.muestra.slice(0, 2).map(valorLegible).join(" · ")}</td></tr>;
                })}</tbody></table></div>
              </div>
              <p className="importacion-nota"><ShieldCheck size={19} aria-hidden="true" />Al continuar validaremos las filas y buscaremos coincidencias con el catálogo.</p>
              {puede("importacion.configurar") && <details className="importacion-avanzado"><summary>¿Tus columnas necesitan otro formato?</summary><NuevaPlantillaForm columnas={deteccion.columnas.map((c) => c.columna)} onCreada={(p) => {
                cache.setQueryData<PlantillaMapeo[]>(["plantillas-mapeo"], (anteriores = []) => [...anteriores.filter((a) => a.id !== p.id), p]); setPlantillaId(p.id);
              }} /></details>}
              {puede("importacion.ver") && <ReglasImportacion prefijoId="modal-" />}
            </>}
            {plantillas.isError && <p role="alert">{extraerMensajeError(plantillas.error)} <button type="button" className="underline" onClick={() => { void plantillas.refetch(); }}>Reintentar formatos</button></p>}
            {detectar.isPending && <p className="importacion-estado" role="status"><LoaderCircle className="animate-spin" size={19} aria-hidden="true" />Leyendo las hojas y columnas del archivo…</p>}
          </div>
          <footer className="importacion-pie">
            <div>{subir.isPending ? <p role="status"><LoaderCircle className="animate-spin" size={18} aria-hidden="true" />Validando filas y buscando coincidencias. Puede tardar unos minutos.</p> : <p>{etapa === 1 ? "Una carga a la vez, sin perder el control." : "Todavía no se crean ni modifican piezas."}</p>}</div>
            <div><button type="button" className="btn-glass" disabled={subir.isPending} onClick={etapa === 1 ? cerrar : () => setEtapa(1)}>{etapa === 1 ? "Cerrar" : "Atrás"}</button>
              {puede("importacion.cargar") && <button type="button" className="btn-primary" disabled={!listaEtapa || subir.isPending} onClick={() => { if (etapa === 1) setEtapa(2); else { setError(""); subir.mutate(); } }}>{subir.isPending ? "Validando inventario…" : etapa === 1 ? "Continuar a columnas" : "Validar y continuar"}</button>}</div>
          </footer>
        </> : cargaId && <CargaDetailPage key={cargaId} idCarga={cargaId} asistente={{ etapa: etapa as 3 | 4, onEtapa: setEtapa, onCambiarCarga: retomar, onOcupado: setDetalleOcupado, alCerrar: cerrar }} />}
      </div>
    </div>
  </dialog>;
}
