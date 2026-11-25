import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, ImagePlus, LoaderCircle, PackagePlus, Trash2 } from "lucide-react";
import { api, erroresPorCampo, extraerMensajeError } from "../lib/api";
import { registrarPiezaConFotos, validarUrlFoto, type FotoAlta, type ProgresoAlta } from "../lib/altaPieza";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../lib/cloudinary";
import { prepararFoto } from "../lib/fotoCamara";
import { useCatalogoFicha } from "../hooks/useCatalogoFicha";
import { usePermisos } from "../hooks/usePermisos";
import { DialogoMuseo } from "./DialogoMuseo";
import { AltaComplementos, type Complementos } from "./IdentificacionFicha";
import { FormularioFicha } from "./f0/FormularioFicha";
import { FotoPieza } from "./SistemaVisual";
import type { DatosFichaV3 } from "../types";
import type { Ficha } from "../lib/ficha";

const ETAPAS = [
  { titulo: "Ficha", detalle: "Describe la pieza" },
  { titulo: "Identificación", detalle: "Códigos y ubicación" },
  { titulo: "Fotografías", detalle: "Dale una imagen" },
  { titulo: "Confirmación", detalle: "Revisa y registra" },
];

export function RegistroPiezaModal({ alCerrar }: { alCerrar: () => void }) {
  const cache = useQueryClient();
  const navegar = useNavigate();
  const { puede } = usePermisos();
  const catalogo = useCatalogoFicha();
  const [etapa, setEtapa] = useState(1);
  const [alcanzada, setAlcanzada] = useState(1);
  const [datos, setDatos] = useState<DatosFichaV3>({ campos: {}, listas: {} });
  const [complementos, setComplementos] = useState<Complementos>({ codigos: [] });
  const [problemas, setProblemas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<FotoAlta[]>([]);
  const [principal, setPrincipal] = useState("");
  const [url, setUrl] = useState("");
  const [errorFoto, setErrorFoto] = useState("");
  const [preparando, setPreparando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [completada, setCompletada] = useState(false);
  const [guardado, setGuardado] = useState<ProgresoAlta>({ fotos: {} });
  const progreso = useRef<ProgresoAlta>({ fotos: {} });
  const objetos = useRef(new Set<string>());
  const galeria = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const subidaDisponible = cloudinaryConfigurado();
  useEffect(() => { const urls = objetos.current; return () => { urls.forEach((u) => URL.revokeObjectURL(u)); }; }, []);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [etapa]);

  function irA(numero: number) { setEtapa(numero); setAlcanzada((v) => Math.max(v, numero)); }
  function sincronizarProgreso() { const actual = progreso.current; setGuardado({ ...actual, fotos: Object.fromEntries(Object.entries(actual.fotos).map(([k, v]) => [k, { ...v }])) }); }
  const registrar = useMutation({
    mutationFn: () => registrarPiezaConFotos(progreso.current, fotos, principal, {
      crear: async () => (await api.post<Ficha>("/piezas", { ...datos, ...complementos })).data,
      subir: subirImagenACloudinary,
      agregarFoto: async (piezaId, foto) => (await api.post<{ id: string }>(`/piezas/${piezaId}/fotografias`, { ...foto, restringidoUso: false })).data,
      elegirPrincipal: (piezaId, fotoId) => api.patch(`/piezas/${piezaId}/fotografias/${fotoId}`, { esPrincipal: true }),
      alAvanzar: (texto) => { sincronizarProgreso(); setMensaje(texto); },
    }),
    onMutate: () => { setError(""); setErrores({}); },
    onSuccess: async () => { sincronizarProgreso(); setCompletada(true); setMensaje("Pieza registrada correctamente."); await cache.invalidateQueries(); },
    onError: (e) => {
      sincronizarProgreso();
      setError(extraerMensajeError(e).replace(/\s*\(pieza [0-9a-f-]{36}\)\.?/gi, " en otra pieza. Verifica el código para continuar.")); setMensaje("");
      if (!progreso.current.piezaId) {
        const porCampo = erroresPorCampo(e); setErrores(porCampo);
        if (Object.keys(porCampo).some((k) => catalogo.data?.some((c) => c.clave === k))) irA(1);
        else if (Object.keys(porCampo).some((k) => /codigo|tenencia|regimen|contraparte|ubicacion/i.test(k))) irA(2);
      }
    },
  });
  const ocupado = registrar.isPending || preparando;
  const creada = !!guardado.piezaId;
  const nombre = String(datos.campos.denominacion || "Nueva pieza");
  const fotoPrincipal = fotos.find((f) => f.clave === principal) ?? fotos[0];
  function agregar(foto: FotoAlta) { setFotos((v) => [...v, foto]); setPrincipal((v) => v || foto.clave); setErrorFoto(""); }
  function agregarUrl(e?: FormEvent) {
    e?.preventDefault(); const problema = validarUrlFoto(url); setErrorFoto(problema ?? "");
    if (problema) return false;
    const limpia = url.trim();
    if (fotos.some((f) => f.url === limpia)) { setErrorFoto("Esta fotografía ya está en la selección."); return false; }
    agregar({ clave: crypto.randomUUID(), url: limpia, vista: limpia, formato: new URL(limpia).pathname.toLowerCase().endsWith(".png") ? "png" : "jpg" }); setUrl(""); return true;
  }
  async function elegirArchivos(e: ChangeEvent<HTMLInputElement>) {
    const elegidos = [...(e.target.files ?? [])]; e.target.value = "";
    if (!elegidos.length) return;
    setPreparando(true); setErrorFoto(""); const fallos: string[] = [];
    for (const original of elegidos) {
      try {
        const archivo = await prepararFoto(original); const vista = URL.createObjectURL(archivo); objetos.current.add(vista);
        agregar({ clave: crypto.randomUUID(), archivo, vista, formato: "jpg" });
      } catch (e) { fallos.push(`${original.name}: ${e instanceof Error ? e.message : "No se pudo preparar la imagen."}`); }
    }
    setErrorFoto(fallos.join(" ")); setPreparando(false);
  }
  function quitarFoto(foto: FotoAlta) {
    if (progreso.current.fotos[foto.clave]?.id) return;
    const restantes = fotos.filter((f) => f.clave !== foto.clave); setFotos(restantes);
    if (principal === foto.clave) setPrincipal(restantes[0]?.clave ?? "");
    if (objetos.current.delete(foto.vista)) URL.revokeObjectURL(foto.vista);
  }
  function terminar() { const id = progreso.current.piezaId; alCerrar(); if (id && puede("piezas.ver")) navegar(`/coleccion/${id}`); }
  function confirmar() {
    if (ocupado || completada || problemas.length) return;
    registrar.mutate();
  }
  const datoLegible = (clave: string) => {
    const valor = datos.campos[clave];
    if (valor == null || valor === "") return "Sin registrar";
    return String(valor);
  };
  return <DialogoMuseo titulo={completada ? "Pieza registrada" : "Registrar pieza"} ceja="INVENTARIO · REGISTRO INDIVIDUAL" descripcion="Construye una ficha clara, con sus identificadores y fotografías." icono={PackagePlus}
    etapas={ETAPAS} etapa={etapa} alCambiarEtapa={irA} puedeVolver={(n) => !completada && (creada ? n === 3 : n < etapa && n <= alcanzada)} bloqueado={ocupado} alCerrar={alCerrar}>
    <div className="importacion-scroll" ref={scroll}>
      {!completada && <div className="importacion-intro"><span>Paso {etapa} de 4</span><h3>{["Cuéntanos sobre la pieza", "Ubícala e identifica su procedencia", "Una imagen para reconocerla", creada ? "Completa las fotografías pendientes" : "Comprueba tu nueva ficha"][etapa - 1]}</h3><p>{["Completa los datos disponibles. El asterisco indica lo que necesitas para continuar.", "Puedes añadir códigos y elegir la ubicación inicial. La tenencia se registra según el régimen elegido.", "Añade imágenes y elige la fotografía principal. También puedes completar este paso más adelante.", creada ? "Los datos de la pieza ya están guardados. Al reintentar solo se completarán las fotografías pendientes." : "Revisa el resumen. La pieza se creará como borrador para su revisión habitual."][etapa - 1]}</p></div>}
      {error && <div className="importacion-error" role="alert"><strong>{creada ? "La pieza está registrada; falta completar las fotografías" : "Revisa la información para continuar"}</strong><p>{error}</p>{creada && <button type="button" className="underline" onClick={() => irA(3)}>Revisar fotografías pendientes</button>}</div>}
      <div hidden={etapa !== 1 || completada} className="registro-pieza-form"><FormularioFicha formId="registro-ficha" inicial={datos} ocultarAccion mensajeExito="" textoIntro="Completa la información de la pieza. Los campos con * son obligatorios." errores={errores}
        onChange={(v) => { setDatos(v); setErrores({}); }} onGuardar={async (v) => { setDatos(v); setError(""); irA(2); }} /></div>
      <div hidden={etapa !== 2 || completada}><AltaComplementos plegable={false} onChange={(v, p) => { setComplementos(v); setProblemas(p); }} />{problemas.length > 0 && <ul className="importacion-error" role="alert">{problemas.map((p) => <li key={p}>{p}</li>)}</ul>}</div>
      {etapa === 3 && !completada && <section aria-label="Fotografías de la nueva pieza" className="space-y-5">
        {puede("fotos.gestionar") ? <>
          <div className="importacion-archivo"><ImagePlus size={35} aria-hidden="true" /><h4>La fotografía cuenta su historia</h4><p>Elige imágenes nítidas de la pieza completa y de sus detalles.</p>
            <input ref={galeria} type="file" multiple accept="image/jpeg,image/png" disabled={ocupado || !subidaDisponible} aria-label="Fotografías de la galería" className="sr-only" tabIndex={-1} onChange={(e) => { void elegirArchivos(e); }} />
            <input ref={camara} type="file" accept="image/*" capture="environment" disabled={ocupado || !subidaDisponible} aria-label="Tomar fotografía de la pieza" className="sr-only" tabIndex={-1} onChange={(e) => { void elegirArchivos(e); }} />
            <div className="flex flex-wrap gap-3 justify-center"><button type="button" className="btn-primary" disabled={ocupado || !subidaDisponible} onClick={() => galeria.current?.click()}><ImagePlus size={18} aria-hidden="true" />Elegir imágenes</button><button type="button" className="btn-glass" disabled={ocupado || !subidaDisponible} onClick={() => camara.current?.click()}><Camera size={18} aria-hidden="true" />Tomar foto</button></div>
            {!subidaDisponible && <p>La subida de archivos necesita que se configure el almacenamiento de imágenes. Puedes añadir una fotografía mediante su enlace HTTPS.</p>}
          </div>
          <form onSubmit={agregarUrl} aria-label="Añadir fotografía por enlace" className="space-y-3"><label className="block text-sm font-semibold">Enlace de la fotografía<input type="url" className="glass-input w-full mt-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/fotografia.jpg" aria-label="Enlace de la fotografía" /></label><button type="submit" className="btn-glass" disabled={!url.trim() || ocupado}>Añadir fotografía</button></form>
          {preparando && <p role="status" className="importacion-estado"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Preparando las fotografías…</p>}
          {errorFoto && <p role="alert" className="importacion-error">{errorFoto}</p>}
          <div className="registro-pieza-fotos">{fotos.map((foto, i) => <article key={foto.clave} className="registro-pieza-foto"><FotoPieza url={foto.vista} nombre={`${nombre} (${i + 1})`} ampliable /><div><label><input type="radio" aria-label={`Usar fotografía ${i + 1} como principal`} name="registro-foto-principal" checked={principal === foto.clave} onChange={() => setPrincipal(foto.clave)} />{principal === foto.clave ? "Fotografía principal" : "Usar como principal"}</label>
            {guardado.fotos[foto.clave]?.id ? <p className="text-azul">Guardada en la ficha</p> : <button type="button" className="inline-flex items-center gap-2 text-rojo underline min-h-11" aria-label={`Quitar fotografía ${i + 1}`} onClick={() => quitarFoto(foto)}><Trash2 size={16} aria-hidden="true" />Quitar</button>}</div></article>)}</div>
        </> : <p>Tu rol puede registrar la pieza. Una persona con permiso de fotografías podrá añadir sus imágenes desde la ficha.</p>}
      </section>}
      {etapa === 4 && !completada && <>
        {fotoPrincipal && <div className="registro-foto-confirmacion"><FotoPieza url={fotoPrincipal.vista} nombre={nombre} /></div>}
        <dl className="registro-pieza-resumen"><div><dt>Denominación</dt><dd>{nombre}</dd></div><div><dt>Fotografías seleccionadas</dt><dd>{fotos.length}</dd></div><div><dt>Códigos iniciales</dt><dd>{complementos.codigos.length ? complementos.codigos.map((c) => c.valor).join(" · ") : "Sin código inicial"}</dd></div><div><dt>Estado de la ficha</dt><dd>Borrador</dd></div><div className="sm:col-span-2"><dt>Descripción</dt><dd>{datoLegible("descripcion")}</dd></div></dl>
        {!fotos.length && <p className="importacion-nota">La pieza quedará sin fotografía. Podrás añadirla después desde la ficha.</p>}
      </>}
      {completada && <section className="importacion-resultado" aria-label="Resultado del registro"><CheckCircle2 size={50} strokeWidth={1.4} aria-hidden="true" /><h3>{nombre}</h3><p>La pieza se registró correctamente como borrador.</p>{fotoPrincipal && <div className="registro-foto-confirmacion"><FotoPieza url={fotoPrincipal.vista} nombre={nombre} /></div>}<p>{fotos.length} {fotos.length === 1 ? "fotografía guardada" : "fotografías guardadas"}. Puedes consultar y completar la ficha.</p></section>}
    </div>
    <footer className="importacion-pie"><div><p role="status">{ocupado ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" />{preparando ? "Preparando imágenes…" : mensaje}</> : completada ? "Pieza registrada correctamente." : creada ? "La pieza ya existe; el reintento conserva sus datos." : etapa === 3 ? `${fotos.length} ${fotos.length === 1 ? "fotografía seleccionada" : "fotografías seleccionadas"}. Se guardarán al confirmar.` : "Los datos se guardarán al confirmar el registro."}</p></div><div>
      {completada ? <button className="btn-primary" disabled={ocupado} onClick={terminar}>{puede("piezas.ver") ? "Ver ficha" : "Finalizar"}</button> : <>
        <button type="button" className="btn-glass" disabled={ocupado} onClick={etapa === 1 ? alCerrar : creada && etapa === 3 ? terminar : () => irA(etapa === 4 && creada ? 3 : etapa - 1)}>{etapa === 1 ? "Cancelar" : creada && etapa === 3 ? "Ver ficha" : "Atrás"}</button>
        {etapa === 1 ? <button type="submit" form="registro-ficha" className="btn-primary" disabled={ocupado || catalogo.isPending || catalogo.isError}>Continuar a identificación</button> : etapa === 2 ? <button type="button" className="btn-primary" disabled={ocupado || problemas.length > 0} onClick={() => { setError(""); irA(3); }}>Continuar a fotografías</button> : etapa === 3 ? <button type="button" className="btn-primary" disabled={ocupado} onClick={() => { if (url.trim() && !agregarUrl()) return; irA(4); }}>Revisar y confirmar</button> : <button type="button" className="btn-primary" disabled={ocupado || problemas.length > 0} onClick={confirmar}>{registrar.isPending ? "Registrando…" : creada ? "Reintentar fotografías" : "Confirmar registro"}</button>}
      </>}
    </div></footer>
  </DialogoMuseo>;
}
