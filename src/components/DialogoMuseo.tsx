import { useEffect, useRef, type ReactNode } from "react";
import { Check, X, type LucideIcon } from "lucide-react";

interface Props {
  titulo: string;
  descripcion: string;
  ceja: string;
  icono: LucideIcon;
  bloqueado?: boolean;
  clase?: string;
  etapas?: { titulo: string; detalle: string }[];
  etapa?: number;
  puedeVolver?: (numero: number) => boolean;
  alCambiarEtapa?: (numero: number) => void;
  alCerrar: () => void;
  children: ReactNode;
}

/** Foco, Escape y fondo inerte son del diálogo nativo; cada operación conserva su estado. */
export function DialogoMuseo({ titulo, descripcion, ceja, icono: Icono, bloqueado = false, clase = "", etapas, etapa = 1, puedeVolver, alCambiarEtapa, alCerrar, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const nodo = dialog.current!;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    nodo.showModal(); document.body.style.overflow = "hidden";
    return () => { nodo.close(); document.body.style.overflow = overflow; anterior?.focus(); };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [etapa, titulo]);
  function cerrar() { if (!bloqueado) alCerrar(); }
  return <dialog ref={dialog} className={`importacion-dialog ${clase}`} aria-label={titulo} onCancel={(e) => { if (e.target !== e.currentTarget) return; e.preventDefault(); cerrar(); }}>
    <div className="importacion-shell">
      <header className="importacion-cabecera"><span className="importacion-emblema"><Icono size={25} aria-hidden="true" /></span><div><p className="importacion-ceja">{ceja}</p><h2 ref={heading} tabIndex={-1}>{titulo}</h2><p>{descripcion}</p></div>
        <button type="button" className="importacion-cerrar" aria-label={`Cerrar ${titulo.toLocaleLowerCase("es")}`} disabled={bloqueado} onClick={cerrar}><X size={22} aria-hidden="true" /></button></header>
      {etapas && <nav className="importacion-progreso" aria-label="Etapas del registro"><ol>{etapas.map((paso, i) => {
        const numero = i + 1;
        return <li key={paso.titulo} className={numero === etapa ? "actual" : numero < etapa ? "completada" : ""}><button type="button" aria-current={numero === etapa ? "step" : undefined} disabled={bloqueado || (numero !== etapa && !puedeVolver?.(numero))} onClick={() => alCambiarEtapa?.(numero)}><span className="importacion-numero">{numero < etapa ? <Check size={17} aria-hidden="true" /> : numero}</span><span><strong>{paso.titulo}</strong><small>{paso.detalle}</small></span></button></li>;
      })}</ol></nav>}
      <div className="importacion-espacio">{children}</div>
    </div>
  </dialog>;
}
