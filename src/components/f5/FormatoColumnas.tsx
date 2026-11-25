import { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { datosApi, extraerMensajeError } from "../../lib/api";
import type { DestinoImportacion, PlantillaMapeo } from "../../types";

export function NuevaPlantillaForm({ onCreada, columnas }: { onCreada: (plantilla: PlantillaMapeo) => void; columnas: string[] }) {
  const idColumnas = useId();
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
    onSuccess: (data) => { setAbierto(false); setNombre(""); setFuente(""); setFilas([{ origen: "", destino: "" }]); setError(""); onCreada(data); },
    onError: (e) => setError("isAxiosError" in e ? extraerMensajeError(e) : e.message),
  });
  if (!abierto) return <button className="btn-glass" onClick={() => setAbierto(true)}>Configurar un formato de columnas</button>;
  return <form className="glass-panel p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); setError(""); crear.mutate(); }}>
    <h2 className="section-title">Nuevo formato de columnas</h2>
    <p className="text-sm">Asocia el nombre habitual de cada columna con un dato de la ficha. Esta configuración se reutiliza en las siguientes cargas.</p>
    <div className="grid gap-3 sm:grid-cols-2"><label>Nombre del formato<input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="glass-input w-full" /></label>
      <label>Inventario de origen<input required value={fuente} onChange={(e) => setFuente(e.target.value)} className="glass-input w-full" /></label></div>
    {filas.map((fila, i) => <div key={i} className="flex flex-wrap gap-2 items-end">
      <label className="flex-1 min-w-48">Columna del Excel<input aria-label={`Columna de origen ${i + 1}`} list={idColumnas} value={fila.origen} onChange={(e) => setFilas((prev) => prev.map((f, n) => n === i ? { ...f, origen: e.target.value } : f))} className="glass-input w-full" /></label>
      <label className="flex-1 min-w-48">Dato de la ficha<select aria-label={`Dato de destino ${i + 1}`} value={fila.destino} onChange={(e) => setFilas((prev) => prev.map((f, n) => n === i ? { ...f, destino: e.target.value } : f))} className="glass-input w-full">
        <option value="">Elegir dato</option>{destinos.data?.map((d) => <option key={d.clave} value={d.clave}>{d.etiqueta}</option>)}
      </select></label><button type="button" className="btn-glass" onClick={() => setFilas((prev) => prev.filter((_, n) => n !== i))}>Quitar</button>
    </div>)}
    <datalist id={idColumnas}>{columnas.map((c) => <option key={c} value={c} />)}</datalist>
    <button type="button" className="btn-glass" onClick={() => setFilas((prev) => [...prev, { origen: "", destino: "" }])}>Añadir columna</button>
    {destinos.isError && <p role="alert">{extraerMensajeError(destinos.error)}</p>}{error && <p role="alert">{error}</p>}
    <div className="flex gap-3"><button className="btn-primary" disabled={crear.isPending || !destinos.data}>Guardar formato</button>
      <button type="button" className="btn-glass" onClick={() => setAbierto(false)}>Cancelar</button></div>
  </form>;
}
