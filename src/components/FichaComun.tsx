import { useState, type ReactNode } from "react";
import { extraerMensajeError } from "../lib/api";

export function Panel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="glass-panel p-5 space-y-4 min-w-0"><h2 className="section-title">{titulo}</h2>{children}</section>;
}
export function Aviso({ mensaje }: { mensaje: string }) { return mensaje ? <p role="status" className="rounded-btn border border-linea p-3 text-sm">{mensaje}</p> : null; }
export function ErrorConsulta({ error }: { error: unknown }) { return error ? <p role="alert" className="text-rojo">{extraerMensajeError(error)}</p> : null; }
/** Confirmación explícita con motivo; ningún registro se elimina físicamente. */
export function ConMotivo({ etiqueta, ejecutar, pendiente = false }: { etiqueta: string; ejecutar: (motivo: string) => void; pendiente?: boolean }) {
  const [abierto, setAbierto] = useState(false); const [motivo, setMotivo] = useState("");
  return abierto ? <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) ejecutar(motivo.trim()); }}>
    <label className="flex-1 min-w-40">Motivo de {etiqueta.toLowerCase()}<input required className="glass-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
    <button className="btn-primary" disabled={pendiente || !motivo.trim()}>Confirmar {etiqueta.toLowerCase()}</button><button type="button" className="btn-glass" onClick={() => setAbierto(false)}>Cancelar</button>
  </form> : <button type="button" className="btn-glass" disabled={pendiente} onClick={() => setAbierto(true)}>{etiqueta}</button>;
}
