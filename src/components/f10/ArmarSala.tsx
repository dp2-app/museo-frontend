import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Download, Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import { api, extraerErroresApi, extraerMensajeError } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { SalaSugerida } from "../../types";
import { EsperaIA } from "./EsperaIA";
import { EstadoIndiceSalas } from "./EstadoIndiceSalas";
import { CatalogoSala, SelectorVistaSala, type VistaSala } from "./CatalogoSala";

const EJEMPLOS = ["Navidad andina", "Máscaras de madera de Puno", "Toros de Pucará"];
const MENSAJES_ESPERA = ["Buscando piezas del tema", "Comparando por significado y por texto", "Ordenando por relevancia", "Redactando la propuesta"];
type Pedido = { pedido: string; cantidad: number; ignorarCondiciones: string[] };

/** El mensaje, el ranking y las condiciones los decide la API; la persona decide su selección. */
export function ArmarSala() {
  const { puede } = usePermisos();
  // `?tema=` llega desde Colección o desde una ficha: se precarga, pero la persona decide cuándo pedir la propuesta.
  const [direccion] = useSearchParams();
  const [pedido, setPedido] = useState(() => direccion.get("tema")?.slice(0, 300) ?? "");
  const [cantidad, setCantidad] = useState("20");
  const [sala, setSala] = useState<SalaSugerida | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [vista, setVista] = useState<VistaSala>("catalogo");
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const tituloResultado = useRef<HTMLHeadingElement>(null);
  const tema = useRef<HTMLTextAreaElement>(null);
  const cantidadValida = cantidad.trim() !== "" && Number.isInteger(Number(cantidad)) && Number(cantidad) >= 10 && Number(cantidad) <= 30;

  const sugerir = useMutation({
    mutationFn: async (datos: Pedido) => (await api.post<SalaSugerida>("/ia/salas/sugerir", datos)).data,
    onMutate: () => { setError(null); setConfirmacion(""); },
    onSuccess: (data, datos) => {
      setSala(data);
      setIgnoradas(datos.ignorarCondiciones);
      setElegidas(new Set(data.piezas.map((p) => p.piezaId)));
    },
    onError: (err) => setError(extraerErroresApi(err).some((e) => e.codigo === "ia_no_configurada")
      ? "El servicio de IA aún no está configurado. Pide a la administración que lo active y vuelve a intentarlo."
      : extraerMensajeError(err)),
  });

  useEffect(() => { if (sala) tituloResultado.current?.focus({ preventScroll: true }); }, [sala]);

  const exportar = useMutation({
    mutationFn: async () => {
      if (!sala) return 0;
      const piezaIds = sala.piezas.filter((p) => elegidas.has(p.piezaId)).map((p) => p.piezaId);
      const { data } = await api.post(`/ia/salas/${sala.sugerenciaId}/exportar`, { piezaIds }, { responseType: "blob" });
      const url = URL.createObjectURL(data as Blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "sala-propuesta.xlsx";
      enlace.click();
      URL.revokeObjectURL(url);
      return piezaIds.length;
    },
    onMutate: () => { setError(null); setConfirmacion(""); },
    onSuccess: (total) => setConfirmacion(`Se descargó la selección: ${total} ${total === 1 ? "pieza" : "piezas"}.`),
    onError: async (err) => {
      const respuesta = (err as { response?: { data?: unknown } }).response;
      if (respuesta?.data instanceof Blob) {
        try { respuesta.data = JSON.parse(await respuesta.data.text()); } catch { /* conserva el mensaje genérico */ }
      }
      setError(extraerMensajeError(err));
    },
  });

  function onSugerir(e: FormEvent) {
    e.preventDefault();
    if (cantidadValida && pedido.trim()) sugerir.mutate({ pedido: pedido.trim(), cantidad: Number(cantidad), ignorarCondiciones: [] });
  }

  function quitarCondicion(clave: string) {
    if (!sala) return;
    // Usa el pedido de la propuesta: editar el borrador no debe cambiarla al quitar una condición.
    sugerir.mutate({ pedido: sala.pedido, cantidad: sala.cantidad, ignorarCondiciones: [...ignoradas, clave] });
  }

  function alternar(id: string) {
    setConfirmacion("");
    setElegidas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(id)) nuevas.delete(id); else nuevas.add(id);
      return nuevas;
    });
  }

  const todas = sala !== null && sala.piezas.length > 0 && elegidas.size === sala.piezas.length;

  return <section className="sala-builder" aria-label="Proponer piezas para una sala">
    <form onSubmit={onSugerir} className="sala-composer glass-panel" aria-busy={sugerir.isPending}>
      <div className="sala-composer-heading"><span className="sala-composer-icon"><Sparkles size={24} aria-hidden="true" /></span><div><p className="catalog-eyebrow">Una idea, muchas conexiones</p><h2>¿Qué historia quieres contar?</h2></div></div>
      <p className="sala-introduction">Describe un tema, una región o un estilo. Encontraremos las piezas que mejor dialogan con tu idea; tú eliges las que formarán parte de la sala.</p>
      <label className="form-label" htmlFor="sala-tema">Tema o estilo</label>
      <textarea id="sala-tema" ref={tema} rows={3} aria-describedby="sala-tema-ayuda" value={pedido} disabled={sugerir.isPending || exportar.isPending}
        onChange={(e) => setPedido(e.target.value)} placeholder="Por ejemplo, una sala sobre celebraciones y tradiciones de los Andes…" maxLength={500} className="glass-input sala-theme-input" required />
      <div className="sala-examples"><span id="sala-tema-ayuda">Puedes inspirarte en:</span><div>{EJEMPLOS.map((ejemplo) => <button type="button" key={ejemplo} disabled={sugerir.isPending || exportar.isPending} onClick={() => { setPedido(ejemplo); tema.current?.focus(); }}>{ejemplo}</button>)}</div></div>
      <div className="sala-composer-footer">
        <div className="sala-quantity"><label className="form-label" htmlFor="sala-cantidad">Cantidad de piezas</label><div className="sala-quantity-controls">
          <input id="sala-cantidad" type="number" min={10} max={30} step={1} required value={cantidad} onChange={(e) => setCantidad(e.target.value)} disabled={sugerir.isPending || exportar.isPending} className="glass-input" aria-invalid={!cantidadValida} aria-describedby="sala-cantidad-ayuda" />
          <div role="group" aria-label="Cantidades frecuentes">{[10, 20, 30].map((n) => <button type="button" key={n} aria-pressed={cantidad === String(n)} disabled={sugerir.isPending || exportar.isPending} onClick={() => setCantidad(String(n))}>{n}</button>)}</div>
        </div><p id="sala-cantidad-ayuda" className={cantidadValida ? "text-gris-2" : "text-rojo-oscuro"}>{cantidadValida ? "Entre 10 y 30. El resultado depende del catálogo." : "Escribe un número entero entre 10 y 30."}</p></div>
        <div className="sala-submit"><button type="submit" disabled={sugerir.isPending || exportar.isPending || !pedido.trim() || !cantidadValida} className="btn-primary">{sugerir.isPending ? <Loader2 size={20} aria-hidden="true" className="motion-safe:animate-spin" /> : <Sparkles size={20} aria-hidden="true" />}{sugerir.isPending ? "Buscando piezas…" : "Proponer piezas"}</button><p>{!pedido.trim() ? "Escribe un tema o elige un ejemplo para empezar." : "La propuesta no modifica las fichas del inventario."}</p></div>
      </div>
    </form>

    {puede("ia.indexar") && <details className="sala-index-details"><summary><span>Estado de la búsqueda por significado</span><ChevronDown size={18} aria-hidden="true" /></summary><EstadoIndiceSalas /></details>}
    {error && <div className="sala-error" role="alert"><TriangleAlert size={20} aria-hidden="true" /><div><p>{error}</p><p className="text-sm">Tu tema y tu selección se conservan. Puedes volver a intentarlo.</p></div></div>}
    {confirmacion && <p role="status" className="sala-confirmation"><Check size={20} aria-hidden="true" />{confirmacion}</p>}
    {sugerir.isPending && <EsperaIA mensajes={MENSAJES_ESPERA} filas={6} />}

    {sala && !sugerir.isPending && <section className="sala-proposal" aria-labelledby="sala-resultado-titulo">
      <div className="sala-proposal-intro"><div><p className="catalog-eyebrow">Tu propuesta de sala</p><h2 id="sala-resultado-titulo" ref={tituloResultado} tabIndex={-1}>{sala.piezas.length > 0 ? `${sala.piezas.length} ${sala.piezas.length === 1 ? "pieza para" : "piezas para"} tu sala` : "Exploremos otra idea"}</h2><p className="sala-request">{sala.pedido}</p></div><span className="sala-proposal-badge"><Sparkles size={16} aria-hidden="true" />Propuesta de IA</span></div>
      <div className="sala-proposal-message"><p>{sala.mensaje}</p>{sala.pocasPiezas && !sala.fueraDeTema && <p className="text-sm text-gris-2">Hay menos piezas de las solicitadas. Puedes ampliar el tema o quitar una condición.</p>}<details><summary>Cómo se generó esta propuesta</summary><p>Búsqueda {sala.busqueda === "hibrida" ? "por significado y por texto" : "por texto"}. Modelo: {sala.modeloUsado}. El puntaje de afinidad permite comparar las piezas; no representa una probabilidad.</p></details></div>
      {!!sala.condiciones?.length && <div className="sala-conditions" aria-label="Condiciones del pedido"><span>Condiciones del tema:</span>{sala.condiciones.map((c) => c.estado === "aplicado" ? <span key={c.clave} className="chip">{c.etiqueta}{c.valor ? `: ${c.valor}` : ""}<button type="button" aria-label={`Quitar la condición ${c.etiqueta}`} disabled={exportar.isPending} onClick={() => quitarCondicion(c.clave)}><X size={16} aria-hidden="true" /></button></span> : <span key={c.clave} className="sala-condition-removed">{c.etiqueta} (quitada)</span>)}</div>}
      {!sala.fueraDeTema && sala.piezas.length > 0 ? <>
        <div className="sala-selection-toolbar"><div className="sala-selection-summary"><p role="status" aria-live="polite"><strong>{elegidas.size}</strong> de {sala.piezas.length} piezas elegidas</p><button type="button" disabled={exportar.isPending} onClick={() => { setElegidas(todas ? new Set() : new Set(sala.piezas.map((p) => p.piezaId))); setConfirmacion(""); }}>{todas ? "Quitar selección" : "Elegir todas"}</button></div><SelectorVistaSala vista={vista} onCambiar={setVista} /><button type="button" className="btn-primary" onClick={() => exportar.mutate()} disabled={exportar.isPending || elegidas.size === 0 || !puede("reportes.exportar")}><Download size={18} aria-hidden="true" />{exportar.isPending ? "Exportando…" : "Exportar selección a Excel"}</button></div>
        {(!puede("reportes.exportar") || elegidas.size === 0) && <p className="text-sm text-gris-2">{!puede("reportes.exportar") ? "Tu cuenta puede revisar la propuesta. Para descargarla necesitas permiso de exportación." : "Elige al menos una pieza para exportar la selección."}</p>}
        <fieldset disabled={exportar.isPending} className="min-w-0"><legend className="sr-only">Elegir piezas para la sala</legend><CatalogoSala piezas={sala.piezas} elegidas={elegidas} vista={vista} onAlternar={alternar} /></fieldset>
      </> : <button type="button" className="btn-glass" onClick={() => tema.current?.focus()}>Revisar el tema</button>}
    </section>}
  </section>;
}
