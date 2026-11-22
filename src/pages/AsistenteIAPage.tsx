import { CabeceraPagina } from "../components/SistemaVisual";
import { Bot } from "lucide-react";
import { ArmarSala } from "../components/f10/ArmarSala";

// Armar sala (RIA-05), con `ia.usar`. «Preguntar» (RIA-06) pasó a «Buscar con IA» dentro de Colección (museo-frontend#121).
// La antigua pestaña «Calidad de datos» se retiró el 03/11/2026. Roles: los que la matriz de permisos defina (F9).
export function AsistenteIAPage() {
  return (
    <div className="sala-page space-y-6">
      <CabeceraPagina titulo="Armar sala" icono={Bot} descripcion="La IA propone y una persona decide: ninguna sugerencia se aplica ni se guarda en la ficha sin que alguien la acepte explícitamente." />
      <ArmarSala />
    </div>
  );
}
