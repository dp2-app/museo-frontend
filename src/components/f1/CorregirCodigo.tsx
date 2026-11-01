import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock, X } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { Codigo } from "../../types/f1";
import { ErrorCampo, ErrorOperacion, Etiqueta } from "../f0/Comun";
import { ResultadoValidacion } from "./CampoCodigo";
import { useValidarCodigo } from "../../hooks/useCodigosF1";
import { MOTIVO_MINIMO, puedeCorregir } from "../../lib/f1";

/** RF-05: corrección excepcional de un código. Guarda valor anterior, nuevo, motivo, usuario y fecha en la
 * auditoría (lo hace el backend). La ficha de F2 la abre desde la fila del código. */
export function CorregirCodigo({ piezaId, codigo, alTerminar, alCancelar }: { piezaId: string; codigo: Codigo; alTerminar: (codigo: Codigo) => void; alCancelar: () => void }) {
  const { puede } = usePermisos();
  const id = useId();
  const [valor, setValor] = useState(codigo.valor);
  const [motivo, setMotivo] = useState("");
  const cambio = valor.trim() !== codigo.valor;
  // Sin pieza ni régimen: `corregir_codigo` solo revisa formato y unicidad, y así el código no choca consigo mismo.
  const validacion = useValidarCodigo({ tipoCodigoId: codigo.tipoCodigoId, valor: cambio ? valor : "" });
  const corregir = useMutation({
    mutationFn: async () => api.post<Codigo>(`/piezas/${piezaId}/codigos/${codigo.id}/correccion`, { valor: valor.trim(), motivo: motivo.trim() }),
    onSuccess: (r) => alTerminar(r.data),
  });
  // Reescribir el mismo código con otro formato (I-1 → I-0001) da el mismo normalizado: no es un duplicado.
  const errores = validacion.data?.errores.filter((e) => !(e.codigo === "duplicado" && validacion.data?.valorNormalizado === codigo.valorNormalizado)) ?? [];
  const campos = erroresPorCampo(corregir.error);
  const motivoCorto = motivo.trim().length < MOTIVO_MINIMO;

  if (!puedeCorregir(codigo, puede)) return <p role="alert">Tu rol no puede corregir {codigo.bloqueado ? "un código bloqueado" : "este código"}.</p>;
  return <form className="glass-panel p-4 space-y-3" aria-label={`Corregir ${codigo.tipoNombre}`}
    onSubmit={(e: FormEvent) => { e.preventDefault(); if (cambio && !motivoCorto && errores.length === 0) corregir.mutate(); }}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="section-title flex items-center gap-2">{codigo.bloqueado && <Lock size={20} aria-hidden="true" />}Corregir {codigo.tipoNombre}</h3>
      <button type="button" className="btn-glass" aria-label="Cancelar corrección" onClick={alCancelar}><X size={20} aria-hidden="true" /></button>
    </div>
    {codigo.bloqueado && <p className="f0-notice">Este código es inmutable. La corrección es una excepción: queda registrada con tu usuario, la fecha y el motivo.</p>}
    <ErrorOperacion error={corregir.error} />
    <p className="text-sm">Valor actual: <span className="font-mono">{codigo.valor}</span></p>
    <div><Etiqueta htmlFor={`${id}-valor`}>Valor corregido</Etiqueta>
      <input id={`${id}-valor`} required className="glass-input font-mono" value={valor} onChange={(e) => setValor(e.target.value)}
        aria-invalid={errores.length > 0 || Boolean(campos.valor)} aria-describedby={`${id}-validacion ${id}-valor-error`} />
      <ResultadoValidacion id={`${id}-validacion`} resultado={validacion.data && { ...validacion.data, errores }} cargando={validacion.isFetching} />
      <ErrorCampo id={`${id}-valor-error`} mensaje={campos.valor} /></div>
    <div><Etiqueta htmlFor={`${id}-motivo`}>Motivo de la corrección</Etiqueta>
      <textarea id={`${id}-motivo`} required minLength={MOTIVO_MINIMO} className="glass-input" value={motivo} onChange={(e) => setMotivo(e.target.value)}
        aria-invalid={Boolean(campos.motivo)} aria-describedby={`${id}-motivo-ayuda ${id}-motivo-error`} />
      <p id={`${id}-motivo-ayuda`} className="mt-1 text-sm text-texto/70">Mínimo {MOTIVO_MINIMO} caracteres ({motivo.trim().length}/{MOTIVO_MINIMO}).</p>
      <ErrorCampo id={`${id}-motivo-error`} mensaje={campos.motivo} /></div>
    <div className="flex flex-wrap gap-3">
      <button className="btn-primary" disabled={corregir.isPending || !cambio || motivoCorto || errores.length > 0}>{corregir.isPending ? "Guardando…" : "Guardar corrección"}</button>
      <button type="button" className="btn-glass" onClick={alCancelar}>Cancelar</button>
    </div>
  </form>;
}
