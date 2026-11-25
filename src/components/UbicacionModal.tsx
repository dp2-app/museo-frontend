import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, LoaderCircle, MapPin } from "lucide-react";
import { api, extraerMensajeError } from "../lib/api";
import { normalizarUbicacion, validarUbicacion, type DatosUbicacion } from "../lib/ubicaciones";
import { useRecurso } from "../lib/recursosFicha";
import type { Ubicacion } from "../lib/ficha";
import { DialogoMuseo } from "./DialogoMuseo";

export function UbicacionModal({ ubicacion, alCerrar, alGuardar }: { ubicacion?: Ubicacion; alCerrar: () => void; alGuardar?: () => void }) {
  const cache = useQueryClient();
  const formulario = useRef<HTMLFormElement>(null);
  const lista = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", true, { incluirInactivas: true });
  const [datos, setDatos] = useState<DatosUbicacion>({ nivelTipo: ubicacion?.nivelTipo ?? "ubicacion", parentId: ubicacion?.parentId ?? null, nombre: ubicacion?.nombre ?? "", codigo: ubicacion?.codigo ?? "", direccion: ubicacion?.direccion ?? "" });
  const [errores, setErrores] = useState<Partial<Record<keyof DatosUbicacion, string>>>({});
  const [error, setError] = useState("");
  const sedes = (lista.data ?? []).filter((n) => n.activo || n.id === datos.parentId);
  const guardar = useMutation({
    mutationFn: async () => {
      const normalizados = normalizarUbicacion(datos);
      if (ubicacion) return api.patch(`/ubicaciones/${ubicacion.id}`, { nombre: normalizados.nombre, codigo: normalizados.codigo, direccion: normalizados.direccion });
      return api.post("/ubicaciones", normalizados);
    },
    onSuccess: async () => { await cache.invalidateQueries(); alGuardar?.(); alCerrar(); },
    onError: (e) => setError(extraerMensajeError(e)),
  });
  function cambiar<K extends keyof DatosUbicacion>(campo: K, valor: DatosUbicacion[K]) {
    setDatos((v) => ({ ...v, [campo]: valor })); setErrores((v) => ({ ...v, [campo]: undefined })); setError("");
  }
  function enviar(e: FormEvent) {
    e.preventDefault(); const encontrados = validarUbicacion(datos); setErrores(encontrados); setError("");
    if (Object.keys(encontrados).length) { requestAnimationFrame(() => formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    guardar.mutate();
  }
  return <DialogoMuseo titulo={ubicacion ? "Editar ubicación" : "Crear ubicación"} ceja="ORGANIZACIÓN DEL MUSEO" descripcion="Define dónde se conservarán las piezas." icono={MapPin} bloqueado={guardar.isPending} alCerrar={alCerrar} clase="ubicacion-dialog">
    <div className="importacion-scroll"><div className="importacion-intro"><h3>Un lugar fácil de identificar</h3><p>Todos los datos son obligatorios. En el nombre puedes precisar el depósito, rack, caja o estante.</p></div>
      {error && <p role="alert" className="importacion-error">{error}</p>}
      {Object.values(errores).some(Boolean) && <p role="alert" className="text-rojo mb-4">Completa los datos señalados para guardar la ubicación.</p>}
      <form ref={formulario} id="ubicacion-guardar" aria-label={ubicacion ? "Editar ubicación" : "Nueva sede o ubicación"} onSubmit={enviar} noValidate className="ubicacion-formulario">
        <fieldset disabled={guardar.isPending} className="grid gap-5 sm:grid-cols-2">
          <label>Nivel <span aria-hidden="true">*</span><select className="glass-input" required disabled={!!ubicacion} aria-label="Nivel" value={datos.nivelTipo} onChange={(e) => cambiar("nivelTipo", e.target.value as DatosUbicacion["nivelTipo"])}><option value="ubicacion">Ubicación dentro de una sede</option><option value="sede">Sede</option></select></label>
          {datos.nivelTipo === "ubicacion" && <label>Sede <span aria-hidden="true">*</span><select className="glass-input" required disabled={!!ubicacion || lista.isPending} aria-label="Sede" aria-invalid={!!errores.parentId} aria-describedby="ubicacion-sede-error" value={datos.parentId ?? ""} onChange={(e) => {
            const anterior = lista.data?.find((s) => s.id === datos.parentId)?.direccion;
            const siguiente = lista.data?.find((s) => s.id === e.target.value);
            setDatos((v) => ({ ...v, parentId: e.target.value || null, direccion: !v.direccion || v.direccion === anterior ? siguiente?.direccion ?? "" : v.direccion })); setErrores((v) => ({ ...v, parentId: undefined }));
          }}><option value="">Selecciona una sede</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}{!s.activo && " (inactiva)"}</option>)}</select>{errores.parentId && <span id="ubicacion-sede-error" className="error-campo">{errores.parentId}</span>}</label>}
          <label>Nombre de ubicación <span aria-hidden="true">*</span><input className="glass-input" required aria-label="Nombre de ubicación" aria-invalid={!!errores.nombre} aria-describedby="ubicacion-nombre-error" value={datos.nombre} placeholder={datos.nivelTipo === "sede" ? "Ej. Sede histórica del museo" : "Ej. Depósito 2 · Rack 3"} onChange={(e) => cambiar("nombre", e.target.value)} />{errores.nombre && <span id="ubicacion-nombre-error" className="error-campo">{errores.nombre}</span>}</label>
          <label>Código de ubicación <span aria-hidden="true">*</span><input className="glass-input" required aria-label="Código de ubicación" aria-invalid={!!errores.codigo} aria-describedby="ubicacion-codigo-error" value={datos.codigo} placeholder="Ej. DEP-02-R03" onChange={(e) => cambiar("codigo", e.target.value)} />{errores.codigo && <span id="ubicacion-codigo-error" className="error-campo">{errores.codigo}</span>}</label>
          <label className="sm:col-span-2">Dirección <span aria-hidden="true">*</span><textarea className="glass-input" required rows={2} aria-label="Dirección" aria-invalid={!!errores.direccion} aria-describedby="ubicacion-direccion-error" value={datos.direccion} placeholder="Dirección del inmueble y referencia del lugar" onChange={(e) => cambiar("direccion", e.target.value)} />{errores.direccion && <span id="ubicacion-direccion-error" className="error-campo">{errores.direccion}</span>}</label>
        </fieldset>
      </form>
      {lista.isError && <p role="alert" className="importacion-error">{extraerMensajeError(lista.error)} <button className="underline" onClick={() => { void lista.refetch(); }}>Reintentar</button></p>}
      {!lista.isPending && !sedes.length && datos.nivelTipo === "ubicacion" && <p className="importacion-nota"><Building2 size={20} aria-hidden="true" />Aún no hay sedes activas. Elige «Sede» en el nivel para crear la primera.</p>}
    </div>
    <footer className="importacion-pie"><div><p role="status">{guardar.isPending ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Guardando ubicación…</> : "La ubicación aparecerá en el catálogo al guardar."}</p></div><div><button className="btn-glass" disabled={guardar.isPending} onClick={alCerrar}>Cancelar</button><button type="submit" form="ubicacion-guardar" className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? "Guardando…" : ubicacion ? "Guardar ubicación" : "Crear ubicación"}</button></div></footer>
  </DialogoMuseo>;
}
