import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ubicacionesPlanas, type Ficha, type Ubicacion } from "../lib/ficha";
import { usePermisos } from "../hooks/usePermisos";
import { Aviso, ErrorConsulta } from "./FichaComun";
import { useRecurso } from "../lib/recursosFicha";
import { useConsultaF0 } from "../hooks/useConsultaF0";
import { puedeCorregir } from "../lib/f1";
import type { Codigo, Tenencia as TenenciaF1 } from "../types/f1";
import { AgregarCodigo } from "./f1/CampoCodigo";
import { CorregirCodigo } from "./f1/CorregirCodigo";
import { CambiarRegimen } from "./f1/CambiarRegimen";

interface Tipo { id: string; clave: string; nombre: string; }
interface Regimen extends Tipo { ingresaInventarioPermanente: boolean; requiereContraparte: boolean; requiereFechas: boolean; }
interface Tenencia { regimenId: string; contraparteId?: string | null; fechaInicio?: string | null; fechaFin?: string | null; condicionesContractuales?: string | null; restringidoPublicacion?: boolean; documentoReferencia?: string | null; }
export interface Complementos { codigos: { tipoCodigoId: string; valor: string }[]; ubicacionInicialId?: string; tenencia?: Tenencia; }

const MENSAJE_CODIGO = "Selecciona el tipo de código y escribe su valor.";
const filaIncompleta = (c: { tipoCodigoId: string; valor: string }) => !c.tipoCodigoId !== !c.valor.trim();

/** Solo compone el alta atómica de F2. Las reglas de código y tenencia las resuelve F1; aquí solo se evita enviar
 * una fila de código a medias (#94) o un régimen sin la contraparte que exige (#95). Una fila vacía se ignora. */
export function AltaComplementos({ onChange }: { onChange: (v: Complementos, problemas: string[]) => void }) {
  const { puede, sesion } = usePermisos(); const [datos, setDatos] = useState<Complementos>({ codigos: [] });
  const tipos = useRecurso<Tipo[]>("tipos-codigo", "/tipos-codigo", puede("codigos.gestionar"));
  const regimenes = useRecurso<Regimen[]>("regimenes", "/regimenes", puede("tenencias.gestionar"));
  const propietarios = useRecurso<Tipo[]>("propietarios", "/propietarios", puede("tenencias.gestionar") && puede("propietarios.ver"));
  const veUbicacion = Boolean(sesion) && !sesion?.camposOcultos.includes("ubicacion_actual_id");
  const ubicaciones = useRecurso<Ubicacion[]>("ubicaciones", "/ubicaciones", veUbicacion);
  const tenencia = datos.tenencia;
  const regimen = regimenes.data?.find((r) => r.id === tenencia?.regimenId);
  const faltaContraparte = Boolean(regimen?.requiereContraparte && !tenencia?.contraparteId);
  function cambiar(v: Complementos) {
    setDatos(v);
    const r = regimenes.data?.find((x) => x.id === v.tenencia?.regimenId);
    const problemas = [...v.codigos.flatMap((c, i) => filaIncompleta(c) ? [`Código inicial ${i + 1}: falta el tipo o el valor`] : []),
      ...(r?.requiereContraparte && !v.tenencia?.contraparteId ? [`El régimen «${r.nombre}» exige indicar la contraparte`] : [])];
    onChange({ ...v, codigos: v.codigos.filter((c) => c.tipoCodigoId || c.valor.trim()) }, problemas);
  }
  function cambiarTenencia(v: Partial<Tenencia>) { if (tenencia) cambiar({ ...datos, tenencia: { ...tenencia, ...v } }); }
  return <details className="space-y-3"><summary className="cursor-pointer font-semibold">Códigos, tenencia y ubicación inicial (opcionales)</summary>
    <ErrorConsulta error={tipos.error || regimenes.error || propietarios.error || ubicaciones.error} />
    {puede("codigos.gestionar") && <div className="space-y-2">{datos.codigos.map((c, i) => <div className="flex flex-wrap gap-2" key={i}>
      <label>Tipo de código *<select aria-label="Tipo de código" aria-required="true" aria-invalid={filaIncompleta(c) && !c.tipoCodigoId} className="glass-input" value={c.tipoCodigoId} onChange={(e) => cambiar({ ...datos, codigos: datos.codigos.map((x, j) => i === j ? { ...x, tipoCodigoId: e.target.value } : x) })}><option value="">Seleccionar…</option>{tipos.data?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
      <label>Valor del código *<input aria-required="true" aria-invalid={filaIncompleta(c) && !c.valor.trim()} className="glass-input" value={c.valor} onChange={(e) => cambiar({ ...datos, codigos: datos.codigos.map((x, j) => i === j ? { ...x, valor: e.target.value } : x) })} /></label>
      <button type="button" className="btn-glass" onClick={() => cambiar({ ...datos, codigos: datos.codigos.filter((_, j) => i !== j) })}>Quitar código</button>
      {filaIncompleta(c) && <p role="alert" className="w-full text-rojo">{MENSAJE_CODIGO}</p>}</div>)}<button type="button" className="btn-glass" onClick={() => cambiar({ ...datos, codigos: [...datos.codigos, { tipoCodigoId: "", valor: "" }] })}>Añadir código inicial</button></div>}
    {puede("tenencias.gestionar") && <div className="grid gap-3 sm:grid-cols-2"><label>Régimen de tenencia<select aria-label="Régimen de tenencia" className="glass-input" value={tenencia?.regimenId ?? ""} onChange={(e) => cambiar({ ...datos, tenencia: e.target.value ? { regimenId: e.target.value } : undefined })}><option value="">Propiedad predeterminada</option>{regimenes.data?.filter((r) => r.ingresaInventarioPermanente).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label>
      {tenencia && <><label>Contraparte{regimen?.requiereContraparte && " *"}<select aria-label="Contraparte" aria-required={regimen?.requiereContraparte} aria-invalid={faltaContraparte} className="glass-input" value={tenencia.contraparteId ?? ""} onChange={(e) => cambiarTenencia({ contraparteId: e.target.value || null })}><option value="">{regimen?.requiereContraparte ? "Seleccionar…" : "Sin contraparte"}</option>{propietarios.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        {faltaContraparte && <span role="alert" className="block text-rojo">El régimen «{regimen?.nombre}» exige indicar la contraparte.</span>}</label>
        <label>Fecha de inicio<input type="date" className="glass-input" value={tenencia.fechaInicio ?? ""} onChange={(e) => cambiarTenencia({ fechaInicio: e.target.value || null })} /></label><label>Fecha de fin<input type="date" className="glass-input" value={tenencia.fechaFin ?? ""} onChange={(e) => cambiarTenencia({ fechaFin: e.target.value || null })} /></label>
        <label>Condiciones contractuales<textarea className="glass-input" value={tenencia.condicionesContractuales ?? ""} onChange={(e) => cambiarTenencia({ condicionesContractuales: e.target.value || null })} /></label><label>Documento de referencia<input className="glass-input" value={tenencia.documentoReferencia ?? ""} onChange={(e) => cambiarTenencia({ documentoReferencia: e.target.value || null })} /></label><label><input type="checkbox" checked={tenencia.restringidoPublicacion ?? false} onChange={(e) => cambiarTenencia({ restringidoPublicacion: e.target.checked })} />Publicación restringida</label></>}
    </div>}
    {veUbicacion && <label className="block">Ubicación inicial<select aria-label="Ubicación inicial" className="glass-input" value={datos.ubicacionInicialId ?? ""} onChange={(e) => cambiar({ ...datos, ubicacionInicialId: e.target.value || undefined })}><option value="">Sin asignar</option>{ubicacionesPlanas(ubicaciones.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}</select></label>}
  </details>;
}
/** Identificadores y tenencia de la ficha (H01, museo-frontend#43): usa los componentes de F1 para validar en vivo,
 * sugerir el correlativo, corregir por excepción (RF-05) y cambiar el régimen (RF-09). Las reglas son del backend. */
export function CodigosFicha({ pieza, codigosIniciales, tenenciasIniciales }: { pieza: Ficha; codigosIniciales?: Codigo[]; tenenciasIniciales?: TenenciaF1[] }) {
  const { puede } = usePermisos(); const cache = useQueryClient();
  const codigos = useConsultaF0({ queryKey: ["f1", "codigos-pieza", pieza.id], queryFn: async () => (await api.get<Codigo[]>(`/piezas/${pieza.id}/codigos`)).data,
    ...(codigosIniciales ? { initialData: codigosIniciales, staleTime: 5 * 60_000 } : {}) });
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null); const [mensaje, setMensaje] = useState("");
  // Solo lo de F1 y lo de esta pieza (ficha, auditoría, códigos, tenencias); no toda la caché.
  const listo = async (texto: string) => { setMensaje(texto); setCorrigiendo(null);
    await cache.invalidateQueries({ predicate: (q) => q.queryKey[0] === "f1" || JSON.stringify(q.queryKey).includes(pieza.id) }); };
  const lista = codigos.data ?? pieza.codigos.map((c) => ({ ...c, tipoCodigoId: "", valorNormalizado: "" }) as Codigo);
  return <div className="space-y-3"><h3 className="font-semibold">Identificadores</h3>
    <ul className="space-y-2">{lista.map((c) => <li key={c.id}><div className="flex flex-wrap items-center gap-2">
      <span>{c.tipoNombre}: <span className="font-mono">{c.valor}</span>{c.bloqueado && " · protegido"}</span>
      {codigos.data && puedeCorregir(c, puede) && corrigiendo !== c.id && <button type="button" className="btn-glass" onClick={() => { setMensaje(""); setCorrigiendo(c.id); }}>Corregir {c.valor}</button>}</div>
      {corrigiendo === c.id && <CorregirCodigo piezaId={pieza.id} codigo={c} alCancelar={() => setCorrigiendo(null)} alTerminar={() => listo("Código corregido.")} />}</li>)}</ul>
    {lista.length === 0 && <p>Sin códigos registrados.</p>}
    {!puede("codigos.gestionar") && <button className="btn-glass" disabled title="Tu rol solo puede consultar los códigos">Agregar código</button>}
    <Aviso mensaje={mensaje} /><ErrorConsulta error={codigos.error} />
    <AgregarCodigo piezaId={pieza.id} alGuardar={() => listo("Código agregado.")} />
    <p>Tenencia: {pieza.tenenciaVigente?.regimenNombre || "Sin registro"}{pieza.tenenciaVigente?.restringidoPublicacion && " · publicación restringida"}</p>
    <CambiarRegimen piezaId={pieza.id} regimenActual={pieza.tenenciaVigente?.regimen} restringidoActual={pieza.tenenciaVigente?.restringidoPublicacion ?? false} historialInicial={tenenciasIniciales} alGuardar={() => listo("Régimen de tenencia actualizado.")} />
  </div>;
}
