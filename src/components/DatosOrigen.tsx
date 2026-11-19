import { Panel } from "./FichaComun";
import type { OrigenImportacion } from "../lib/ficha";

const valor = (v: unknown) => (v == null || v === "" ? "Sin dato" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Valores de la fila con el mismo formato que «Ficha de inventario». */
function Valores({ datos }: { datos: Record<string, unknown> }) {
  return <dl className="grid gap-4 sm:grid-cols-2">{Object.entries(datos).map(([columna, v]) =>
    <div key={columna} className="border-b border-linea pb-2 min-w-0"><dt className="font-semibold text-azul break-words">{columna}</dt><dd className="whitespace-pre-wrap break-words">{valor(v)}</dd></div>)}</dl>;
}

/** RF-37 (museo-frontend#35): ningún valor del archivo de origen se pierde. Muestra de qué archivo, hoja y fila vino la pieza
 * y las columnas que no se mapearon a ningún campo de la ficha. Lo que llega ya viene filtrado por el backend
 * (`importacion.ver_procedencia` y campos ocultos del rol); si no hay procedencia, la sección no se muestra. */
export function DatosOrigen({ procedencia }: { procedencia?: OrigenImportacion[] }) {
  if (!procedencia?.length) return null;
  return <Panel titulo="Datos de origen de la importación">
    <p className="text-sm">Valores tal como venían en el archivo importado, incluidas las columnas que no tienen un campo en la ficha.</p>
    <ul className="space-y-3">{procedencia.map((o) => {
      const noMapeados = Object.keys(o.camposNoMapeados ?? {}).length;
      return <li key={o.id} className="border-b border-linea pb-3">
        <p className="font-semibold">{o.archivoNombre || "Archivo sin nombre"}{o.hojaNombre && ` · hoja ${o.hojaNombre}`}{o.numeroFila != null && ` · fila ${o.numeroFila}`}</p>
        <p className="text-sm text-gris-2">Importado el {new Date(o.creadoEn).toLocaleString("es-PE")}</p>
        {o.redactado ? <p className="text-sm">Su rol tiene campos ocultos: los valores originales de esta fila no se muestran.</p> : <>
          <details className="mt-2" open={noMapeados > 0}><summary className="cursor-pointer font-semibold">Columnas sin campo en la ficha ({noMapeados})</summary>
            {noMapeados ? <div className="mt-2"><Valores datos={o.camposNoMapeados} /></div> : <p className="text-sm mt-2">Todas las columnas de esta fila se mapearon a la ficha.</p>}</details>
          <details className="mt-2"><summary className="cursor-pointer font-semibold">Fila original completa</summary><div className="mt-2"><Valores datos={o.datosOriginales ?? {}} /></div></details>
        </>}
      </li>;
    })}</ul>
  </Panel>;
}
