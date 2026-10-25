import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, GripVertical, Star } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { usePersonas, useValoresLista } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../../lib/cloudinary";
import { extension, FORMATOS_FOTO, validarArchivo } from "../../lib/f2";
import type { FotoV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { FormMotivo } from "./FichaComun";

const MAX_FOTO_MB = 15; // ARCHIVO_MAX_FOTO_MB del backend
const fechaCorta = (f: string) => new Date(`${f}T00:00:00`).toLocaleDateString("es-PE");

/** RF-10 / R4: galería de la pieza. La primera foto queda como principal; se reordena arrastrando (o con las
 * flechas, para teclado), se elige otra principal, se indica el tipo de vista, fotógrafo y fecha, y se retira con
 * motivo. El binario vive en el almacén; la base solo guarda la referencia (RNF-12). */
export function Fotografias({ piezaId, fotos, alCambiar }: { piezaId: string; fotos: FotoV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const gestionar = puede("fotos.gestionar");
  const vistas = useValoresLista("tipo_vista_foto");
  const personas = usePersonas();
  const ordenadas = [...fotos].sort((a, b) => a.orden - b.orden);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [arrastrada, setArrastrada] = useState<string | null>(null); // solo para el estilo
  const arrastre = useRef<string | null>(null); // el id real: el estado puede no haberse actualizado al soltar
  const [retirando, setRetirando] = useState(false);
  const [url, setUrl] = useState("");
  const [toma, setToma] = useState({ fotografoId: "", fechaFotografia: "" });
  const [avisos, setAvisos] = useState<string[]>([]);
  const archivo = useRef<HTMLInputElement>(null);
  const activa = ordenadas.find((f) => f.id === activaId) ?? ordenadas.find((f) => f.esPrincipal) ?? ordenadas[0];
  const indice = activa ? ordenadas.indexOf(activa) : -1;
  const nombrePersona = (id?: string | null) => personas.data?.find((p) => p.id === id)?.nombreCompleto;

  const agregar = useMutation({
    mutationFn: async (entradas: (File | string)[]) => {
      let ultima: FotoV3 | null = null;
      for (const entrada of entradas) { // una a una: el orden de subida es el orden de la galería
        const esArchivo = typeof entrada !== "string";
        const destino = esArchivo ? await subirImagenACloudinary(entrada) : entrada;
        ultima = (await api.post<FotoV3>(`/piezas/${piezaId}/fotografias`, {
          url: destino, fotografoId: toma.fotografoId || null, fechaFotografia: toma.fechaFotografia || null,
          ...(esArchivo ? { formato: extension(entrada.name), tamanoBytes: entrada.size } : {}),
        })).data;
      }
      return ultima;
    },
    onSuccess: (foto) => { setUrl(""); if (archivo.current) archivo.current.value = ""; if (foto) setActivaId(foto.id); alCambiar(); },
  });
  const editar = useMutation({
    mutationFn: async (cambio: { tipoVistaId?: string | null; esPrincipal?: boolean; restringidoUso?: boolean }) =>
      api.patch(`/piezas/${piezaId}/fotografias/${activa!.id}`, cambio),
    onSuccess: alCambiar,
  });
  const ordenar = useMutation({
    mutationFn: async (ids: string[]) => api.put(`/piezas/${piezaId}/fotografias/orden`, { ids }),
    onSuccess: alCambiar,
  });
  const retirar = useMutation({
    mutationFn: async (motivo: string) => api.post(`/piezas/${piezaId}/fotografias/${activa!.id}/baja`, { motivo }),
    onSuccess: () => { setRetirando(false); setActivaId(null); alCambiar(); },
  });

  function mover(delta: number) {
    const ids = ordenadas.map((f) => f.id);
    [ids[indice], ids[indice + delta]] = [ids[indice + delta], ids[indice]];
    ordenar.mutate(ids);
  }

  function soltar(destinoId: string) {
    const origen = arrastre.current;
    arrastre.current = null;
    setArrastrada(null);
    if (!origen || origen === destinoId) return;
    const ids = ordenadas.map((f) => f.id).filter((id) => id !== origen);
    ids.splice(ids.indexOf(destinoId), 0, origen);
    ordenar.mutate(ids);
  }

  function elegirArchivos(lista: FileList | null) {
    const archivos = [...(lista ?? [])];
    const errores = archivos.map((f) => validarArchivo(f, FORMATOS_FOTO, MAX_FOTO_MB)).filter((e): e is string => Boolean(e));
    setAvisos(errores);
    const validos = archivos.filter((f) => !validarArchivo(f, FORMATOS_FOTO, MAX_FOTO_MB));
    if (validos.length) agregar.mutate(validos);
  }

  return (
    <div className="glass-panel p-4 space-y-3 lg:sticky lg:top-20" aria-label="Fotografías">
      {activa ? (
        <figure className="space-y-2">
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-linea bg-fondo-suave">
            <img src={activa.url} alt={`Fotografía ${indice + 1} de ${ordenadas.length}`} className="w-full h-full object-contain" />
            {activa.esPrincipal && <span className="chip absolute top-2 left-2"><Star size={14} aria-hidden="true" /> Principal</span>}
            {activa.restringidoUso && <span className="chip absolute top-2 right-2">Uso restringido</span>}
          </div>
          <figcaption className="text-xs text-gris-2">
            {[vistas.data?.find((v) => v.id === activa.tipoVistaId)?.etiqueta ?? "Vista sin indicar",
              nombrePersona(activa.fotografoId) && `Foto: ${nombrePersona(activa.fotografoId)}`,
              activa.fechaFotografia && fechaCorta(activa.fechaFotografia),
              `${indice + 1} de ${ordenadas.length}`].filter(Boolean).join(" · ")}
          </figcaption>
        </figure>
      ) : (
        <div className="aspect-square rounded-2xl border border-dashed border-linea flex items-center justify-center text-sm text-gris-2">Sin fotografías registradas</div>
      )}

      {ordenadas.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Miniaturas">
          {ordenadas.map((f, i) => (
            <li key={f.id} draggable={gestionar} onDragStart={() => { arrastre.current = f.id; setArrastrada(f.id); }} onDragEnd={() => setArrastrada(null)}
              onDragOver={(e: DragEvent) => gestionar && e.preventDefault()} onDrop={() => soltar(f.id)}
              className={arrastrada === f.id ? "opacity-40" : undefined}>
              <button type="button" onClick={() => setActivaId(f.id)} aria-label={`Ver fotografía ${i + 1}`}
                aria-current={f.id === activa?.id} className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 ${f.id === activa?.id ? "border-azul" : "border-linea opacity-80"}`}>
                <img src={f.url} alt="" className="w-full h-full object-cover" />
                {gestionar && <GripVertical size={14} className="absolute bottom-0.5 right-0.5 text-white drop-shadow" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {gestionar && ordenadas.length > 1 && <p className="text-xs text-gris-2">Arrastra las miniaturas para cambiar el orden.</p>}

      {gestionar && activa && (
        <div className="space-y-2 border-t border-linea pt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass !min-h-0 !py-1 !px-2" disabled={indice <= 0 || ordenar.isPending} onClick={() => mover(-1)} aria-label="Mover antes"><ArrowLeft size={16} aria-hidden="true" /></button>
            <button type="button" className="btn-glass !min-h-0 !py-1 !px-2" disabled={indice >= ordenadas.length - 1 || ordenar.isPending} onClick={() => mover(1)} aria-label="Mover después"><ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" className="btn-glass !min-h-0 !py-1 !px-3 !text-sm" disabled={activa.esPrincipal || editar.isPending} onClick={() => editar.mutate({ esPrincipal: true })}>
              <Star size={16} aria-hidden="true" /> Usar como principal
            </button>
            <button type="button" className="btn-danger-text text-sm" onClick={() => setRetirando(true)}>Retirar</button>
          </div>
          <label className="form-label" htmlFor="foto-vista">Tipo de vista</label>
          <select id="foto-vista" className="glass-input" value={activa.tipoVistaId ?? ""} onChange={(e) => editar.mutate({ tipoVistaId: e.target.value || null })}>
            <option value="">Sin indicar</option>
            {vistas.data?.filter((v) => v.activo).map((v) => <option key={v.id} value={v.id}>{v.etiqueta}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activa.restringidoUso} disabled={editar.isPending}
              onChange={(e) => editar.mutate({ restringidoUso: e.target.checked })} />
            Uso restringido: no se difunde (RN-07)
          </label>
          {retirando && <FormMotivo etiqueta="Motivo para retirar la fotografía" boton="Retirar" pendiente={retirar.isPending}
            onConfirmar={(m) => retirar.mutate(m)} onCancelar={() => setRetirando(false)} />}
        </div>
      )}

      <ErrorOperacion error={agregar.error ?? editar.error ?? ordenar.error ?? retirar.error} />
      {avisos.map((a) => <p key={a} role="alert" className="text-sm">{a}</p>)}
      {gestionar && (
        <div className="space-y-2 border-t border-linea pt-3">
          <p className="form-label">Agregar fotografías</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" htmlFor="foto-fotografo">Fotógrafo</label>
              <select id="foto-fotografo" className="glass-input text-sm" value={toma.fotografoId} onChange={(e) => setToma({ ...toma, fotografoId: e.target.value })}>
                <option value="">Sin indicar</option>
                {personas.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs" htmlFor="foto-fecha">Fecha de la toma</label>
              <input id="foto-fecha" type="date" className="glass-input text-sm" value={toma.fechaFotografia} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setToma({ ...toma, fechaFotografia: e.target.value })} />
            </div>
          </div>
          {cloudinaryConfigurado() ? (
            <div>
              <label className="text-xs" htmlFor="foto-archivo">Archivos (JPG o PNG, hasta {MAX_FOTO_MB} MB cada uno)</label>
              <input id="foto-archivo" ref={archivo} type="file" accept=".jpg,.jpeg,.png" multiple className="text-sm"
                onChange={(e) => elegirArchivos(e.target.files)} />
              {agregar.isPending && <p role="status" className="text-xs">Subiendo…</p>}
            </div>
          ) : (
            <form className="space-y-1" onSubmit={(e: FormEvent) => { e.preventDefault(); agregar.mutate([url.trim()]); }}>
              <label className="text-xs" htmlFor="foto-url">URL ya subida (JPG o PNG)</label>
              <div className="flex gap-2">
                <input id="foto-url" type="url" required placeholder="https://…" className="glass-input text-sm" value={url} onChange={(e) => setUrl(e.target.value)} />
                <button className="btn-glass shrink-0" disabled={agregar.isPending}>Añadir</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
