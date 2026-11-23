import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, Image as IconoGaleria, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { subirImagenACloudinary } from "../lib/cloudinary";
import { prepararFoto } from "../lib/fotoCamara";
import { useOperacion } from "../lib/recursosFicha";
import { Aviso } from "./FichaComun";

const tamano = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("es-PE", { maximumFractionDigits: 1 })} MB`;

/**
 * Añadir la fotografía de una pieza desde el celular: «Tomar foto» abre la cámara trasera, se ve la vista previa y
 * «Guardar fotografía» la sube y la registra en un solo paso. En el computador el mismo botón abre el selector de archivos.
 * Al guardar se refresca la ficha, así que «Qué le falta» deja de pedir la fotografía sin recargar.
 */
export function TomarFotoPieza({ ruta }: { ruta: string }) {
  const camara = useRef<HTMLInputElement>(null); const galeria = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null);
  const [preparando, setPreparando] = useState(false); const [problema, setProblema] = useState("");
  const op = useOperacion();
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.vista); }, [foto]);

  async function elegida(e: ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]; e.target.value = ""; if (!original) return;
    setProblema(""); op.setMensaje(""); setPreparando(true);
    try { const archivo = await prepararFoto(original); setFoto({ archivo, vista: URL.createObjectURL(archivo) }); }
    catch (error) { setFoto(null); setProblema(error instanceof Error ? error.message : "No se pudo preparar la foto."); }
    finally { setPreparando(false); }
  }
  const guardar = () => {
    if (!foto) return;
    op.ejecutar(async () => {
      const url = await subirImagenACloudinary(foto.archivo);
      await api.post(ruta, { url, formato: "jpg", tamanoBytes: foto.archivo.size, restringidoUso: false });
      setFoto(null);
      return "Fotografía guardada. Puedes tomar otra.";
    });
  };
  const ocupado = preparando || op.pendiente;

  return <section aria-label="Tomar fotografía" className="rounded-card border border-linea bg-fondo-suave p-4 space-y-3">
    <p className="font-semibold text-azul">Fotografía rápida</p>
    <p className="text-sm">Desde el celular, toma la foto de la pieza y guárdala en un paso. Con buena luz y la pieza completa en el cuadro.</p>
    <input ref={camara} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Cámara del celular" onChange={(e) => { void elegida(e); }} />
    <input ref={galeria} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-label="Elegir fotografía de la galería" onChange={(e) => { void elegida(e); }} />
    {!foto && <div className="flex flex-wrap gap-3">
      <button type="button" className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[52px]" disabled={ocupado} onClick={() => camara.current?.click()}>
        <Camera size={20} aria-hidden="true" />{preparando ? "Preparando la foto…" : "Tomar foto"}</button>
      <button type="button" className="btn-glass inline-flex items-center justify-center gap-2 w-full sm:w-auto" disabled={ocupado} onClick={() => galeria.current?.click()}>
        <IconoGaleria size={18} aria-hidden="true" />Elegir de la galería</button>
    </div>}
    {foto && <div className="space-y-3">
      <img src={foto.vista} alt="Vista previa de la fotografía por guardar" className="w-full max-h-[60vh] object-contain rounded-card border border-linea bg-white" />
      <p className="text-sm">{tamano(foto.archivo.size)} · lista para guardar</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[52px]" disabled={ocupado} onClick={guardar}>
          <Check size={20} aria-hidden="true" />{op.pendiente ? "Guardando fotografía…" : "Guardar fotografía"}</button>
        <button type="button" className="btn-glass inline-flex items-center justify-center gap-2 w-full sm:w-auto" disabled={ocupado} onClick={() => { setFoto(null); camara.current?.click(); }}>
          <RotateCcw size={18} aria-hidden="true" />Repetir</button>
      </div>
    </div>}
    {problema && <p role="alert" className="ui-error">{problema}</p>}
    <Aviso mensaje={op.mensaje} />
  </section>;
}
