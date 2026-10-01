import { TriangleAlert } from "lucide-react";

/** Spec §9: el error lleva texto rojo + ícono triangle-alert a la izquierda, nunca solo color. */
export function MensajeError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-rojo-oscuro">
      <TriangleAlert size={20} className="shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
