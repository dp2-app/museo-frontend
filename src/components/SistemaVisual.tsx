import { useRef, useState, type ReactNode } from "react";
import { ImageOff, LoaderCircle, Maximize2, X, type LucideIcon } from "lucide-react";

export function CabeceraPagina({ titulo, descripcion, icono: Icono, acciones, className = "" }: {
  titulo: string; descripcion?: ReactNode; icono?: LucideIcon; acciones?: ReactNode; className?: string;
}) {
  return <div className={`page-heading ${className}`}>
    <div className="page-heading-copy">{Icono && <span className="page-heading-icon"><Icono size={24} aria-hidden="true" /></span>}
      <div className="min-w-0"><h1>{titulo}</h1>{descripcion && <p className="page-description">{descripcion}</p>}</div>
    </div>{acciones && <div className="page-heading-actions">{acciones}</div>}
  </div>;
}

export function EstadoVacio({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return <div className="empty-state"><img src="/brand/matp_emblema_retablo.svg" alt="" aria-hidden="true" width="48" height="48" />
    <p className="font-semibold text-azul">{titulo}</p>{descripcion && <p className="text-sm text-gris-2 max-w-md">{descripcion}</p>}{accion}</div>;
}

export function Cargando({ children = "Cargando información…" }: { children?: ReactNode }) {
  return <p role="status" className="loading-state"><LoaderCircle size={20} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />{children}</p>;
}

/** Solo presenta la URL que entregó la API para el rol. El diálogo nativo conserva foco, Escape y retorno al botón. */
export function FotoPieza({ url, nombre, ampliable = false }: { url?: string; nombre: string; ampliable?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);const [fallida,setFallida] = useState<string>();
  const disponible = !!url && fallida !== url;
  return <div className="piece-photo">
    {disponible ? <img src={url} alt={nombre} loading="lazy" onError={() => setFallida(url)} />
      : <div className="photo-placeholder"><ImageOff size={32} aria-hidden="true" /><p>{url ? "No se pudo cargar la fotografía" : "Sin fotografía disponible"}</p></div>}
    {disponible && ampliable && <><button type="button" className="photo-expand" onClick={() => dialog.current?.showModal()}><Maximize2 size={18} aria-hidden="true" />Ampliar fotografía</button>
      <dialog ref={dialog} className="photo-dialog" aria-label={`Fotografía de ${nombre}`} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="photo-dialog-content"><button type="button" className="photo-dialog-close" aria-label="Cerrar fotografía" onClick={() => dialog.current?.close()}><X size={24} aria-hidden="true" /></button>
          <img src={url} alt={nombre} /><p>{nombre}</p></div>
      </dialog></>}
  </div>;
}
