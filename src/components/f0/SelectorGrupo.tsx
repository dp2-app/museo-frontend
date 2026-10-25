import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { ErrorCampo, Etiqueta } from "./Comun";

interface Props {
  grupo: string;
  grupos: string[];
  cambiar: (grupo: string) => void;
  error?: string;
}

export function SelectorGrupo({ grupo, grupos, cambiar, error }: Props) {
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [solicitudNombre, setSolicitudNombre] = useState(0);
  const [grupoInicial] = useState(grupo);
  const nombre = useRef<HTMLInputElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const opciones = [...new Set([...grupos, grupoInicial].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));

  useEffect(() => {
    if (solicitudNombre > 0) nombre.current?.focus();
  }, [solicitudNombre]);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (event: PointerEvent) => {
      if (event.target instanceof Node && !contenedor.current?.contains(event.target)) setAbierto(false);
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    // Desplazar únicamente la lista: el panel siempre permanece debajo del control.
    const opcion = lista.current?.children[indice] as HTMLElement | undefined;
    const panel = lista.current;
    if (!opcion || !panel) return;
    if (opcion.offsetTop < panel.scrollTop) panel.scrollTop = opcion.offsetTop;
    else if (opcion.offsetTop + opcion.offsetHeight > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = opcion.offsetTop + opcion.offsetHeight - panel.clientHeight;
    }
  }, [abierto, indice]);

  function abrir() {
    setIndice(Math.max(0, opciones.indexOf(grupo)));
    setAbierto(true);
  }
  function elegir(opcion: string) {
    cambiar(opcion);
    setCreando(false);
    setAbierto(false);
    boton.current?.focus();
  }
  function teclado(event: KeyboardEvent<HTMLButtonElement>) {
    const tecla = event.key;
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(tecla)) event.preventDefault();
    if (tecla === "Escape") { setAbierto(false); return; }
    if (tecla === "Enter" || tecla === " ") {
      if (!abierto) abrir();
      else if (opciones[indice]) elegir(opciones[indice]);
      return;
    }
    if (tecla === "ArrowDown" || tecla === "ArrowUp") {
      if (!abierto) abrir();
      else setIndice((actual) => Math.max(0, Math.min(opciones.length - 1, actual + (tecla === "ArrowDown" ? 1 : -1))));
    } else if (tecla === "Home" || tecla === "End") {
      setAbierto(true); setIndice(tecla === "Home" ? 0 : opciones.length - 1);
    } else if (tecla.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const siguiente = opciones.findIndex((opcion, posicion) => posicion > indice && opcion.toLocaleLowerCase().startsWith(tecla.toLocaleLowerCase()));
      const posicion = siguiente >= 0 ? siguiente : opciones.findIndex((opcion) => opcion.toLocaleLowerCase().startsWith(tecla.toLocaleLowerCase()));
      if (posicion >= 0) { event.preventDefault(); setAbierto(true); setIndice(posicion); }
    }
  }

  return <div ref={contenedor} className="space-y-3" onBlur={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false);
  }} onKeyDown={(e) => {
    if (e.key === "Escape" && abierto) { e.preventDefault(); setAbierto(false); boton.current?.focus(); }
  }}>
    <div>
      <label id="f0-grupo-etiqueta" htmlFor="f0-grupo" className="mb-1 block font-semibold text-azul">Grupo</label>
      <div className="relative">
        <button ref={boton} id="f0-grupo" type="button" role="combobox" aria-labelledby="f0-grupo-etiqueta"
          aria-expanded={abierto} aria-haspopup="listbox" aria-controls="f0-grupo-lista"
          aria-activedescendant={abierto && opciones[indice] ? `f0-grupo-opcion-${indice}` : undefined}
          aria-invalid={!creando && Boolean(error)}
          aria-describedby={`f0-grupo-ayuda${!creando && error ? " f0-grupo-error" : ""}`}
          className="glass-input flex items-center justify-between gap-3 text-left"
          onClick={() => abierto ? setAbierto(false) : abrir()} onKeyDown={teclado}>
          <span className="min-w-0 break-words">{creando ? "Nuevo grupo" : grupo || "Seleccionar grupo"}</span>
          <ChevronDown size={20} className={`shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {abierto && <div className="absolute top-full left-0 z-30 mt-2 w-full rounded-card border border-linea bg-white shadow-sombra overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-texto/70 border-b border-linea">Grupos existentes</p>
          <div ref={lista} id="f0-grupo-lista" role="listbox" aria-label="Grupos existentes" className="f0-grupos-scroll relative max-h-48 overflow-y-scroll overscroll-contain">
            {opciones.map((opcion, posicion) => <button key={opcion} id={`f0-grupo-opcion-${posicion}`} type="button" role="option"
              aria-selected={!creando && grupo === opcion} tabIndex={-1}
              className={`flex w-full items-center justify-between gap-3 px-3 py-3 min-h-11 text-left text-base text-texto hover:bg-fondo-suave ${indice === posicion ? "bg-fondo-suave" : ""}`}
              onClick={() => elegir(opcion)}>
              <span className="min-w-0 break-words">{opcion}</span>{!creando && grupo === opcion && <Check size={20} className="shrink-0 text-azul" aria-hidden="true" />}
            </button>)}
          </div>
          <div className="border-t border-linea p-2 bg-white">
            <button type="button" className="f0-action w-full !justify-start" onClick={() => {
              cambiar(""); setCreando(true); setAbierto(false); setSolicitudNombre((actual) => actual + 1);
            }}><Plus size={20} aria-hidden="true" />Crear grupo</button>
          </div>
        </div>}
      </div>
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
