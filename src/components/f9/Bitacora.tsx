import { useState } from "react";
import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { usePermisos } from "../../hooks/usePermisos";
import { api } from "../../lib/api";
import type { Pagina, RegistroAuditoriaGlobal } from "../../types";
import { EstadoConsulta } from "../f0/Comun";

const TAMANO = 50;
const TABLAS: [string, string][] = [
  ["", "Todas"], ["piezas", "Fichas"], ["usuarios", "Usuarios"], ["roles", "Roles y permisos"], ["visibilidad_campos", "Visibilidad por rol"],
  ["campos_ficha", "Campos de la ficha"], ["valores_lista", "Listas de valores"], ["parametros", "Parámetros"], ["tenencias", "Tenencias"], ["codigos_externos", "Códigos"],
];
const ACCIONES: Record<string, string> = { insert: "Alta", update: "Cambio", soft_delete: "Baja", restore: "Restauración" };
const cuando = (iso?: string) => (iso ? new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "medium" }) : "");

/** Bitácora global de cambios (RF-40, RNF-11). El servidor omite los cambios de campos que tu rol no puede ver. */
export function Bitacora() {
  const puede = usePermisos().puede("auditoria.ver");
  const [pagina, setPagina] = useState(1);
  const [tabla, setTabla] = useState("");
  const consulta = useQuery({
    queryKey: ["f9", "auditoria", pagina, tabla], enabled: puede,
    queryFn: async () => (await api.get<Pagina<RegistroAuditoriaGlobal>>("/auditoria", { params: { pagina, tamano: TAMANO, ...(tabla ? { tabla } : {}) } })).data,
  });
  if (!puede) return <p>No tienes permiso para ver la bitácora de auditoría.</p>;
  if (consulta.isPending || consulta.isError) return <EstadoConsulta cargando={consulta.isPending} error={consulta.error} reintentar={() => { void consulta.refetch(); }} />;
  const { items, total } = consulta.data;
  const paginas = Math.max(1, Math.ceil(total / TAMANO));

  return (
    <section className="space-y-5" aria-label="Bitácora de auditoría">
      <div>
        <h2 className="section-title">Bitácora de auditoría</h2>
        <p className="text-texto">Quién cambió qué y cuándo, con el valor anterior y el nuevo. Es un registro de solo lectura: nada se borra.</p>
      </div>
      <div className="f0-catalogue">
        <div className="f0-toolbar">
          <label className="flex items-center gap-2 font-semibold text-azul" htmlFor="bitacora-tabla">Mostrar
            <select id="bitacora-tabla" className="glass-input sm:!w-auto" value={tabla} onChange={(e) => { setTabla(e.target.value); setPagina(1); }}>
              {TABLAS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </select>
          </label>
          <p className="self-center text-sm text-texto/70" role="status">{total} registros · página {pagina} de {paginas}</p>
        </div>
        <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Registros de auditoría" tabIndex={0}>
          <table className="f0-table min-w-[48rem]">
            <thead><tr>{["Fecha", "Usuario", "Acción", "Dónde", "Antes", "Después"].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{cuando(r.fecha)}</td>
                  <td>{r.usuarioNombre ?? <span className="text-texto/60">Sistema</span>}</td>
                  <td><span className="f0-badge">{ACCIONES[r.accion] ?? r.accion}</span></td>
                  <td><span className="font-semibold">{r.tabla}</span><span className="block text-xs text-texto/60">{r.campo}</span>{r.motivo && <span className="block text-xs text-texto/60">Motivo: {r.motivo}</span>}</td>
                  <td className="break-words max-w-[16rem]">{r.valorAnterior ?? "—"}</td>
                  <td className="break-words max-w-[16rem]">{r.valorNuevo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && <p className="p-6">Sin registros de auditoría para este filtro.</p>}
        <div className="flex items-center justify-between gap-3 p-4">
          <button type="button" className="btn-glass" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <button type="button" className="btn-glass" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      </div>
    </section>
  );
}
