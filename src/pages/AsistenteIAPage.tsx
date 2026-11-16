import { Bot } from "lucide-react";
import { ArmarSala } from "../components/f10/ArmarSala";

// Armar sala (RIA-05), con `ia.usar`. «Preguntar» (RIA-06) pasó a «Buscar con IA» dentro de Colección (museo-frontend#121).
// La antigua pestaña «Calidad de datos» se retiró el 03/11/2026. Roles: los que la matriz de permisos defina (F9).
export function AsistenteIAPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Bot size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Armar sala</h1>
          <p className="text-sm text-gris-2 max-w-2xl">
            La IA propone y una persona decide: ninguna sugerencia se aplica ni se guarda en la ficha sin que alguien la acepte explícitamente.
          </p>
        </div>
      </div>
      <ArmarSala />
    </div>
  );
}
