import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, FileText, Plus } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { useValoresLista } from "../../hooks/useCatalogosF2";
import { api } from "../../lib/api";
import type { DocumentoV3 } from "../../types";
import { ErrorOperacion } from "../f0/Comun";
import { FormMotivo, Seccion } from "./FichaComun";

const vacio = { url: "", titulo: "", tipoDocumentoId: "", fechaDocumento: "", descripcion: "" };

/** RF-11: documentos asociados a la pieza (ficha de ingreso, actas, contratos de comodato). Como las fotos,
 * el archivo vive en el almacén y aquí se registra su URL; retirar uno es baja lógica con motivo. */
export function Documentos({ piezaId, documentos, alCambiar }: { piezaId: string; documentos: DocumentoV3[]; alCambiar: () => void }) {
  const { puede } = usePermisos();
  const tipos = useValoresLista("tipo_documento");
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(vacio);
  const [retirando, setRetirando] = useState<string | null>(null);
  const tipo = (id: string | null) => tipos.data?.find((t) => t.id === id)?.etiqueta;

  const agregar = useMutation({
    mutationFn: async () => api.post(`/piezas/${piezaId}/documentos`, {
      url: nuevo.url.trim(), titulo: nuevo.titulo.trim() || null, tipoDocumentoId: nuevo.tipoDocumentoId || null,
      fechaDocumento: nuevo.fechaDocumento || null, descripcion: nuevo.descripcion.trim() || null,
    }),
    onSuccess: () => { setNuevo(vacio); setAbierto(false); alCambiar(); },
  });
  const retirar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => api.post(`/piezas/${piezaId}/documentos/${id}/baja`, { motivo }),
    onSuccess: () => { setRetirando(null); alCambiar(); },
  });
  const campo = (k: keyof typeof vacio) => ({ value: nuevo[k], onChange: (e: { target: { value: string } }) => setNuevo({ ...nuevo, [k]: e.target.value }) });

  return (
    <Seccion titulo="Documentos" acciones={puede("documentos.gestionar") && !abierto
      ? <button type="button" className="btn-glass !min-h-0 !py-1 !px-3 !text-sm" onClick={() => setAbierto(true)}><Plus size={16} aria-hidden="true" /> Asociar documento</button> : undefined}>
      <ul className="space-y-3 text-sm">
        {documentos.map((d) => (
          <li key={d.id} className="border-b border-linea pb-3 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex gap-2">
                <FileText size={18} className="shrink-0 text-azul mt-0.5" aria-hidden="true" />
                <div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-azul hover:underline">
                    {d.titulo || tipo(d.tipoDocumentoId) || "Documento"} <ExternalLink size={13} className="inline" aria-label="(se abre en otra pestaña)" />
                  </a>
                  <p className="text-xs text-gris-2">
                    {[tipo(d.tipoDocumentoId), d.fechaDocumento && new Date(`${d.fechaDocumento}T00:00:00`).toLocaleDateString("es-PE")].filter(Boolean).join(" · ")}
                    {d.restringidoUso && <span className="chip ml-2 !py-0">Uso restringido</span>}
                  </p>
                  {d.descripcion && <p className="mt-1">{d.descripcion}</p>}
                </div>
              </div>
              {puede("documentos.gestionar") && retirando !== d.id &&
                <button type="button" className="btn-danger-text text-xs" onClick={() => setRetirando(d.id)}>Retirar</button>}
            </div>
            {retirando === d.id && <FormMotivo etiqueta="Motivo para retirar el documento" boton="Retirar" pendiente={retirar.isPending}
              onConfirmar={(motivo) => retirar.mutate({ id: d.id, motivo })} onCancelar={() => setRetirando(null)} />}
          </li>
        ))}
        {documentos.length === 0 && <li className="text-gris-2">Sin documentos asociados.</li>}
      </ul>
      <ErrorOperacion error={agregar.error ?? retirar.error} />
      {abierto && (
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e: FormEvent) => { e.preventDefault(); agregar.mutate(); }}>
          <div className="md:col-span-2">
            <label className="form-label" htmlFor="doc-url">URL del documento (ya subido)</label>
            <input id="doc-url" type="url" required placeholder="https://…" className="glass-input" {...campo("url")} />
          </div>
          <div>
            <label className="form-label" htmlFor="doc-titulo">Título</label>
            <input id="doc-titulo" className="glass-input" {...campo("titulo")} />
          </div>
          <div>
            <label className="form-label" htmlFor="doc-tipo">Tipo</label>
            <select id="doc-tipo" className="glass-input" {...campo("tipoDocumentoId")}>
              <option value="">Sin indicar</option>
              {tipos.data?.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="doc-fecha">Fecha del documento</label>
            <input id="doc-fecha" type="date" className="glass-input" {...campo("fechaDocumento")} />
          </div>
          <div>
            <label className="form-label" htmlFor="doc-descripcion">Descripción</label>
            <input id="doc-descripcion" className="glass-input" {...campo("descripcion")} />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button type="button" className="btn-glass" onClick={() => { setAbierto(false); setNuevo(vacio); }}>Cancelar</button>
            <button className="btn-primary" disabled={agregar.isPending}>Asociar</button>
          </div>
        </form>
      )}
    </Seccion>
  );
}
