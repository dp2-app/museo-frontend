import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { datosApi, extraerMensajeError } from "../lib/api";
import { usePermisos } from "../hooks/usePermisos";
import type { CuracionImportacion } from "../types";

interface PaginaCuracion { items: CuracionImportacion[]; total: number; }

const TAMANO = 50;

export function CuracionImportacionPage() {
  const permisos = usePermisos();
  const cache = useQueryClient();
  const puedeCurar = permisos.puede("importacion.curar");
  const [validando, setValidando] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [estado, setEstado] = useState<"" | "pendiente" | "validado">("pendiente");
  const [pagina, setPagina] = useState(1);
  const cola = useQuery({
    queryKey: ["curacion-importacion", estado, pagina],
    queryFn: async () => (await datosApi.get<PaginaCuracion>("/importacion/curacion",
      { params: { estado: estado || undefined, pagina, tamano: TAMANO } })).data,
  });
  const validar = useMutation({
    mutationFn: async (id: string) =>
      (await datosApi.post<CuracionImportacion>(`/importacion/curacion/${id}/validar`, { nota: nota.trim() || null })).data,
    onSuccess: () => {
      setValidando(null); setNota(""); setError(""); setAviso("Registro validado.");
      void cache.invalidateQueries({ queryKey: ["curacion-importacion"] });
    },
    onError: (e) => setError(extraerMensajeError(e)),
  });
  const total = cola.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANO));

  return (
    <div className="space-y-6">
      <header>
        <Link to="/importacion" className="text-azul underline">Volver a importación</Link>
        <h1 className="font-display text-2xl font-bold mt-2">Cola de curación</h1>
        <p className="text-sm mt-1">Registros que entraron al catálogo con advertencias o marcados por quien revisó la carga. Cada uno espera una validación posterior.</p>
      </header>

      <div className="glass-panel p-4 flex flex-wrap items-end gap-4">
        <label className="form-label">Estado
          <select className="glass-input block mt-1" value={estado}
            onChange={(e) => { setEstado(e.target.value as typeof estado); setPagina(1); }}>
            <option value="pendiente">Pendientes</option>
            <option value="validado">Validados</option>
            <option value="">Todos</option>
          </select>
        </label>
        <p className="text-sm" aria-live="polite">{cola.isSuccess ? `${total} registro(s)` : ""}</p>
      </div>

      {aviso && <p role="status">{aviso}</p>}
      {error && <p role="alert">{error}</p>}
      {cola.isLoading && <p>Cargando la cola…</p>}
      {cola.isError && <p role="alert">{extraerMensajeError(cola.error)}</p>}
      {cola.isSuccess && total === 0 && <p className="glass-panel p-5">No hay registros {estado === "pendiente" ? "pendientes" : estado === "validado" ? "validados" : ""} en la cola.</p>}

      {cola.isSuccess && total > 0 && (
        <div className="glass-panel overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Registros de la cola de curación</caption>
            <thead><tr>
              <th scope="col" className="p-4">Pieza</th>
              <th scope="col" className="p-4">Origen</th>
              <th scope="col" className="p-4">Motivos</th>
              <th scope="col" className="p-4">Estado</th>
              {puedeCurar && <th scope="col" className="p-4">Acción</th>}
            </tr></thead>
            <tbody>
              {cola.data.items.map((c) => (
                <tr key={c.id} className="border-t border-linea align-top">
                  <td className="p-4">
                    {permisos.puede("piezas.ver")
                      ? <Link className="underline" to={`/coleccion/${c.piezaId}`}>{c.piezaDenominacion ?? "Sin denominación"}</Link>
                      : (c.piezaDenominacion ?? "Sin denominación")}
                  </td>
                  <td className="p-4">{c.archivoNombre}, fila {c.filaNumero}<br />
                    <Link className="underline" to={`/importacion/${c.cargaId}`}>Ver carga</Link></td>
                  <td className="p-4"><ul className="list-disc pl-4">{c.motivos.map((m) => <li key={m.codigo}>{m.mensaje}</li>)}</ul></td>
                  <td className="p-4">
                    {c.estado === "pendiente" ? "Pendiente" : "Validado"}
                    {c.validadoEn && <p>{new Date(c.validadoEn).toLocaleString("es-PE")}</p>}
                    {c.nota && <p>{c.nota}</p>}
                  </td>
                  {puedeCurar && (
                    <td className="p-4">
                      {c.estado === "pendiente" && validando !== c.id && (
                        <button className="btn-glass" onClick={() => { setValidando(c.id); setNota(""); setError(""); setAviso(""); }}>Validar</button>
                      )}
                      {validando === c.id && (
                        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); setError(""); validar.mutate(c.id); }}>
                          <label className="form-label">Nota (opcional)
                            <textarea className="glass-input block w-full mt-1" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
                          </label>
                          <div className="flex gap-3">
                            <button className="btn-primary" disabled={validar.isPending}>Confirmar validación</button>
                            <button type="button" className="btn-glass" onClick={() => setValidando(null)}>Cancelar</button>
                          </div>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav className="flex items-center gap-3" aria-label="Paginación">
          <button className="btn-glass" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {paginas}</span>
          <button className="btn-glass" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
        </nav>
      )}
    </div>
  );
}
