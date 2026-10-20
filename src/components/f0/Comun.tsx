import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { extraerMensajeError } from "../../lib/api";

export function ErrorOperacion({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="flex gap-2 rounded-card border border-rojo p-3 text-texto">
    <TriangleAlert size={20} className="shrink-0 text-rojo" aria-hidden="true" />{extraerMensajeError(error)}</p>;
}
export function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  return mensaje ? <p id={id} className="mt-1 text-sm text-texto" role="alert">{mensaje}</p> : null;
}
export function EstadoConsulta({ cargando, error, reintentar }: { cargando: boolean; error: unknown; reintentar: () => void }) {
  if (cargando) return <p role="status">Cargando configuración…</p>;
  if (error) return <div className="space-y-3"><ErrorOperacion error={error} /><button type="button" className="btn-glass" onClick={reintentar}>Reintentar</button></div>;
  return null;
}
export function Etiqueta({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label className="mb-1 block font-semibold text-azul" htmlFor={htmlFor}>{children}</label>;
}
