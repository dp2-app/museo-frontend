import { useEffect, useState } from "react";
import { Bot } from "lucide-react";

const CAMBIO_MS = 2800;
// Groq puede cambiar de modelo o reintentar si está saturado (hasta 60 s por modelo): pasado este tiempo se avisa.
const AVISO_LENTO_MS = 20000;

/** F10 · espera mientras la IA responde («Armar sala» y «Preguntar», museo-frontend#101). Muestra un indicador con
 * movimiento, mensajes de avance que se suceden hasta el último (no vuelven a empezar) y un esqueleto de resultados.
 * Con `prefers-reduced-motion` no hay movimiento: los puntos y el esqueleto quedan quietos y solo cambia el texto.
 * Los lectores de pantalla oyen un único aviso (y el de demora), no cada mensaje que rota. */
export function EsperaIA({ mensajes, filas = 4 }: { mensajes: string[]; filas?: number }) {
  const [paso, setPaso] = useState(0);
  const [lenta, setLenta] = useState(false);

  useEffect(() => {
    const rotar = window.setInterval(() => setPaso((p) => Math.min(p + 1, mensajes.length - 1)), CAMBIO_MS);
    const avisar = window.setTimeout(() => setLenta(true), AVISO_LENTO_MS);
    return () => {
      window.clearInterval(rotar);
      window.clearTimeout(avisar);
    };
  }, [mensajes.length]);

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="glass-panel-sm p-4 flex items-center gap-3">
        <span className="relative inline-flex shrink-0" aria-hidden="true">
          <Bot size={22} className="text-azul" />
          <span className="absolute -inset-1.5 rounded-full border-2 border-azul/20 border-t-azul motion-safe:animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="sr-only">La IA está preparando la respuesta.</p>
          <p className="text-sm text-texto flex items-center gap-2" aria-hidden="true">
            <span>{mensajes[paso]}</span>
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-azul/60 motion-safe:animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </p>
          {lenta && (
            <p className="text-xs text-gris-2 mt-1">
              El servicio de IA está ocupado y estamos probando con otro modelo. Puede tardar hasta un minuto.
            </p>
          )}
        </div>
      </div>

      <div className="glass-panel overflow-hidden" aria-hidden="true">
        <div className="px-5 py-3 border-b border-linea">
          <div className="h-3 w-32 rounded bg-fondo-suave motion-safe:animate-pulse" />
        </div>
        <div className="divide-y divide-linea">
          {Array.from({ length: filas }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-3 w-8 rounded bg-fondo-suave motion-safe:animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded bg-fondo-suave motion-safe:animate-pulse" style={{ width: `${70 - i * 9}%` }} />
                <div className="h-2.5 w-1/3 rounded bg-fondo-suave motion-safe:animate-pulse" />
              </div>
              <div className="h-3 w-20 rounded bg-fondo-suave motion-safe:animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
