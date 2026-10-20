import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { useValoresLista } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../../lib/cloudinary";
import type { FotoV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { FormMotivo } from "./FichaComun";

/** RF-10: galería de la pieza. La primera foto queda como principal; se puede reordenar, elegir otra
 * principal, indicar el tipo de vista y retirar (baja lógica con motivo). El binario vive en el almacén. */
export function Fotografias({ piezaId, fotos, alCambiar }: { piezaId: string; fotos: FotoV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const gestionar = puede("fotos.gestionar");
  const vistas = useValoresLista("tipo_vista_foto");
  const ordenadas = [...fotos].sort((a, b) => a.orden - b.orden);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [retirando, setRetirando] = useState(false);
  const [url, setUrl] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  const activa = ordenadas.find((f) => f.id === activaId) ?? ordenadas.find((f) => f.esPrincipal) ?? ordenadas[0];
  const indice = activa ? ordenadas.indexOf(activa) : -1;

  const agregar = useMutation({
    mutationFn: async (entrada: File | string) => {
      const destino = typeof entrada === "string" ? entrada : await subirImagenACloudinary(entrada);
      return (await api.post<FotoV3>(`/piezas/${piezaId}/fotografias`, { url: destino })).data;
    },
    onSuccess: (foto) => { setUrl(""); if (archivo.current) archivo.current.value = ""; setActivaId(foto.id); alCambiar(); },
  });
  const editar = useMutation({
    mutationFn: async (cambio: { tipoVistaId?: string | null; esPrincipal?: boolean }) => api.patch(`/piezas/${piezaId}/fotografias/${activa!.id}`, cambio),
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

  return (
    <div className="glass-panel p-4 space-y-3 lg:sticky lg:top-20" aria-label="Fotografías">
      {activa ? (
        <figure className="space-y-2">
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-linea bg-fondo-suave">
            <img src={activa.url} alt={`Fotografía ${indice + 1} de ${ordenadas.length}`} className="w-full h-full object-contain" />
            {activa.esPrincipal && <span className="chip absolute top-2 left-2"><Star size={14} aria-hidden="true" /> Principal</span>}
          </div>
          <figcaption className="text-xs text-gris-2">
            {vistas.data?.find((v) => v.id === activa.tipoVistaId)?.etiqueta ?? "Vista sin indicar"} · {indice + 1} de {ordenadas.length}
          </figcaption>
        </figure>
      ) : (
        <div className="aspect-square rounded-2xl border border-dashed border-linea flex items-center justify-center text-sm text-gris-2">Sin fotografías registradas</div>
      )}

      {ordenadas.length > 1 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Miniaturas">
          {ordenadas.map((f, i) => (
            <button key={f.id} type="button" role="listitem" onClick={() => setActivaId(f.id)} aria-label={`Ver fotografía ${i + 1}`}
              aria-current={f.id === activa?.id} className={`w-14 h-14 rounded-xl overflow-hidden border-2 ${f.id === activa?.id ? "border-azul" : "border-linea opacity-80"}`}>
              <img src={f.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

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
          {retirando && <FormMotivo etiqueta="Motivo para retirar la fotografía" boton="Retirar" pendiente={retirar.isPending}
            onConfirmar={(m) => retirar.mutate(m)} onCancelar={() => setRetirando(false)} />}
        </div>
      )}

      <ErrorOperacion error={agregar.error ?? editar.error ?? ordenar.error ?? retirar.error} />
      {gestionar && (cloudinaryConfigurado() ? (
        <div>
          <label className="form-label" htmlFor="foto-archivo">Agregar fotografía</label>
          <input id="foto-archivo" ref={archivo} type="file" accept="image/*" className="text-sm"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) agregar.mutate(f); }} />
          {agregar.isPending && <p role="status" className="text-xs">Subiendo…</p>}
        </div>
      ) : (
        <form className="space-y-1" onSubmit={(e: FormEvent) => { e.preventDefault(); agregar.mutate(url.trim()); }}>
          <label className="form-label" htmlFor="foto-url">Agregar fotografía (URL ya subida)</label>
          <div className="flex gap-2">
            <input id="foto-url" type="url" required placeholder="https://…" className="glass-input text-sm" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn-glass shrink-0" disabled={agregar.isPending}>Añadir</button>
          </div>
        </form>
      ))}
    </div>
  );
}
