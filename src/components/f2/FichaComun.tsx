import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useCatalogoFicha } from "../../hooks/useCatalogoFicha";
import type { PiezaV3 } from "../../types";

// Ficha al estilo del formato de registro que el cliente mostró como referencia (surdoc.cl):
// secciones tituladas con línea de acento y filas etiqueta/valor.
export function Seccion({ titulo, acciones, children }: { titulo: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass-panel p-5 space-y-4" aria-label={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-2 border-azul/60">
        <h3 className="section-title">{titulo}</h3>
        {acciones}
      </div>
      {children}
    </section>
  );
}

export function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm py-1.5 border-b border-linea last:border-0">
      <dt className="text-gris-2 font-medium">{etiqueta}</dt>
      <dd className="col-span-2 text-texto break-words">{children}</dd>
    </div>
  );
}

function texto(pieza: PiezaV3, clave: string, tipo: string): string {
  if (clave in pieza.listas) return pieza.listas[clave].map((v) => v.etiqueta ?? "—").join(", ") || "—";
  const valor = pieza.campos[clave];
  if (valor == null || valor === "") return "—";
  if (tipo === "lista" || tipo === "referencia") return pieza.etiquetas[clave] ?? "—";
  if (tipo === "fecha") return new Date(`${String(valor)}T00:00:00`).toLocaleDateString("es-PE");
  return String(valor);
}

/** Los campos del catálogo (F0) con dato, agrupados como en el formulario; los vacíos ya los lista
 * «Información por completar». Un campo oculto para el rol no viene en la respuesta (RF-57). */
export function CamposPorGrupo({ pieza, excluir = [] }: { pieza: PiezaV3; excluir?: string[] }) {
  const catalogo = useCatalogoFicha();
  const campos = (catalogo.data ?? [])
    .filter((c) => c.activo && !excluir.includes(c.clave) && texto(pieza, c.clave, c.tipo) !== "—")
    .sort((a, b) => a.orden - b.orden);
  const grupos = [...new Set(campos.map((c) => c.grupo))];
  if (catalogo.isPending) return <p role="status">Cargando ficha…</p>;
  return (
    <>
      {grupos.map((grupo) => (
        <Seccion key={grupo} titulo={grupo}>
          <dl>{campos.filter((c) => c.grupo === grupo).map((c) => <Fila key={c.clave} etiqueta={c.etiqueta}>{texto(pieza, c.clave, c.tipo)}</Fila>)}</dl>
        </Seccion>
      ))}
    </>
  );
}

/** Formulario corto para acciones que el backend exige justificar (baja, retiro, rechazo). */
export function FormMotivo({ etiqueta, boton, onConfirmar, onCancelar, pendiente }: {
  etiqueta: string; boton: string; onConfirmar: (motivo: string) => void; onCancelar: () => void; pendiente?: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const id = useId();
  return (
    <form className="flex flex-col gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); if (motivo.trim()) onConfirmar(motivo.trim()); }}>
      <label className="form-label" htmlFor={id}>{etiqueta}</label>
      <textarea id={id} required rows={2} className="glass-input text-sm" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-glass !min-h-0 !py-1.5 !px-3 !text-sm" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primary !min-h-0 !py-1.5 !px-3 !text-sm" disabled={pendiente || !motivo.trim()}>{boton}</button>
      </div>
    </form>
  );
}
