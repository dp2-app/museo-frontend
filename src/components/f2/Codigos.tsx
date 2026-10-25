import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { useTiposCodigo } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import type { CodigoV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Fila, FormMotivo, Seccion } from "./FichaComun";

/** RF-05: corrección por excepción. Pide el valor correcto y el motivo; queda en la auditoría. */
function FormCorreccion({ codigo, pendiente, onConfirmar, onCancelar }: {
  codigo: CodigoV3; pendiente: boolean; onConfirmar: (valor: string, motivo: string) => void; onCancelar: () => void;
}) {
  const [valor, setValor] = useState(codigo.valor);
  const [motivo, setMotivo] = useState("");
  const listo = valor.trim() && valor.trim() !== codigo.valor && motivo.trim();
  return (
    <form className="mt-2 space-y-2 rounded-card border border-linea p-3" aria-label={`Corregir ${codigo.tipoNombre}`}
      onSubmit={(e: FormEvent) => { e.preventDefault(); if (listo) onConfirmar(valor.trim(), motivo.trim()); }}>
      {codigo.bloqueado && <p className="text-xs">Este código no se puede cambiar (RN-02). Solo se corrige por excepción, con motivo, y queda registrado.</p>}
      <div>
        <label className="form-label" htmlFor={`correccion-valor-${codigo.id}`}>Valor correcto</label>
        <input id={`correccion-valor-${codigo.id}`} className="glass-input font-mono" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <div>
        <label className="form-label" htmlFor={`correccion-motivo-${codigo.id}`}>Motivo de la corrección</label>
        <textarea id={`correccion-motivo-${codigo.id}`} rows={2} className="glass-input text-sm" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-glass !min-h-0 !py-1.5 !px-3 !text-sm" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primary !min-h-0 !py-1.5 !px-3 !text-sm" disabled={pendiente || !listo}>Corregir</button>
      </div>
    </form>
  );
}

/** F1 en la ficha: códigos del museo (RF-03, RF-04). El código I queda bloqueado al guardarse (RN-02) y solo
 * se corrige por excepción con `codigos.corregir_inmutable` (RF-05); los demás, con `codigos.gestionar`. */
export function Codigos({ piezaId, codigos, alCambiar }: { piezaId: string; codigos: CodigoV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const tipos = useTiposCodigo();
  const [tipoCodigoId, setTipo] = useState("");
  const [valor, setValor] = useState("");
  const [accion, setAccion] = useState<{ id: string; tipo: "retirar" | "corregir" } | null>(null);
  const cerrar = () => { setAccion(null); alCambiar(); };

  const agregar = useMutation({
    mutationFn: async () => api.post(`/piezas/${piezaId}/codigos`, { tipoCodigoId, valor: valor.trim() }),
    onSuccess: () => { setValor(""); alCambiar(); },
  });
  const retirar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => api.post(`/piezas/${piezaId}/codigos/${id}/baja`, { motivo }),
    onSuccess: cerrar,
  });
  const corregir = useMutation({
    mutationFn: async ({ id, valor: nuevo, motivo }: { id: string; valor: string; motivo: string }) =>
      api.post(`/piezas/${piezaId}/codigos/${id}/correccion`, { valor: nuevo, motivo }),
    onSuccess: cerrar,
  });
  const vigentes = codigos.filter((c) => c.vigente);
  const puedeCorregir = (c: CodigoV3) => puede(c.bloqueado ? "codigos.corregir_inmutable" : "codigos.gestionar");

  return (
    <Seccion titulo="Códigos del museo">
      <dl>
        {vigentes.map((c) => (
          <Fila key={c.id} etiqueta={c.tipoNombre}>
            <span className="font-mono">{c.valor}</span>
            {c.bloqueado && <Lock size={14} className="inline ml-1.5 text-gris-2" aria-label="No se puede modificar (RN-02)" />}
            {c.nota && <span className="block text-xs text-gris-2">{c.nota}</span>}
            {!accion && puedeCorregir(c) &&
              <button type="button" className="btn-danger-text ml-2 text-xs" onClick={() => setAccion({ id: c.id, tipo: "corregir" })}>Corregir</button>}
            {!accion && puede("codigos.gestionar") && !c.bloqueado &&
              <button type="button" className="btn-danger-text ml-2 text-xs" onClick={() => setAccion({ id: c.id, tipo: "retirar" })}>Retirar</button>}
            {accion?.id === c.id && accion.tipo === "retirar" &&
              <FormMotivo etiqueta="Motivo para retirar el código" boton="Retirar" pendiente={retirar.isPending}
                onConfirmar={(motivo) => retirar.mutate({ id: c.id, motivo })} onCancelar={() => setAccion(null)} />}
            {accion?.id === c.id && accion.tipo === "corregir" &&
              <FormCorreccion codigo={c} pendiente={corregir.isPending} onCancelar={() => setAccion(null)}
                onConfirmar={(nuevo, motivo) => corregir.mutate({ id: c.id, valor: nuevo, motivo })} />}
          </Fila>
        ))}
        {vigentes.length === 0 && <Fila etiqueta="Códigos">Sin códigos registrados.</Fila>}
      </dl>
      <ErrorOperacion error={agregar.error ?? retirar.error ?? corregir.error} />
      {puede("codigos.gestionar") && (
        <form className="flex flex-wrap gap-2 items-end" onSubmit={(e: FormEvent) => { e.preventDefault(); agregar.mutate(); }}>
          <div>
            <label className="form-label" htmlFor="codigo-tipo">Tipo</label>
            <select id="codigo-tipo" required className="glass-input" value={tipoCodigoId} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Seleccionar…</option>
              {tipos.data?.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="codigo-valor">Valor</label>
            <input id="codigo-valor" required className="glass-input" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <button className="btn-glass" disabled={agregar.isPending}>Agregar código</button>
        </form>
      )}
    </Seccion>
  );
}
