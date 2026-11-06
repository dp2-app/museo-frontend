// Gráficos simples de F8 con CSS y SVG, sin librerías (el stack no incluye una de gráficos). Todo valor también va escrito
// en texto: el color o el tamaño nunca son la única forma de leer un número (accesibilidad).

const numero = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
const acotar = (n: number) => Math.min(100, Math.max(0, n));

/** Anillo de progreso: `porcentaje` ya viene calculado por el backend. */
export function Anillo({ porcentaje, etiqueta, tamano = 64 }: { porcentaje: number; etiqueta: string; tamano?: number }) {
  const radio = 26;
  const circunferencia = 2 * Math.PI * radio;
  const lleno = (acotar(porcentaje) / 100) * circunferencia;
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" role="img" aria-label={`${etiqueta}: ${numero(porcentaje)} %`} className="shrink-0">
      <circle cx="32" cy="32" r={radio} fill="none" strokeWidth="8" className="stroke-fondo-suave" />
      <circle cx="32" cy="32" r={radio} fill="none" strokeWidth="8" strokeLinecap="butt" transform="rotate(-90 32 32)"
              strokeDasharray={`${lleno} ${circunferencia - lleno}`} className="stroke-azul" />
    </svg>
  );
}

/** Barra de progreso con el porcentaje escrito. */
export function BarraProgreso({ porcentaje, etiqueta }: { porcentaje: number; etiqueta: string }) {
  const p = acotar(porcentaje);
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}
           className="h-2 flex-1 rounded-pill bg-fondo-suave overflow-hidden">
        <div className="h-full bg-azul" style={{ width: `${p}%` }} />
      </div>
      <span className="tabular-nums text-xs w-12 text-right">{numero(porcentaje)} %</span>
    </div>
  );
}

/** Barras horizontales: el largo es proporcional al mayor valor; el total va escrito al final. */
export function BarrasHorizontales({ items, maximo }: { items: { clave: string; etiqueta: string; total: number }[]; maximo?: number }) {
  const mayor = maximo ?? Math.max(1, ...items.map((i) => i.total));
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.clave} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate" title={i.etiqueta}>{i.etiqueta}</span>
          <div className="h-3 rounded-pill bg-fondo-suave overflow-hidden" aria-hidden="true">
            <div className="h-full bg-azul" style={{ width: `${acotar((i.total / mayor) * 100)}%`, minWidth: i.total > 0 ? "2px" : 0 }} />
          </div>
          <span className="tabular-nums text-right w-14">{i.total.toLocaleString("es-PE")}</span>
        </li>
      ))}
    </ul>
  );
}
