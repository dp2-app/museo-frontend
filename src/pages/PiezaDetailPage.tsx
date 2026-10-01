import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, extraerMensajeError } from "../lib/api";
import { ADMINISTRADOR, CATALOGADOR, CONSERVACION, GESTOR_COLECCIONES } from "../lib/secciones";
import { useCamposFicha, valorCampo } from "../lib/camposFicha";
import { aplanarUbicaciones } from "../lib/ubicaciones";
import { ChipEstadoFicha } from "../components/ChipEstadoFicha";
import { FormularioFicha } from "../components/FormularioFicha";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../lib/cloudinary";
import type { AccionEstadoFicha, CampoFicha, Coleccion, Movimiento, Pagina, PiezaDetalle, RegistroAuditoria, UbicacionFisica, ValorVocabulario } from "../types";

export function PiezaDetailPage() {
  const { piezaId } = useParams<{ piezaId: string }>();
  const { rol } = useAuth();
  const queryClient = useQueryClient();
  const catalogo = useCamposFicha();
  const visibles = new Set(catalogo.data?.map(c => c.clave));
  const puedeEditar = [ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR].includes(rol ?? "");
  const puedeMover = [ADMINISTRADOR, GESTOR_COLECCIONES, CONSERVACION].includes(rol ?? "");
  const [error, setError] = useState<string | null>(null);
  const [tipoCodigo, setTipoCodigo] = useState("");
  const [valorCodigo, setValorCodigo] = useState("");
  const [urlFoto, setUrlFoto] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [rechazo, setRechazo] = useState("");
  const [editar, setEditar] = useState(false);
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const piezaQuery = useQuery({ queryKey: ["pieza", piezaId], queryFn: async () => (await api.get<PiezaDetalle>(`/piezas/${piezaId}`)).data });
  const cols = useQuery({ queryKey: ["colecciones"], queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { page_size: 500 } })).data });
  const ubicaciones = useQuery({ queryKey: ["ubicaciones"], queryFn: async () => (await api.get<UbicacionFisica[]>("/ubicaciones")).data, enabled: visibles.has("ubicacion_actual_id") });
  const vocab = useQuery({ queryKey: ["vocabularios-ficha", catalogo.data?.map(c => c.vocabularioTipo)], queryFn: async () => {
    const tipos = [...new Set((catalogo.data ?? []).map(c => c.vocabularioTipo).filter((v): v is string => !!v))];
    const values = await Promise.all(tipos.map(async t => [t,(await api.get<ValorVocabulario[]>(`/vocabularios/${t}`)).data] as const));
    return Object.fromEntries(values);
  }, enabled: !!catalogo.data });
  const tipos = useQuery({ queryKey: ["vocabularios", "tipo_identificador"], queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/tipo_identificador")).data, enabled: visibles.has("codigos_externos") });
  const movimientos = useQuery({ queryKey: ["movimientos", piezaId], queryFn: async () => (await api.get<Movimiento[]>(`/piezas/${piezaId}/movimientos`)).data, enabled: visibles.has("ubicacion_actual_id") && visibles.has("movimientos") });
  const auditoria = useQuery({ queryKey: ["auditoria", piezaId], queryFn: async () => (await api.get<RegistroAuditoria[]>(`/piezas/${piezaId}/auditoria`)).data });
  const invalidar = () => { setError(null); queryClient.invalidateQueries(); };
  const accion = useMutation({ mutationFn: async (params: { path: string; body: unknown; method?: "patch" | "post" }) => params.method === "patch" ? api.patch(params.path, params.body) : api.post(params.path, params.body), onSuccess: invalidar, onError: e => setError(extraerMensajeError(e)) });
  const foto = useMutation({ mutationFn: async (file: File) => {
    const url = await subirImagenACloudinary(file);
    return api.post(`/piezas/${piezaId}/fotografias`, { url });
  }, onSuccess: invalidar, onError: e => setError(e instanceof Error ? e.message : extraerMensajeError(e)) });
  const cambiarEstado = (a: AccionEstadoFicha) => accion.mutate({ path: `/piezas/${piezaId}/estado-ficha`, method: "patch", body: { accion: a, motivoRechazo: a === "rechazar" ? rechazo : undefined } });
  if (piezaQuery.isLoading || catalogo.isLoading) return <p>Cargando ficha...</p>;
  if (piezaQuery.isError || catalogo.isError || !piezaQuery.data) return <p role="alert" className="text-rojo">No se pudo cargar la ficha o no tienes permiso para verla.</p>;
  const pieza = piezaQuery.data;
  const grupos = [...new Set((catalogo.data ?? []).filter(c => !["codigos_externos","fotografias","movimientos","documentos"].includes(c.clave)).map(c => c.grupo))];
  const formato = (c: CampoFicha) => {
    const v = valorCampo(pieza, c);
    if (c.clave === "coleccion_id") return cols.data?.items.find(x => x.id === v)?.nombre ?? "—";
    if (c.clave === "ubicacion_actual_id") return aplanarUbicaciones(ubicaciones.data ?? []).find(x => x.id === v)?.etiqueta ?? "—";
    if (c.vocabularioTipo && c.clave.endsWith("_id")) return vocab.data?.[c.vocabularioTipo]?.find(x => x.id === v)?.valor ?? "—";
    return v == null || v === "" ? "—" : String(v);
  };
  const submitCodigo = (e: FormEvent) => { e.preventDefault(); accion.mutate({ path: `/piezas/${piezaId}/codigos-externos`, body: { tipoIdentificador: tipoCodigo, valor: valorCodigo } }); };
  return <div className="space-y-6">
    <Link to="/coleccion" className="text-azul hover:underline">← Volver a Colección</Link>
    <div className="flex flex-wrap justify-between gap-4"><div>
      <h2 className="font-accent italic text-2xl text-rojo">{visibles.has("denominacion") ? pieza.denominacion ?? "Ficha de pieza" : "Ficha de pieza"}</h2>
      {visibles.has("estado_ficha") && pieza.estadoFicha && <ChipEstadoFicha estado={pieza.estadoFicha} />}
      <span className="chip ml-2">{pieza.informacionCompleta ? "Información completa" : "Información incompleta"}</span>
    </div>{puedeEditar && <button className="btn-glass" onClick={() => setEditar(!editar)}>{editar ? "Cerrar edición" : "Editar ficha"}</button>}</div>
    {!!pieza.camposFaltantes?.length && <div className="glass-panel-sm p-4"><p className="font-semibold">Campos pendientes</p><ul>{pieza.camposFaltantes.map(k => <li key={k}>{catalogo.data?.find(c => c.clave === k)?.etiqueta ?? k}</li>)}</ul></div>}
    {error && <p role="alert" className="text-rojo">{error}</p>}
    {editar && puedeEditar && <FormularioFicha key={pieza.id} pieza={pieza} onSaved={() => setEditar(false)} />}
    {visibles.has("estado_ficha") && <section className="glass-panel p-5 space-y-3"><h3 className="section-title">Flujo de aprobación</h3><div className="flex flex-wrap gap-3">
      <button className="btn-glass" disabled={accion.isPending || ![ADMINISTRADOR,CATALOGADOR].includes(rol ?? "") || !["borrador","rechazada"].includes(pieza.estadoFicha ?? "")} onClick={() => cambiarEstado("enviar_revision")}>Enviar a revisión</button>
      <button className="btn-primary" disabled={accion.isPending || ![ADMINISTRADOR,GESTOR_COLECCIONES].includes(rol ?? "") || pieza.estadoFicha !== "en_revision"} onClick={() => cambiarEstado("aprobar")}>Aprobar</button>
      <button className="btn-glass" disabled={accion.isPending || ![ADMINISTRADOR,GESTOR_COLECCIONES].includes(rol ?? "") || pieza.estadoFicha !== "en_revision"} onClick={() => setMostrarRechazo(!mostrarRechazo)}>Rechazar</button>
    </div>{mostrarRechazo && <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); cambiarEstado("rechazar"); }}><label className="form-label">Motivo de rechazo<textarea className="glass-input" required value={rechazo} onChange={e => setRechazo(e.target.value)} /></label><button className="btn-primary">Confirmar rechazo</button></form>}</section>}
    <div className="grid lg:grid-cols-2 gap-5">{grupos.map(g => <section key={g} className="glass-panel p-5"><h3 className="section-title mb-3">{g}</h3><dl>
      {catalogo.data?.filter(c => c.grupo === g && !["codigos_externos","fotografias","movimientos","documentos"].includes(c.clave)).map(c => <div key={c.id} className="grid grid-cols-3 gap-3 py-2 border-b border-linea"><dt className="text-gris-2">{c.etiqueta}</dt><dd className="col-span-2 whitespace-pre-wrap">{formato(c)}</dd></div>)}
    </dl></section>)}</div>
    {visibles.has("codigos_externos") && <section className="glass-panel p-5 space-y-3"><h3 className="section-title">Identificadores</h3><ul>{(pieza.codigosExternos ?? []).map(c => <li key={c.id}>{tipos.data?.find(t => t.id === c.tipoIdentificador)?.valor}: <span className="font-mono">{c.valor}</span>{c.bloqueadoEdicion && " 🔒"}</li>)}</ul>
      {puedeEditar && <form className="flex flex-wrap gap-3" onSubmit={submitCodigo}><label className="form-label">Tipo de identificador<select className="glass-input" required value={tipoCodigo} onChange={e => setTipoCodigo(e.target.value)}><option value="">Seleccionar...</option>{tipos.data?.map(t => <option key={t.id} value={t.id}>{t.valor}</option>)}</select></label><label className="form-label">Valor<input className="glass-input" required value={valorCodigo} onChange={e => setValorCodigo(e.target.value)} /></label><button className="btn-glass">Añadir código</button></form>}
    </section>}
    {visibles.has("fotografias") && <section className="glass-panel p-5 space-y-3"><h3 className="section-title">Fotografías</h3><div className="flex flex-wrap gap-3">{(pieza.fotografias ?? []).map(f => <img key={f.id} src={f.url} alt="Fotografía de la pieza" className="w-48 h-48 object-contain rounded-card" />)}</div>
      {puedeEditar && (cloudinaryConfigurado() ? <label className="form-label">Agregar fotografía<input type="file" accept="image/*" disabled={foto.isPending} onChange={e => { const file = e.target.files?.[0]; if (file) foto.mutate(file); }} /></label> : <form className="flex gap-3" onSubmit={e => { e.preventDefault(); accion.mutate({ path: `/piezas/${piezaId}/fotografias`, body: { url: urlFoto } }); }}><label className="form-label">URL de fotografía<input className="glass-input" type="url" required value={urlFoto} onChange={e => setUrlFoto(e.target.value)} /></label><button className="btn-glass">Añadir fotografía</button></form>)}
    </section>}
    {visibles.has("ubicacion_actual_id") && visibles.has("movimientos") && <section className="glass-panel p-5 space-y-3"><h3 className="section-title">Historial de movimientos</h3><ul>{movimientos.data?.map(m => <li key={m.id}>{m.motivo ?? "Sin motivo"}</li>)}</ul>
      {puedeMover && <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); accion.mutate({ path: `/piezas/${piezaId}/movimientos`, body: { ubicacionNuevaId: ubicacion, motivo } }); }}><label className="form-label">Nueva ubicación<select className="glass-input" required value={ubicacion} onChange={e => setUbicacion(e.target.value)}><option value="">Seleccionar...</option>{aplanarUbicaciones(ubicaciones.data ?? []).map(u => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}</select></label><label className="form-label">Motivo<input className="glass-input" value={motivo} onChange={e => setMotivo(e.target.value)} /></label><button className="btn-glass">Registrar movimiento</button></form>}
    </section>}
    {visibles.has("documentos") && !!pieza.documentos?.length && <section className="glass-panel p-5"><h3 className="section-title">Documentos</h3><ul>{pieza.documentos.map(d => <li key={d.id}>{d.tipoDocumento}: {d.referencia}</li>)}</ul></section>}
    {visibles.has("observaciones") && pieza.observaciones && puedeEditar && <button className="btn-glass" disabled={accion.isPending} onClick={() => accion.mutate({ path: `/ia/extraccion-observaciones/${piezaId}`, body: {} })}>Extraer datos de observaciones</button>}
    <section className="glass-panel p-5"><h3 className="section-title">Auditoría</h3><ul className="text-sm mt-3">{auditoria.data?.map((a,i) => <li key={i}>{a.campo}: {a.valorAnterior ?? "—"} → {a.valorNuevo ?? "—"}</li>)}</ul></section>
  </div>;
}
