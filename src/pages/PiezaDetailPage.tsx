import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, Check, Pencil, Send, X as IconoX } from "lucide-react";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { ErrorOperacion } from "../components/f0/Comun";
import { CamposFaltantes, FormularioFicha } from "../components/f0/FormularioFicha";
import { Auditoria } from "../components/f2/Auditoria";
import { Codigos } from "../components/f2/Codigos";
import { Documentos } from "../components/f2/Documentos";
import { CamposPorGrupo, Fila, FormMotivo, Seccion } from "../components/f2/FichaComun";
import { Fotografias } from "../components/f2/Fotografias";
import { SugerenciasIA } from "../components/f2/SugerenciasIA";
import { Tenencia } from "../components/f2/Tenencia";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { usePermisos } from "../hooks/usePermisos";
import { api, extraerErroresApi } from "../lib/api";
import type { AccionEstadoFicha, DatosFichaV3, FichaCompleta, HistorialItem } from "../types";

const EXTRAS: Record<string, string> = { codigos_externos: "Código del museo", fotografias: "Fotografía" };

/** Si el backend rechaza el cambio de estado por campos faltantes (V10), dice cuáles en vez de repetir el mensaje. */
function ErrorRevision({ error }: { error: unknown }) {
  const catalogo = useCatalogoFicha();
  const errores = extraerErroresApi(error);
  if (!errores.length || errores.some((e) => !e.campo)) return <ErrorOperacion error={error} />;
  const nombre = (c: string) => catalogo.data?.find((x) => x.clave === c)?.etiqueta ?? EXTRAS[c] ?? c;
  return <p role="alert" className="rounded-card border border-rojo p-3 text-sm">
    No se puede enviar a revisión. Falta: {[...new Set(errores.map((e) => nombre(e.campo!)))].join(", ")}.</p>;
}

function Historial({ titulo, items, texto }: { titulo: string; items: HistorialItem[]; texto: (h: HistorialItem) => string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gris-2 mb-1.5">{titulo}</h4>
      <ul className="text-sm space-y-1">
        {items.map((h) => <li key={h.id}>{texto(h)} <span className="text-gris-2">· {new Date(h.fecha).toLocaleString("es-PE")}{h.motivo ? ` · ${h.motivo}` : ""}</span></li>)}
        {items.length === 0 && <li className="text-gris-2">Sin registros.</li>}
      </ul>
    </div>
  );
}

/** F2: ficha de la pieza sobre el contrato v3. Una sola consulta (ficha-completa) trae códigos, tenencia,
 * fotos, documentos e historiales; cada sección vuelve a pedirla después de un cambio. */
export function PiezaDetailPage() {
  const { piezaId = "" } = useParams<{ piezaId: string }>();
  const { puede } = usePermisos();
  const navigate = useNavigate();
  const creada = Boolean((useLocation().state as { creada?: boolean } | null)?.creada);
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);
  const [conflicto, setConflicto] = useState(false);

  const ficha = useQuery({ queryKey: ["ficha", piezaId],
    queryFn: async () => (await api.get<FichaCompleta>(`/piezas/${piezaId}/ficha-completa`)).data });
  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: ["ficha", piezaId] });
    queryClient.invalidateQueries({ queryKey: ["piezas"] });
  };

  const estado = useMutation({
    mutationFn: async (datos: { accion: AccionEstadoFicha; motivoRechazo?: string }) => api.patch(`/piezas/${piezaId}/estado-ficha`, datos),
    onSuccess: () => { setRechazando(false); recargar(); },
  });
  const baja = useMutation({
    mutationFn: async (motivo: string) => api.post(`/piezas/${piezaId}/baja`, { motivo }),
    onSuccess: () => { recargar(); navigate("/coleccion"); },
  });

  async function guardarEdicion(datos: DatosFichaV3) {
    try {
      await api.patch(`/piezas/${piezaId}`, { ...datos, version: ficha.data!.version });
      setEditando(false);
      recargar();
    } catch (e) {
      // Bloqueo optimista: otra persona guardó la ficha después de que la abrimos.
      if (extraerErroresApi(e).some((x) => x.codigo === "conflicto_version")) setConflicto(true);
      throw e;
    }
  }

  if (ficha.isPending) return <p role="status">Cargando ficha…</p>;
  if (ficha.isError) return <ErrorOperacion error={ficha.error} />;
  const p = ficha.data;
  const denominacion = String(p.campos.denominacion ?? "") || "(sin denominación)";
  const puedeEnviar = puede("piezas.editar") && (p.estadoFicha === "borrador" || p.estadoFicha === "rechazada");
  const puedeAprobar = puede("piezas.aprobar_ficha") && p.estadoFicha === "en_revision";
  const boton = "!min-h-0 !py-1.5 !px-3 !text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/coleccion" className="text-sm text-azul hover:underline">← Volver a Colección</Link>
          <h1 className="font-accent italic font-semibold text-2xl text-rojo mt-1">{denominacion}</h1>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <ChipEstadoFicha estado={p.estadoFicha} />
            {p.codigos.filter((c) => c.bloqueado).map((c) => <span key={c.id} className="chip font-mono">{c.valor}</span>)}
          </div>
          {p.estadoFicha === "rechazada" && p.motivoRechazo && <p className="text-sm text-rojo mt-1.5 max-w-md">Motivo del rechazo: {p.motivoRechazo}</p>}
          {creada && <p role="status" className="text-sm mt-1.5">Pieza registrada. La ficha está en borrador.</p>}
        </div>

        <div className="glass-panel-sm p-4 space-y-3 w-full sm:w-auto sm:max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gris-2">Revisión de la ficha</p>
          <div className="flex flex-wrap gap-2">
            {puede("piezas.editar") && !editando && <button type="button" className={`btn-glass ${boton}`} onClick={() => { setConflicto(false); setEditando(true); }}><Pencil size={16} aria-hidden="true" /> Editar</button>}
            {puedeEnviar && <button type="button" className={`btn-glass ${boton}`} disabled={estado.isPending} onClick={() => estado.mutate({ accion: "enviar_revision" })}><Send size={16} aria-hidden="true" /> Enviar a revisión</button>}
            {puedeAprobar && <>
              <button type="button" className={`btn-primary ${boton}`} disabled={estado.isPending} onClick={() => estado.mutate({ accion: "aprobar" })}><Check size={16} aria-hidden="true" /> Aprobar</button>
              <button type="button" className={`btn-glass ${boton} !border-rojo !text-rojo`} onClick={() => setRechazando(true)}><IconoX size={16} aria-hidden="true" /> Rechazar</button>
            </>}
            {puede("piezas.editar") && p.estadoFicha === "en_revision" && <button type="button" className={`btn-glass ${boton}`} disabled={estado.isPending} onClick={() => estado.mutate({ accion: "volver_borrador" })}>Volver a borrador</button>}
            {puede("piezas.baja") && <button type="button" className={`btn-glass ${boton} !border-rojo !text-rojo`} onClick={() => setDandoDeBaja(true)}><Archive size={16} aria-hidden="true" /> Dar de baja</button>}
          </div>
          {rechazando && <FormMotivo etiqueta="Justificación del rechazo" boton="Rechazar" pendiente={estado.isPending}
            onConfirmar={(m) => estado.mutate({ accion: "rechazar", motivoRechazo: m })} onCancelar={() => setRechazando(false)} />}
          {dandoDeBaja && <FormMotivo etiqueta="Motivo de la baja (la pieza no se borra; se puede restaurar)" boton="Confirmar baja" pendiente={baja.isPending}
            onConfirmar={(m) => baja.mutate(m)} onCancelar={() => setDandoDeBaja(false)} />}
          <ErrorRevision error={estado.error} />
          <ErrorOperacion error={baja.error} />
        </div>
      </div>

      {p.incompleta && <CamposFaltantes incompleta camposFaltantes={p.camposFaltantes} />}

      <div className="grid lg:grid-cols-[22rem_1fr] gap-6 items-start">
        <Fotografias piezaId={piezaId} fotos={p.fotografias} alCambiar={recargar} />

        <div className="space-y-6">
          {editando ? (
            <section className="space-y-3" aria-label="Editar ficha">
              {conflicto && ( // el mensaje lo muestra el formulario; aquí solo la salida
                <button type="button" className="btn-primary" onClick={() => { setEditando(false); setConflicto(false); recargar(); }}>
                  Recargar la ficha con los cambios de la otra persona
                </button>
              )}
              <FormularioFicha key={p.version} onGuardar={guardarEdicion}
                inicial={{ campos: p.campos, listas: Object.fromEntries(Object.entries(p.listas).map(([k, v]) => [k, v.map((x) => x.id)])) }} />
              <button type="button" className="btn-glass" onClick={() => setEditando(false)}>Cancelar edición</button>
            </section>
          ) : (
            <CamposPorGrupo pieza={p} excluir={["ubicacion_actual_id", "estado_pieza_id"]} />
          )}

          <SugerenciasIA pieza={p} alCambiar={recargar} />
          <Codigos piezaId={piezaId} codigos={p.codigosDetalle} alCambiar={recargar} />
          <Tenencia piezaId={piezaId} tenencias={p.tenencias} alCambiar={recargar} />

          <Documentos piezaId={piezaId} documentos={p.documentos} alCambiar={recargar} />

          <Seccion titulo="Ubicación y estado" acciones={<Link to="/ubicacion-y-movimientos" className="text-sm text-azul hover:underline">Registrar un traslado →</Link>}>
            <dl>
              <Fila etiqueta="Ubicación actual">{p.etiquetas.ubicacion_actual_id ?? "Sin ubicación"}</Fila>
              <Fila etiqueta="Estado de la pieza">{p.etiquetas.estado_pieza_id ?? "Sin estado"}</Fila>
            </dl>
            <Historial titulo="Movimientos" items={p.movimientos} texto={(h) => `${h.ubicacionAnterior ?? "—"} → ${h.ubicacionNueva ?? "—"}`} />
            <Historial titulo="Cambios de estado" items={p.estados} texto={(h) => `${h.estadoAnterior ?? "—"} → ${h.estadoNuevo ?? "—"}`} />
          </Seccion>

          <Seccion titulo="Registro">
            <dl>
              <Fila etiqueta="Registrada por">{p.creadoPor?.nombre ?? "—"} · {new Date(p.creadoEn).toLocaleString("es-PE")}</Fila>
              <Fila etiqueta="Último cambio">{p.actualizadoPor?.nombre ?? "—"} · {new Date(p.actualizadoEn).toLocaleString("es-PE")}</Fila>
            </dl>
          </Seccion>

          <Auditoria pieza={p} />
        </div>
      </div>
    </div>
  );
}
