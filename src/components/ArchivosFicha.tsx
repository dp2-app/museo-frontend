import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../lib/cloudinary";
import { cambiosMetadatosFoto } from "../lib/metadatosFoto";
import { usePermisos } from "../hooks/usePermisos";
import type { ValorLista } from "../types";
import { Aviso, ConMotivo, ErrorConsulta, Panel } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";

interface Archivo { id: string; url: string; titulo?: string; descripcion?: string; fechaDocumento?: string; restringidoUso: boolean; esPrincipal?: boolean; tipoVistaId?: string; fotografoId?: string; fechaFotografia?: string; orden?: number; }
interface Persona { id: string; nombreCompleto: string; activo: boolean; }
export function ArchivosFicha({ piezaId, documentos = false }: { piezaId: string; documentos?: boolean }) {
  const { puede } = usePermisos(); const ruta = `/piezas/${piezaId}/${documentos ? "documentos" : "fotografias"}`;
  const gestionar = puede(documentos ? "documentos.gestionar" : "fotos.gestionar");
  const archivos = useRecurso<Archivo[]>("archivos", ruta);
  const tipos = useRecurso<ValorLista[]>("tipo-archivo", `/listas/${documentos ? "tipo_documento" : "tipo_vista_foto"}/valores`, gestionar);
  const personas = useRecurso<Persona[]>("personas", "/personas", gestionar && !documentos);
  const [arrastrada, setArrastrada] = useState(""); const [archivo, setArchivo] = useState<File | null>(null); const op = useOperacion();
  function mover(desde: number, hacia: number) {
    const ids = archivos.data?.map((f) => f.id) ?? []; if (hacia < 0 || hacia >= ids.length || desde === hacia) return;
    const [id] = ids.splice(desde, 1); ids.splice(hacia, 0, id); op.ejecutar(() => api.put(`${ruta}/orden`, { ids }));
  }
  async function agregar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const datos = new FormData(form); const texto = (k: string) => String(datos.get(k) || "").trim() || null;
    op.ejecutar(async () => {
      let url = texto("url"); let formato: string | undefined; let tamanoBytes: number | undefined;
      if (archivo && !documentos) {
        if (!["image/jpeg", "image/png"].includes(archivo.type) || archivo.size > 15 * 1024 * 1024) throw new Error("Usa una imagen JPG o PNG de hasta 15 MB.");
        url = await subirImagenACloudinary(archivo); formato = archivo.type === "image/png" ? "png" : "jpg"; tamanoBytes = archivo.size;
      }
      await api.post(ruta, { url, formato, tamanoBytes, restringidoUso: datos.has("restringido"), ...(documentos ? { titulo: texto("titulo"), descripcion: texto("descripcion"), tipoDocumentoId: texto("tipo"), fechaDocumento: texto("fecha") } : { tipoVistaId: texto("tipo"), fotografoId: texto("persona"), fechaFotografia: texto("fecha") }) });
      form.reset(); setArchivo(null);
    });
  }
  return <Panel titulo={documentos ? "Documentos asociados" : "Fotografías"}><ErrorConsulta error={archivos.error || tipos.error || personas.error} /><Aviso mensaje={op.mensaje} />
    {!gestionar && <button className="btn-primary" disabled title="Tu rol solo puede consultar los archivos">{documentos ? "Asociar documento" : "Añadir fotografía"}</button>}
    {archivos.isPending && <p>Cargando archivos…</p>}{archivos.data?.length === 0 && <p>No hay {documentos ? "documentos" : "fotografías"} registrados.</p>}
    <div className="grid gap-4 sm:grid-cols-2">{archivos.data?.map((a, i) => <article key={a.id} className="rounded-card border border-linea p-3 space-y-2 min-w-0" draggable={!documentos && gestionar && !op.pendiente} onDragStart={() => setArrastrada(a.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!documentos && gestionar && arrastrada) mover(archivos.data!.findIndex((x) => x.id === arrastrada), i); setArrastrada(""); }}>
      {!documentos && <img className="h-48 w-full object-contain rounded-btn" src={a.url} alt={`Fotografía ${i + 1}${a.esPrincipal ? ", principal" : ""}`} />}
      <a className="text-azul underline break-all" href={a.url} target="_blank" rel="noreferrer">{a.titulo || (documentos ? "Abrir documento" : "Abrir fotografía")}</a>{a.descripcion && <p>{a.descripcion}</p>}
      {(a.fechaDocumento || a.fechaFotografia) && <p>{a.fechaDocumento || a.fechaFotografia}</p>}{a.restringidoUso && <p>Uso restringido</p>}
      {a.esPrincipal && <p className="font-semibold">Fotografía principal</p>}
      {gestionar && !documentos && <><div className="flex flex-wrap gap-2"><button className="btn-glass" disabled={op.pendiente || a.esPrincipal} onClick={() => op.ejecutar(() => api.patch(`${ruta}/${a.id}`, { esPrincipal: true }))}>Hacer principal</button><button className="btn-glass" aria-label={`Subir fotografía ${i + 1}`} disabled={op.pendiente || i === 0} onClick={() => mover(i, i - 1)}>↑</button><button className="btn-glass" aria-label={`Bajar fotografía ${i + 1}`} disabled={op.pendiente || i === (archivos.data?.length ?? 0) - 1} onClick={() => mover(i, i + 1)}>↓</button></div>
        <details><summary>Editar datos de fotografía</summary><form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); op.ejecutar(() => api.patch(`${ruta}/${a.id}`, cambiosMetadatosFoto(a, { tipoVistaId: String(d.get("tipo") || "") || null, fotografoId: String(d.get("persona") || "") || null, fechaFotografia: String(d.get("fecha") || "") || null, restringidoUso: d.has("restringido") }))); }}>
          <label>Tipo de vista<select aria-label="Tipo de vista" name="tipo" className="glass-input" defaultValue={a.tipoVistaId ?? ""}><option value="">Sin especificar</option>{a.tipoVistaId && <option value={a.tipoVistaId}>{tipos.data?.find((t) => t.id === a.tipoVistaId)?.etiqueta ?? "Tipo de vista actual (conservado)"}</option>}{tipos.data?.filter((t) => t.id !== a.tipoVistaId).map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}</select></label><label>Fotógrafo<select aria-label="Fotógrafo" name="persona" className="glass-input" defaultValue={a.fotografoId ?? ""}><option value="">Sin especificar</option>{a.fotografoId && <option value={a.fotografoId}>{personas.data?.find((p) => p.id === a.fotografoId)?.nombreCompleto ?? "Fotógrafo actual (conservado)"}</option>}{personas.data?.filter((p) => p.id !== a.fotografoId).map((p) => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}</select></label><label>Fecha de fotografía<input type="date" name="fecha" className="glass-input" defaultValue={a.fechaFotografia ?? ""} /></label><label><input type="checkbox" name="restringido" defaultChecked={a.restringidoUso} />Uso restringido</label><button className="btn-glass" disabled={op.pendiente}>Guardar datos de fotografía</button>
        </form></details></>}
      {gestionar && <ConMotivo etiqueta={documentos ? "Retirar documento" : "Retirar fotografía"} pendiente={op.pendiente} ejecutar={(motivo) => op.ejecutar(() => api.post(`${ruta}/${a.id}/baja`, { motivo }))} />}
    </article>)}</div>
    {gestionar && <form onSubmit={(e) => { void agregar(e); }} className="grid gap-3 sm:grid-cols-2 border-t border-linea pt-4">
      <p className="sm:col-span-2">{documentos ? "Registra el enlace de un PDF, JPG o PNG del almacén autorizado (hasta 25 MB)." : "Registra una imagen JPG o PNG del almacén autorizado (hasta 15 MB). Arrastra las fotos o usa las flechas para ordenarlas."}</p>
      {!documentos && cloudinaryConfigurado() && <label>Archivo de fotografía<input type="file" accept="image/jpeg,image/png" className="glass-input" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} /></label>}
      <label>URL del {documentos ? "documento" : "archivo"}<input type="url" name="url" required={!archivo} disabled={!!archivo} className="glass-input" /></label>
      <label>{documentos ? "Tipo de documento" : "Tipo de vista"}<select aria-label={documentos ? "Tipo de documento" : "Tipo de vista"} name="tipo" className="glass-input"><option value="">Sin especificar</option>{tipos.data?.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}</select></label>
      {!documentos && <label>Fotógrafo<select aria-label="Fotógrafo" name="persona" className="glass-input"><option value="">Sin especificar</option>{personas.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}</select></label>}
      <label>{documentos ? "Fecha del documento" : "Fecha de fotografía"}<input type="date" name="fecha" className="glass-input" /></label>
      {documentos && <><label>Título del documento<input name="titulo" className="glass-input" /></label><label>Descripción del documento<textarea name="descripcion" className="glass-input" /></label></>}
      <label><input type="checkbox" name="restringido" />Uso restringido</label><button className="btn-primary" disabled={op.pendiente}>{op.pendiente ? "Guardando archivo…" : documentos ? "Asociar documento" : "Añadir fotografía"}</button>
    </form>}
  </Panel>;
}
