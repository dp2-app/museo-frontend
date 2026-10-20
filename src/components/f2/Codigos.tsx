import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { useTiposCodigo } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import type { CodigoV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { Fila, FormMotivo, Seccion } from "./FichaComun";

/** F1 en la ficha: códigos del museo (RF-03, RF-04). El código I queda bloqueado al guardarse (RN-02). */
export function Codigos({ piezaId, codigos, alCambiar }: { piezaId: string; codigos: CodigoV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const tipos = useTiposCodigo();
  const [tipoCodigoId, setTipo] = useState("");
  const [valor, setValor] = useState("");
  const [retirando, setRetirando] = useState<string | null>(null);

  const agregar = useMutation({
    mutationFn: async () => api.post(`/piezas/${piezaId}/codigos`, { tipoCodigoId, valor: valor.trim() }),
    onSuccess: () => { setValor(""); alCambiar(); },
  });
  const retirar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => api.post(`/piezas/${piezaId}/codigos/${id}/baja`, { motivo }),
    onSuccess: () => { setRetirando(null); alCambiar(); },
  });
  const vigentes = codigos.filter((c) => c.vigente);

  return (
    <Seccion titulo="Códigos del museo">
      <dl>
        {vigentes.map((c) => (
          <Fila key={c.id} etiqueta={c.tipoNombre}>
            <span className="font-mono">{c.valor}</span>
            {c.bloqueado && <Lock size={14} className="inline ml-1.5 text-gris-2" aria-label="No se puede modificar (RN-02)" />}
            {c.nota && <span className="block text-xs text-gris-2">{c.nota}</span>}
            {puede("codigos.gestionar") && !c.bloqueado && (retirando === c.id
              ? <FormMotivo etiqueta="Motivo para retirar el código" boton="Retirar" pendiente={retirar.isPending}
                  onConfirmar={(motivo) => retirar.mutate({ id: c.id, motivo })} onCancelar={() => setRetirando(null)} />
              : <button type="button" className="btn-danger-text ml-2 text-xs" onClick={() => setRetirando(c.id)}>Retirar</button>)}
          </Fila>
        ))}
        {vigentes.length === 0 && <Fila etiqueta="Códigos">Sin códigos registrados.</Fila>}
      </dl>
      <ErrorOperacion error={agregar.error ?? retirar.error} />
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
