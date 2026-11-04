import { useState } from "react";
import { Bot } from "lucide-react";
import { ArmarSala } from "../components/f10/ArmarSala";
import { PreguntarColeccion } from "../components/f10/PreguntarColeccion";
import { usePermisos } from "../hooks/usePermisos";

// Asistente IA (F10): «Preguntar» (RIA-06, HU-20) con `piezas.ver` y «Armar sala» (RIA-05) con `ia.usar`.
// La antigua pestaña «Calidad de datos» (RIA-01/RIA-02 y Fusionar, HU-21) se retiró el 03/11/2026: seguía sobre el
// contrato anterior al v3. Sus endpoints siguen en el backend. Roles: los que la matriz de permisos defina (F9).
type Pestana = "preguntar" | "sala";

export function AsistenteIAPage() {
  const { puede } = usePermisos();
  const pestanas = ([["preguntar", "Preguntar", "piezas.ver"], ["sala", "Armar sala", "ia.usar"]] as const)
    .filter(([, , permiso]) => puede(permiso));
  const [elegida, setPestana] = useState<Pestana>("preguntar");
  const pestana = pestanas.some(([clave]) => clave === elegida) ? elegida : pestanas[0]?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Bot size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Asistente IA</h1>
          <p className="text-sm text-gris-2 max-w-2xl">
            La IA propone y una persona decide (DA-006): ninguna sugerencia se aplica ni se guarda en la ficha sin que
            alguien la acepte explícitamente.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Funciones del asistente" className="flex gap-2 border-b border-linea">
        {pestanas.map(([clave, etiqueta]) => (
          <button
            key={clave}
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setPestana(clave)}
            className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition ${
              pestana === clave ? "border-rojo text-azul" : "border-transparent text-gris-2 hover:text-azul"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {pestana === "preguntar" && <PreguntarColeccion />}
        {pestana === "sala" && <ArmarSala />}
      </div>
    </div>
  );
}
