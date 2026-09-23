import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileDown, Printer, Search } from "lucide-react";
import { api } from "../lib/api";
import type { Coleccion, Pagina, Pieza, ValorVocabulario } from "../types";

type Modo = "AND" | "OR";

interface Filtros {
  codigo: string;
  coleccionId: string;
  categoriaId: string;
  autor: string;
  material: string;
  estadoConservacionId: string;
}

const FILTROS_VACIOS: Filtros = {
  codigo: "",
  coleccionId: "",
  categoriaId: "",
  autor: "",
  material: "",
  estadoConservacionId: "",
};

/** HU-15: AND siempre lo resuelve el backend en una sola consulta (RF-031/032).
 * OR no existe como semántica SQL en /piezas hoy, así que se resuelve en el
 * cliente: una consulta real por cada filtro activo (siempre con
 * estadoFicha=aprobada, HU-05) y unión por id — más llamadas, pero ningún
 * dato inventado ni simulado. */
async function buscarPiezas(filtros: Filtros, modo: Modo): Promise<Pieza[]> {
  const entradas = Object.entries(filtros).filter(([, v]) => v.trim() !== "");
  const base: Record<string, string | number> = { estado_ficha: "aprobada", page_size: 200 };

  if (modo === "AND" || entradas.length <= 1) {
    const params: Record<string, string | number> = { ...base };
    for (const [clave, valor] of entradas) params[clave] = valor;
    const { data } = await api.get<Pagina<Pieza>>("/piezas", { params });
    return data.items;
  }

  const resultadosPorFiltro = await Promise.all(
    entradas.map(async ([clave, valor]) => {
      const { data } = await api.get<Pagina<Pieza>>("/piezas", { params: { ...base, [clave]: valor } });
      return data.items;
    }),
  );
  const porId = new Map<string, Pieza>();
  for (const lista of resultadosPorFiltro) for (const p of lista) porId.set(p.id, p);
  return [...porId.values()];
}

// Consultas y reportes (HU-14 a HU-16): búsqueda avanzada de solo lectura
// sobre el catálogo APROBADO (a diferencia de Colección, pantalla de
// trabajo). Roles: Administrador, Gestor de colecciones, Consulta interna.
export function ConsultasReportesPage() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [modo, setModo] = useState<Modo>("AND");
  const [exportando, setExportando] = useState(false);

  const { data: colecciones } = useQuery({
    queryKey: ["colecciones"],
    queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { pageSize: 100 } })).data,
  });
  const { data: categorias } = useQuery({
    queryKey: ["vocabularios", "categoria"],
    queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/categoria")).data,
  });
  const { data: estadosConservacion } = useQuery({
    queryKey: ["vocabularios", "estado_conservacion"],
    queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/estado_conservacion")).data,
  });

  const resultados = useQuery({
    queryKey: ["consultas-reportes", filtros, modo],
    queryFn: () => buscarPiezas(filtros, modo),
  });

  function actualizar<K extends keyof Filtros>(campo: K, valor: string) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  async function exportarExcel() {
    setExportando(true);
    try {
      const entradas = Object.entries(filtros).filter(([, v]) => v.trim() !== "");
      const params: Record<string, string> = { estado_ficha: "aprobada" };
      for (const [clave, valor] of entradas) params[clave] = valor;
      const { data } = await api.get("/reportes/exportar", { params, responseType: "blob" });
      const url = URL.createObjectURL(data);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "piezas.xlsx";
      enlace.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  const nombreColeccion = (id: string | null) => colecciones?.items.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5 print:hidden">
        <Search size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Consultas y reportes</h1>
          <p className="text-sm text-gris-2">
            HU-14 a HU-16 · búsqueda avanzada de solo lectura sobre el catálogo aprobado.
          </p>
        </div>
      </div>

      <div className="glass-panel-sm p-4 space-y-4 print:hidden">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label" htmlFor="f-codigo">
              Código de inventario
            </label>
            <input id="f-codigo" className="glass-input" value={filtros.codigo} onChange={(e) => actualizar("codigo", e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="f-coleccion">
              Colección
            </label>
            <select id="f-coleccion" className="glass-input min-w-[10rem]" value={filtros.coleccionId} onChange={(e) => actualizar("coleccionId", e.target.value)}>
              <option value="">Todas</option>
              {colecciones?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="f-autor">
              Autor
            </label>
            <input id="f-autor" className="glass-input" value={filtros.autor} onChange={(e) => actualizar("autor", e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="f-material">
              Material/tipología
            </label>
            <input id="f-material" className="glass-input" value={filtros.material} onChange={(e) => actualizar("material", e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="f-categoria">
              Categoría
            </label>
            <select id="f-categoria" className="glass-input min-w-[10rem]" value={filtros.categoriaId} onChange={(e) => actualizar("categoriaId", e.target.value)}>
              <option value="">Todas</option>
              {categorias?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.valor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="f-estado-conservacion">
              Estado de conservación
            </label>
            <select
              id="f-estado-conservacion"
              className="glass-input min-w-[10rem]"
              value={filtros.estadoConservacionId}
              onChange={(e) => actualizar("estadoConservacionId", e.target.value)}
            >
              <option value="">Todos</option>
              {estadosConservacion?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-linea">
          <fieldset className="flex items-center gap-3 text-sm">
            <legend className="form-label !mb-0 mr-1">Combinar filtros</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="modo" checked={modo === "AND"} onChange={() => setModo("AND")} /> Y (AND)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="modo" checked={modo === "OR"} onChange={() => setModo("OR")} /> O (OR)
            </label>
          </fieldset>
          <output className="text-sm text-gris-2">
            {resultados.isFetching ? "Buscando..." : `${resultados.data?.length ?? 0} resultado(s)`}
          </output>
          <div className="flex gap-2">
            <button type="button" onClick={exportarExcel} disabled={exportando} className="btn-glass !py-1.5 !px-3 !text-sm">
              <FileDown size={16} aria-hidden="true" /> Exportar Excel
            </button>
            <button type="button" onClick={() => window.print()} className="btn-glass !py-1.5 !px-3 !text-sm">
              <Printer size={16} aria-hidden="true" /> Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
              <tr>
                <th className="px-5 py-3 font-semibold">Denominación</th>
                <th className="px-5 py-3 font-semibold">Colección</th>
                <th className="px-5 py-3 font-semibold">Autor</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {resultados.data?.map((p) => (
                <tr key={p.id} className="hover:bg-fondo-suave transition">
                  <td className="px-5 py-3 font-medium text-texto">{p.denominacion || "(sin denominación)"}</td>
                  <td className="px-5 py-3 text-gris-2">{nombreColeccion(p.coleccionId)}</td>
                  <td className="px-5 py-3 text-gris-2">{p.autor || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/coleccion/${p.id}`} className="btn-danger-text">
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
              {resultados.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-gris-2">
                    No se encontraron piezas aprobadas con estos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista imprimible (HU-16 "PDF"): el navegador genera el PDF real vía
          "Guardar como PDF" en el diálogo de impresión — sin librería de
          generación en el servidor (mismo criterio ya documentado para
          CSV/Excel real vs. HTML imprimible en el prototipo hermano). */}
      <div className="hidden print:block">
        <h1 className="text-azul">Catálogo — Museo "Luis Repetto Málaga"</h1>
        <table className="w-full text-sm mt-4 border-collapse">
          <thead>
            <tr>
              <th className="text-left border-b border-azul py-1">Denominación</th>
              <th className="text-left border-b border-azul py-1">Colección</th>
              <th className="text-left border-b border-azul py-1">Autor</th>
            </tr>
          </thead>
          <tbody>
            {resultados.data?.map((p) => (
              <tr key={p.id}>
                <td className="py-1">{p.denominacion || "—"}</td>
                <td className="py-1">{nombreColeccion(p.coleccionId)}</td>
                <td className="py-1">{p.autor || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
