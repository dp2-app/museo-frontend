import type { EstadoFicha } from "../types";

// Spec de diseño §7 "Estados de la ficha (chip de color)".
const ESTILO: Record<EstadoFicha, string> = {
  borrador: "!bg-fondo-suave !border-linea !text-gris-2",
  en_revision: "!bg-paja/15 !border-paja/40 !text-estado-ambar",
  aprobada: "!bg-verde/15 !border-verde/40 !text-estado-verde",
  rechazada: "!bg-rojo/10 !border-rojo/40 !text-rojo-oscuro",
};

const ETIQUETA: Record<EstadoFicha, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export function ChipEstadoFicha({ estado }: { estado: EstadoFicha }) {
  return <span className={`chip ${ESTILO[estado]}`}><span aria-hidden="true">●</span>{ETIQUETA[estado]}</span>;
}
