import { useState } from "react";
import { api } from "../lib/api";
import { ubicacionesPlanas, type Ficha, type Ubicacion } from "../lib/ficha";
import { usePermisos } from "../hooks/usePermisos";
import { Aviso, ErrorConsulta } from "./FichaComun";
import { useOperacion, useRecurso } from "../lib/recursosFicha";

interface Tipo { id: string; clave: string; nombre: string; }
interface Regimen extends Tipo { ingresaInventarioPermanente: boolean; requiereContraparte: boolean; requiereFechas: boolean; }
interface Tenencia { regimenId: string; contraparteId?: string | null; fechaInicio?: string | null; fechaFin?: string | null; condicionesContractuales?: string | null; restringidoPublicacion?: boolean; documentoReferencia?: string | null; }
export interface Complementos { codigos: { tipoCodigoId: string; valor: string }[]; ubicacionInicialId?: string; tenencia?: Tenencia; }

/** Solo compone el alta atómica de F2. Las reglas de código y tenencia las resuelve F1. */
export function AltaComplementos({ onChange }: { onChange: (v: Complementos) => void }) {
  const { puede, sesion } = usePermisos(); const [datos, setDatos] = useState<Complementos>({ codigos: [] });
  const tipos = useRecurso<Tipo[]>("tipos-codigo", "/tipos-codigo", puede("codigos.gestionar"));
  const regimenes = useRecurso<Regimen[]>("regimenes", "/regimenes", puede("tenencias.gestionar"));
  const propietarios = useRecurso<Tipo[]>("propietarios", "/propietarios", puede("tenencias.gestionar") && puede("propietarios.ver"));
  const veUbicacion = Boolean(sesion) && !sesion?.camposOcultos.includes("ubicacion_actual_id");
  const ubicaciones = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", veUbicacion);
  function cambiar(v: Complementos) { setDatos(v); onChange(v); }
  const tenencia = datos.tenencia;
  function cambiarTenencia(v: Partial<Tenencia>) { if (tenencia) cambiar({ ...datos, tenencia: { ...tenencia, ...v } }); }
  return <details className="space-y-3"><summary className="cursor-pointer font-semibold">Códigos, tenencia y ubicación inicial (opcionales)</summary>
    <ErrorConsulta error={tipos.error || regimenes.error || propietarios.error || ubicaciones.error} />
    {puede("codigos.gestionar") && <div className="space-y-2">{datos.codigos.map((c, i) => <div className="flex flex-wrap gap-2" key={i}>
      <label>Tipo de código<select aria-label="Tipo de código" className="glass-input" value={c.tipoCodigoId} onChange={(e) => cambiar({ ...datos, codigos: datos.codigos.map((x, j) => i === j ? { ...x, tipoCodigoId: e.target.value } : x) })}><option value="">Seleccionar…</option>{tipos.data?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
      <label>Valor del código<input className="glass-input" value={c.valor} onChange={(e) => cambiar({ ...datos, codigos: datos.codigos.map((x, j) => i === j ? { ...x, valor: e.target.value } : x) })} /></label>
      <button className="btn-glass" onClick={() => cambiar({ ...datos, codigos: datos.codigos.filter((_, j) => i !== j) })}>Quitar código</button></div>)}<button className="btn-glass" onClick={() => cambiar({ ...datos, codigos: [...datos.codigos, { tipoCodigoId: "", valor: "" }] })}>Añadir código inicial</button></div>}
    {puede("tenencias.gestionar") && <div className="grid gap-3 sm:grid-cols-2"><label>Régimen de tenencia<select aria-label="Régimen de tenencia" className="glass-input" value={tenencia?.regimenId ?? ""} onChange={(e) => cambiar({ ...datos, tenencia: e.target.value ? { regimenId: e.target.value } : undefined })}><option value="">Propiedad predeterminada</option>{regimenes.data?.filter((r) => r.ingresaInventarioPermanente).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label>
      {tenencia && <><label>Contraparte<select aria-label="Contraparte" className="glass-input" value={tenencia.contraparteId ?? ""} onChange={(e) => cambiarTenencia({ contraparteId: e.target.value || null })}><option value="">Sin contraparte</option>{propietarios.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <label>Fecha de inicio<input type="date" className="glass-input" value={tenencia.fechaInicio ?? ""} onChange={(e) => cambiarTenencia({ fechaInicio: e.target.value || null })} /></label><label>Fecha de fin<input type="date" className="glass-input" value={tenencia.fechaFin ?? ""} onChange={(e) => cambiarTenencia({ fechaFin: e.target.value || null })} /></label>
        <label>Condiciones contractuales<textarea className="glass-input" value={tenencia.condicionesContractuales ?? ""} onChange={(e) => cambiarTenencia({ condicionesContractuales: e.target.value || null })} /></label><label>Documento de referencia<input className="glass-input" value={tenencia.documentoReferencia ?? ""} onChange={(e) => cambiarTenencia({ documentoReferencia: e.target.value || null })} /></label><label><input type="checkbox" checked={tenencia.restringidoPublicacion ?? false} onChange={(e) => cambiarTenencia({ restringidoPublicacion: e.target.checked })} />Publicación restringida</label></>}
    </div>}
    {veUbicacion && <label className="block">Ubicación inicial<select aria-label="Ubicación inicial" className="glass-input" value={datos.ubicacionInicialId ?? ""} onChange={(e) => cambiar({ ...datos, ubicacionInicialId: e.target.value || undefined })}><option value="">Sin asignar</option>{ubicacionesPlanas(ubicaciones.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}</select></label>}
  </details>;
}
export function CodigosFicha({ pieza }: { pieza: Ficha }) {
  const { puede } = usePermisos(); const tipos = useRecurso<Tipo[]>("tipos-codigo", "/tipos-codigo", puede("codigos.gestionar"));
  const [tipo, setTipo] = useState(""); const [valor, setValor] = useState(""); const op = useOperacion();
  return <div className="space-y-3"><h3 className="font-semibold">Identificadores</h3><ul>{pieza.codigos.map((c) => <li key={c.id}>{c.tipoNombre}: {c.valor}{c.bloqueado && " · protegido"}</li>)}</ul>{pieza.codigos.length === 0 && <p>Sin códigos registrados.</p>}
    {!puede("codigos.gestionar") && <button className="btn-glass" disabled title="Tu rol solo puede consultar los códigos">Registrar código</button>}
    <p>Tenencia: {pieza.tenenciaVigente?.regimenNombre || "Sin registro"}{pieza.tenenciaVigente?.restringidoPublicacion && " · publicación restringida"}</p>
    <Aviso mensaje={op.mensaje} /><ErrorConsulta error={tipos.error} />{puede("codigos.gestionar") && <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); op.ejecutar(async () => { await api.post(`/piezas/${pieza.id}/codigos`, { tipoCodigoId: tipo, valor: valor.trim() }); setValor(""); }); }}><label>Tipo de identificador<select aria-label="Tipo de identificador" className="glass-input" required value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Seleccionar…</option>{tipos.data?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label><label>Nuevo código<input className="glass-input" required value={valor} onChange={(e) => setValor(e.target.value)} /></label><button className="btn-glass" disabled={op.pendiente || !valor.trim()}>Registrar código</button></form>}
  </div>;
}
