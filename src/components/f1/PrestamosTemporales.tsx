import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Plus, X } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { useConsultaF0 } from "../../hooks/useConsultaF0";
import { usePropietarios, useRegimenes } from "../../hooks/useCatalogosF1";
import type { Tenencia } from "../../types/f1";
import { fecha } from "../../lib/f1";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "../f0/Comun";

const vacio = { regimenId: "", referenciaExterna: "", contraparteId: "", fechaInicio: "", fechaFin: "", condicionesContractuales: "", documentoReferencia: "", restringidoPublicacion: false };

/** RN-04: bienes recibidos en préstamo temporal. No crean pieza ni aparecen en el inventario. */
export function PrestamosTemporales() {
  const permisos = usePermisos();
  const puede = permisos.puede("tenencias.gestionar");
  const cache = useQueryClient();
  const prestamos = useConsultaF0({ queryKey: ["f1", "prestamos"], queryFn: async () => (await api.get<Tenencia[]>("/prestamos-temporales")).data });
  const regimenes = useRegimenes();
  const propietarios = usePropietarios(permisos.puede("propietarios.ver"));
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [aviso, setAviso] = useState("");

  const deTemporal = regimenes.data?.filter((r) => r.activo && !r.ingresaInventarioPermanente) ?? [];
  const regimen = deTemporal.find((r) => r.id === form.regimenId) ?? (deTemporal.length === 1 ? deTemporal[0] : undefined);
  const registrar = useMutation({
    mutationFn: async () => api.post("/prestamos-temporales", {
      regimenId: regimen?.id, referenciaExterna: form.referenciaExterna.trim(), contraparteId: form.contraparteId || null,
      fechaInicio: form.fechaInicio || null, fechaFin: form.fechaFin || null, condicionesContractuales: form.condicionesContractuales.trim() || null,
      documentoReferencia: form.documentoReferencia.trim() || null, restringidoPublicacion: form.restringidoPublicacion,
    }),
    onSuccess: () => { setAviso("Préstamo temporal registrado."); setAbierto(false); setForm(vacio); void cache.invalidateQueries({ queryKey: ["f1", "prestamos"] }); },
  });
  const errores = erroresPorCampo(registrar.error);

  if (prestamos.isPending) return <p role="status">Cargando préstamos…</p>;
  if (prestamos.isError) return <EstadoConsulta cargando={false} error={prestamos.error} reintentar={() => { void prestamos.refetch(); }} />;
  const ordenados = [...prestamos.data].sort((a, b) => Number(b.vigente) - Number(a.vigente) || b.creadoEn.localeCompare(a.creadoEn));

  return <section className="space-y-5" aria-label="Préstamos temporales">
    <div className="flex flex-wrap items-start justify-end gap-3">
      {puede && <button type="button" className="btn-primary" onClick={() => { registrar.reset(); setAviso(""); setAbierto(true); }}><Plus size={20} aria-hidden="true" />Registrar préstamo</button>}
    </div>
    <p className="f0-notice"><Info size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>No forman parte del inventario ni reciben código I. Si el bien se queda en el museo, regístralo como pieza y cambia su régimen desde la ficha.</span></p>
    {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}

    {abierto && <form onSubmit={(e: FormEvent) => { e.preventDefault(); registrar.mutate(); }} className="glass-panel p-4 sm:p-6 space-y-4" aria-label="Registrar préstamo temporal">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">Nuevo préstamo temporal</h3>
        <button type="button" className="btn-glass" aria-label="Cerrar formulario" onClick={() => setAbierto(false)}><X size={20} aria-hidden="true" /></button>
      </div>
      <ErrorOperacion error={registrar.error} />
      {deTemporal.length === 0 && <p role="alert">No hay un régimen activo de préstamo temporal. Pide a un administrador que lo cree en Administración › Regímenes.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {deTemporal.length > 1 && <div><Etiqueta htmlFor="f1-prest-regimen">Régimen</Etiqueta>
          <select id="f1-prest-regimen" className="glass-input" required value={form.regimenId} onChange={(e) => setForm({ ...form, regimenId: e.target.value })}>
            <option value="">Seleccionar…</option>{deTemporal.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select></div>}
        <div className="md:col-span-2"><Etiqueta htmlFor="f1-prest-referencia">Bien recibido</Etiqueta>
          <input id="f1-prest-referencia" className="glass-input" required value={form.referenciaExterna} placeholder="Por ejemplo: Retablo ayacuchano de la colección X"
            onChange={(e) => setForm({ ...form, referenciaExterna: e.target.value })} aria-invalid={Boolean(errores.referenciaExterna)} aria-describedby="f1-prest-referencia-error" />
          <ErrorCampo id="f1-prest-referencia-error" mensaje={errores.referenciaExterna} /></div>
        <div><Etiqueta htmlFor="f1-prest-contraparte">Prestador{regimen?.requiereContraparte ? "" : " (opcional)"}</Etiqueta>
          <select id="f1-prest-contraparte" className="glass-input" required={regimen?.requiereContraparte} value={form.contraparteId} onChange={(e) => setForm({ ...form, contraparteId: e.target.value })}
            aria-invalid={Boolean(errores.contraparteId)} aria-describedby="f1-prest-contraparte-error">
            <option value="">{propietarios.data ? "Seleccionar…" : "Sin acceso a propietarios"}</option>
            {propietarios.data?.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <ErrorCampo id="f1-prest-contraparte-error" mensaje={errores.contraparteId} /></div>
        <div><Etiqueta htmlFor="f1-prest-documento">Documento de referencia</Etiqueta>
          <input id="f1-prest-documento" className="glass-input" value={form.documentoReferencia} placeholder="Convenio, acta…" onChange={(e) => setForm({ ...form, documentoReferencia: e.target.value })} /></div>
        <div><Etiqueta htmlFor="f1-prest-inicio">Fecha de inicio{regimen?.requiereFechas ? "" : " (opcional)"}</Etiqueta>
          <input id="f1-prest-inicio" type="date" className="glass-input" required={regimen?.requiereFechas} value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
            aria-invalid={Boolean(errores.fechaInicio)} aria-describedby="f1-prest-inicio-error" />
          <ErrorCampo id="f1-prest-inicio-error" mensaje={errores.fechaInicio} /></div>
        <div><Etiqueta htmlFor="f1-prest-fin">Fecha de devolución (opcional)</Etiqueta>
          <input id="f1-prest-fin" type="date" className="glass-input" min={form.fechaInicio || undefined} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
            aria-invalid={Boolean(errores.fechaFin)} aria-describedby="f1-prest-fin-error" />
          <ErrorCampo id="f1-prest-fin-error" mensaje={errores.fechaFin} /></div>
        <div className="md:col-span-2"><Etiqueta htmlFor="f1-prest-condiciones">Condiciones del préstamo</Etiqueta>
          <textarea id="f1-prest-condiciones" className="glass-input" value={form.condicionesContractuales} onChange={(e) => setForm({ ...form, condicionesContractuales: e.target.value })} /></div>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.restringidoPublicacion} onChange={(e) => setForm({ ...form, restringidoPublicacion: e.target.checked })} />Restringido para publicación (RN-07)</label>
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={registrar.isPending || !regimen}>{registrar.isPending ? "Registrando…" : "Registrar préstamo"}</button>
        <button type="button" className="btn-glass" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>}

    <div className="f0-catalogue">
      <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Préstamos registrados" tabIndex={0}>
        <table className="f0-table">
          <thead><tr>{["Bien", "Prestador", "Desde", "Hasta", "Estado"].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
          <tbody>{ordenados.map((t) => <tr key={t.id}>
            <th scope="row" className="font-semibold">{t.referenciaExterna}
              {(t.condicionesContractuales || t.documentoReferencia) && <span className="block text-xs font-normal text-texto/60 mt-1">{[t.documentoReferencia, t.condicionesContractuales].filter(Boolean).join(" · ")}</span>}</th>
            <td>{t.contraparte?.nombre ?? "—"}</td>
            <td className="whitespace-nowrap">{fecha(t.fechaInicio)}</td>
            <td className="whitespace-nowrap">{fecha(t.fechaFin)}</td>
            <td><span className={`f0-badge ${t.vigente ? "f0-badge-active" : ""}`}><span className="h-1 w-1 rounded-pill bg-current" />{t.vigente ? "Vigente" : "Cerrado"}</span>
              {t.restringidoPublicacion && <span className="f0-badge ml-1">Restringido</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {ordenados.length === 0 && <p className="p-4">No hay préstamos temporales registrados.</p>}
    </div>
  </section>;
}
