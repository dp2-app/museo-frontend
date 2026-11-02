import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Lightbulb, TriangleAlert } from "lucide-react";
import { api } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import { useTiposCodigo } from "../../hooks/useCatalogosF1";
import { useSiguienteCorrelativo, useValidarCodigo } from "../../hooks/useCodigosF1";
import type { Codigo, CodigoValidado } from "../../types/f1";
import { ErrorOperacion, Etiqueta } from "../f0/Comun";

/** Resultado de la validación junto al campo: errores (bloquean), advertencias y el valor normalizado. */
export function ResultadoValidacion({ id, resultado, cargando }: { id: string; resultado?: CodigoValidado; cargando: boolean }) {
  if (cargando) return <p id={id} className="mt-1 text-sm text-texto/70" role="status">Validando…</p>;
  if (!resultado) return <p id={id} className="sr-only" />;
  return <div id={id} className="mt-1 space-y-1 text-sm" aria-live="polite">
    {resultado.errores.map((e) => <p key={e.codigo + e.mensaje} className="flex gap-2 text-texto" data-codigo={e.codigo}>
      <TriangleAlert size={16} className="shrink-0 mt-0.5 text-rojo" aria-hidden="true" />{e.mensaje}</p>)}
    {resultado.advertencias.map((e) => <p key={e.codigo + e.mensaje} className="flex gap-2 text-texto" data-codigo={e.codigo}>
      <TriangleAlert size={16} className="shrink-0 mt-0.5 text-paja" aria-hidden="true" />{e.mensaje}</p>)}
    {resultado.errores.length === 0 && <p className="flex gap-2 text-verde font-semibold">
      <CircleCheck size={16} className="shrink-0 mt-0.5" aria-hidden="true" />Código válido{resultado.valorNormalizado && ` · se guarda como ${resultado.valorNormalizado}`}</p>}
  </div>;
}

/** Formulario para agregar un código a una pieza (RF-03, RF-04): valida en vivo, sugiere el correlativo y
 * guarda con `POST /piezas/{id}/codigos`. `tipoFijo` oculta el selector (por ejemplo, asignar el I desde
 * Pendientes). Lo puede usar la ficha de F2; la regla final la aplica el backend. */
export function AgregarCodigo({ piezaId, tipoFijo, alGuardar }: { piezaId: string; tipoFijo?: string; alGuardar: (codigo: Codigo) => void }) {
  const puede = usePermisos().puede("codigos.gestionar");
  const tipos = useTiposCodigo();
  const id = useId();
  const [elegido, setTipo] = useState("");
  const tipoCodigoId = tipoFijo ?? elegido;
  const [valor, setValor] = useState("");
  const tipo = tipos.data?.find((t) => t.id === tipoCodigoId);
  const validacion = useValidarCodigo({ tipoCodigoId, valor, piezaId });
  const sugerido = useSiguienteCorrelativo(tipoCodigoId, puede && Boolean(tipo?.esCorrelativo));
  const agregar = useMutation({
    mutationFn: async () => (await api.post<Codigo>(`/piezas/${piezaId}/codigos`, { tipoCodigoId, valor: valor.trim() })).data,
    onSuccess: (codigo) => { setValor(""); alGuardar(codigo); },
  });
  if (!puede) return null;
  const conErrores = Boolean(validacion.data?.errores.length);
  return <form className="space-y-3" aria-label={tipoFijo && tipo ? `Asignar ${tipo.nombre}` : "Agregar código"} onSubmit={(e: FormEvent) => { e.preventDefault(); if (!conErrores) agregar.mutate(); }}>
    <ErrorOperacion error={agregar.error} />
    <div className={tipoFijo ? "" : "grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"}>
      {!tipoFijo && <div><Etiqueta htmlFor={`${id}-tipo`}>Tipo de código</Etiqueta>
        <select id={`${id}-tipo`} required className="glass-input" value={elegido} onChange={(e) => { setTipo(e.target.value); agregar.reset(); }}>
          <option value="">Seleccionar…</option>
          {tipos.data?.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select></div>}
      <div><Etiqueta htmlFor={`${id}-valor`}>{tipoFijo && tipo ? tipo.nombre : "Valor"}</Etiqueta>
        <input id={`${id}-valor`} required className="glass-input font-mono" value={valor} onChange={(e) => { setValor(e.target.value); agregar.reset(); }}
          aria-invalid={conErrores} aria-describedby={`${id}-ayuda ${id}-validacion`} />
        <p id={`${id}-ayuda`} className="mt-1 text-sm text-texto/70">
          {tipo?.inmutable ? "Este código queda bloqueado al guardarse; solo se corrige por excepción." : "Puedes agregar varios códigos; los existentes no cambian."}
          {tipo?.patron && <> Formato: <code>{tipo.patron}</code></>}</p>
        <ResultadoValidacion id={`${id}-validacion`} resultado={validacion.data} cargando={validacion.isFetching} />
      </div>
    </div>
    <div className="flex flex-wrap gap-3">
      {sugerido.data && sugerido.data !== valor.trim() && <button type="button" className="f0-action" onClick={() => setValor(sugerido.data ?? "")}>
        <Lightbulb size={20} aria-hidden="true" />Usar el siguiente: {sugerido.data}</button>}
      <button className="btn-glass" disabled={agregar.isPending || conErrores}>{agregar.isPending ? "Guardando…" : tipoFijo ? "Asignar código" : "Agregar código"}</button>
    </div>
  </form>;
}
