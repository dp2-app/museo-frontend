import { useEffect, useRef, useState } from "react";
import { ErrorCampo, Etiqueta } from "./Comun";

interface Props {
  grupo: string;
  grupos: string[];
  cambiar: (grupo: string) => void;
  error?: string;
}

export function SelectorGrupo({ grupo, grupos, cambiar, error }: Props) {
  const [creando, setCreando] = useState(false);
  const [grupoInicial] = useState(grupo);
  const nombre = useRef<HTMLInputElement>(null);
  const opciones = [...new Set([...grupos, grupoInicial].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));

  useEffect(() => {
    if (creando) nombre.current?.focus();
  }, [creando]);

  return <div className="space-y-3">
    <div>
      <Etiqueta htmlFor="f0-grupo">Grupo</Etiqueta>
      <select id="f0-grupo" className="glass-input" required
        value={creando ? "nuevo" : `existente:${grupo}`}
        aria-invalid={!creando && Boolean(error)}
        aria-describedby={`f0-grupo-ayuda${!creando && error ? " f0-grupo-error" : ""}`}
        onChange={(e) => {
          const nuevo = e.target.value === "nuevo";
          setCreando(nuevo);
          cambiar(nuevo ? "" : e.target.value.slice("existente:".length));
        }}>
        {opciones.map((opcion) => <option key={opcion} value={`existente:${opcion}`}>{opcion}</option>)}
        <option value="nuevo">Crear nuevo grupo…</option>
      </select>
      <p id="f0-grupo-ayuda" className="mt-1 text-sm text-texto/70">Sección de la ficha donde aparecerá este campo.</p>
    </div>
    {creando && <div>
      <Etiqueta htmlFor="f0-grupo-nuevo">Nombre del nuevo grupo</Etiqueta>
      <input ref={nombre} id="f0-grupo-nuevo" className="glass-input" required
        pattern={".*\\S.*"} title="Escribe un nombre que no contenga solo espacios."
        placeholder="Por ejemplo: Datos del artesano" value={grupo}
        onChange={(e) => cambiar(e.target.value)} aria-invalid={Boolean(error)}
        aria-describedby={`f0-grupo-nuevo-ayuda${error ? " f0-grupo-error" : ""}`} />
      <p id="f0-grupo-nuevo-ayuda" className="mt-1 text-sm text-texto/70">Se creará al guardar el campo. Luego podrás seleccionarlo para otros campos.</p>
    </div>}
    <ErrorCampo id="f0-grupo-error" mensaje={error} />
  </div>;
}
