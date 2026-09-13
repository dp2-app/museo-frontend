import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../lib/cloudinary";
import type {
  Coleccion,
  CodigoExterno,
  Fotografia,
  Movimiento,
  Pagina,
  PiezaDetalle,
  RegistroAuditoria,
  UbicacionFisica,
  ValorVocabulario,
} from "../types";

function aplanarUbicaciones(nodos: UbicacionFisica[], nivel = 0): { id: string; etiqueta: string }[] {
  return nodos.flatMap((n) => [
    { id: n.id, etiqueta: `${"— ".repeat(nivel)}${n.nombre}` },
    ...aplanarUbicaciones(n.hijos ?? [], nivel + 1),
  ]);
}

// Ficha inspirada en el formato de registro que el cliente mostró como referencia
// (surdoc.cl): secciones tituladas con línea de acento y filas etiqueta/valor.
function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="glass-panel p-5 space-y-4">
      <h3 className="section-title pb-2 border-b-2 border-indigo-500/70">{titulo}</h3>
      {children}
    </section>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm py-1.5 border-b border-white/50 last:border-0">
      <dt className="text-ink-400 font-medium">{etiqueta}</dt>
      <dd className="col-span-2 text-ink-800">{children}</dd>
    </div>
  );
}

export function PiezaDetailPage() {
  const { piezaId } = useParams<{ piezaId: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [fotoActiva, setFotoActiva] = useState(0);

  const piezaQuery = useQuery({
    queryKey: ["pieza", piezaId],
    queryFn: async () => (await api.get<PiezaDetalle>(`/piezas/${piezaId}`)).data,
  });

  const ubicacionesQuery = useQuery({
    queryKey: ["ubicaciones"],
    queryFn: async () => (await api.get<UbicacionFisica[]>("/ubicaciones")).data,
  });

  const tiposIdentificadorQuery = useQuery({
    queryKey: ["vocabularios", "tipo_identificador"],
    queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/tipo_identificador")).data,
  });

  const categoriasQuery = useQuery({
    queryKey: ["vocabularios", "categoria"],
    queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/categoria")).data,
  });

  const estadosConservacionQuery = useQuery({
    queryKey: ["vocabularios", "estado_conservacion"],
    queryFn: async () => (await api.get<ValorVocabulario[]>("/vocabularios/estado_conservacion")).data,
  });

  const coleccionesQuery = useQuery({
    queryKey: ["colecciones"],
    queryFn: async () => (await api.get<Pagina<Coleccion>>("/colecciones", { params: { pageSize: 100 } })).data,
  });

  const movimientosQuery = useQuery({
    queryKey: ["movimientos", piezaId],
    queryFn: async () => (await api.get<Movimiento[]>(`/piezas/${piezaId}/movimientos`)).data,
  });

  const auditoriaQuery = useQuery({
    queryKey: ["auditoria", piezaId],
    queryFn: async () => (await api.get<RegistroAuditoria[]>(`/piezas/${piezaId}/auditoria`)).data,
  });

  const invalidarPieza = () => {
    queryClient.invalidateQueries({ queryKey: ["pieza", piezaId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria", piezaId] });
  };

  // --- Edición de campos básicos ---
  const [denominacion, setDenominacion] = useState("");
  const editar = useMutation({
    mutationFn: async () => (await api.patch(`/piezas/${piezaId}`, { denominacion })).data,
    onSuccess: invalidarPieza,
    onError: (err) => setError(extraerMensajeError(err)),
  });

  // --- Código externo ---
  const [tipoIdentificador, setTipoIdentificador] = useState("");
  const [valorCodigo, setValorCodigo] = useState("");
  const agregarCodigo = useMutation({
    mutationFn: async () =>
      (
        await api.post<CodigoExterno>(`/piezas/${piezaId}/codigos-externos`, {
          tipoIdentificador,
          valor: valorCodigo,
        })
      ).data,
    onSuccess: () => {
      setValorCodigo("");
      setError(null);
      invalidarPieza();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  // --- Fotografía ---
  const [urlFoto, setUrlFoto] = useState(""); // solo usado en el modo manual de respaldo
  const fileInputRef = useRef<HTMLInputElement>(null);

  const registrarUrlFoto = useMutation({
    mutationFn: async (url: string) => (await api.post<Fotografia>(`/piezas/${piezaId}/fotografias`, { url })).data,
    onSuccess: () => {
      setUrlFoto("");
      setError(null);
      invalidarPieza();
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const subirFoto = useMutation({
    mutationFn: async (archivo: File) => {
      const url = await subirImagenACloudinary(archivo);
      return (await api.post<Fotografia>(`/piezas/${piezaId}/fotografias`, { url })).data;
    },
    onSuccess: () => {
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      invalidarPieza();
    },
    onError: (err) => setError(err instanceof Error ? err.message : extraerMensajeError(err)),
  });

  // --- Movimiento ---
  const [ubicacionNueva, setUbicacionNueva] = useState("");
  const [motivo, setMotivo] = useState("");
  const registrarMovimiento = useMutation({
    mutationFn: async () =>
      (
        await api.post<Movimiento>(`/piezas/${piezaId}/movimientos`, {
          ubicacionNuevaId: ubicacionNueva,
          motivo: motivo || undefined,
        })
      ).data,
    onSuccess: () => {
      setMotivo("");
      setError(null);
      invalidarPieza();
      queryClient.invalidateQueries({ queryKey: ["movimientos", piezaId] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  // --- RIA-01 ---
  const dispararRia01 = useMutation({
    mutationFn: async () => (await api.post(`/ia/extraccion-observaciones/${piezaId}`)).data,
    onSuccess: () => setError(null),
    onError: (err) => setError(extraerMensajeError(err)),
  });

  if (piezaQuery.isLoading) return <p className="text-sm text-ink-400">Cargando ficha...</p>;
  if (piezaQuery.isError || !piezaQuery.data) return <p className="text-sm text-clay-700">No se pudo cargar la pieza.</p>;

  const pieza = piezaQuery.data;
  const ubicacionesPlanas = aplanarUbicaciones(ubicacionesQuery.data ?? []);
  const etiquetaVocab = (lista: ValorVocabulario[] | undefined, id: string | null) =>
    lista?.find((v) => v.id === id)?.valor ?? "—";
  const nombreColeccion = coleccionesQuery.data?.items.find((c) => c.id === pieza.coleccionId)?.nombre ?? "—";
  const nombreUbicacion = ubicacionesPlanas.find((u) => u.id === pieza.ubicacionActualId)?.etiqueta.trimStart() ?? "—";
  const fotos = pieza.fotografias;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/piezas" className="text-sm text-clay-700 hover:underline">
          ← Volver a piezas
        </Link>
        <h2 className="font-display text-2xl font-semibold text-ink-800 mt-1">{pieza.denominacion || "(sin denominación)"}</h2>
        {pieza.informacionCompleta ? (
          <span className="chip mt-1 !bg-emerald-100/80 !border-emerald-200 !text-emerald-800">Información completa</span>
        ) : (
          <span className="chip mt-1">Información incompleta · RF-019</span>
        )}
      </div>

      {error && <p className="text-sm text-clay-800 bg-clay-50/80 border border-clay-200 rounded-xl px-3 py-2">{error}</p>}

      <div className="grid lg:grid-cols-[22rem_1fr] gap-6 items-start">
        {/* Columna izquierda: galería de fotografías, al estilo de la ficha de referencia del cliente */}
        <div className="glass-panel p-4 space-y-3 lg:sticky lg:top-20">
          {fotos.length > 0 ? (
            <>
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/60 shadow-glass-sm bg-white/40">
                <img src={fotos[fotoActiva]?.url} alt="" className="w-full h-full object-cover" />
                {fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFotoActiva((i) => (i - 1 + fotos.length) % fotos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 hover:bg-white/90 flex items-center justify-center text-ink-700 shadow-glass-sm"
                      aria-label="Foto anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoActiva((i) => (i + 1) % fotos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 hover:bg-white/90 flex items-center justify-center text-ink-700 shadow-glass-sm"
                      aria-label="Foto siguiente"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              {fotos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {fotos.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFotoActiva(i)}
                      className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 ${
                        i === fotoActiva ? "border-clay-500" : "border-white/60 opacity-80"
                      }`}
                    >
                      <img src={f.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square rounded-2xl border border-dashed border-clay-200 flex items-center justify-center text-sm text-ink-400">
              Sin fotografías registradas
            </div>
          )}

          {cloudinaryConfigurado() ? (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) subirFoto.mutate(archivo);
                }}
                className="text-xs text-ink-600"
              />
              {subirFoto.isPending && <span className="text-xs text-ink-400">Subiendo...</span>}
            </div>
          ) : (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                registrarUrlFoto.mutate(urlFoto);
              }}
              className="flex gap-2"
            >
              <input
                required
                placeholder="URL ya subida a un servicio de imágenes"
                value={urlFoto}
                onChange={(e) => setUrlFoto(e.target.value)}
                className="glass-input text-xs"
              />
              <button className="btn-glass shrink-0 !px-3 !text-xs">Añadir</button>
            </form>
          )}
        </div>

        {/* Columna derecha: ficha estructurada por secciones, RF-006 */}
        <div className="space-y-6">
          <Seccion titulo="Identificación">
            <dl>
              <Fila etiqueta="Colección">{nombreColeccion}</Fila>
              <Fila etiqueta="Categoría">{etiquetaVocab(categoriasQuery.data, pieza.categoriaId)}</Fila>
              {pieza.codigosExternos.map((c) => (
                <Fila key={c.id} etiqueta={etiquetaVocab(tiposIdentificadorQuery.data, c.tipoIdentificador)}>
                  <span className="font-mono">{c.valor}</span>
                  {c.bloqueadoEdicion && (
                    <span title="RN-002/RF-003: inmutable" className="ml-1.5">
                      🔒
                    </span>
                  )}
                  {!c.vigente && <span className="chip ml-2 !py-0 !px-1.5 !text-[0.65rem]">no vigente</span>}
                </Fila>
              ))}
              {pieza.codigosExternos.length === 0 && <Fila etiqueta="Identificadores">Sin identificadores registrados.</Fila>}
            </dl>
            <p className="text-xs text-ink-400">RF-002 · una pieza puede tener hasta 5 códigos grabados (museo, colección, INC/RN, PUCP, propietario, otro).</p>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                agregarCodigo.mutate();
              }}
              className="flex gap-2 items-end flex-wrap"
            >
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Tipo</label>
                <select required value={tipoIdentificador} onChange={(e) => setTipoIdentificador(e.target.value)} className="glass-input">
                  <option value="">Seleccionar...</option>
                  {tiposIdentificadorQuery.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.valor}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Valor</label>
                <input required value={valorCodigo} onChange={(e) => setValorCodigo(e.target.value)} className="glass-input" />
              </div>
              <button className="btn-glass">Añadir código</button>
            </form>
          </Seccion>

          <Seccion titulo="Descripción">
            <dl>
              <Fila etiqueta="Denominación">
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    editar.mutate();
                  }}
                  className="flex gap-2 max-w-md"
                >
                  <input defaultValue={pieza.denominacion ?? ""} onChange={(e) => setDenominacion(e.target.value)} className="glass-input" />
                  <button className="btn-glass shrink-0">Guardar</button>
                </form>
              </Fila>
              <Fila etiqueta="Descripción">{pieza.descripcion || "—"}</Fila>
              <Fila etiqueta="Autor">{pieza.autor || "—"}</Fila>
              <Fila etiqueta="Procedencia">{pieza.procedencia || "—"}</Fila>
              <Fila etiqueta="Materiales">{pieza.materiales || "—"}</Fila>
              <Fila etiqueta="Técnica">{pieza.tecnica || "—"}</Fila>
              <Fila etiqueta="Medidas">{pieza.medidas || "—"}</Fila>
              <Fila etiqueta="Época">{pieza.epocaTexto || "—"}</Fila>
            </dl>
          </Seccion>

          <Seccion titulo="Estado y ubicación">
            <dl>
              <Fila etiqueta="Estado de conservación">{etiquetaVocab(estadosConservacionQuery.data, pieza.estadoConservacionId)}</Fila>
              <Fila etiqueta="Disponibilidad">{pieza.disponibilidad}</Fila>
              <Fila etiqueta="Propietario">{pieza.propietario}</Fila>
              <Fila etiqueta="Ubicación actual">{nombreUbicacion}</Fila>
              <Fila etiqueta="Fecha de ingreso">{pieza.fechaIngreso || "—"}</Fila>
            </dl>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-1.5">Historial de movimientos · RF-017</h4>
              <ul className="text-sm space-y-1.5 mb-3">
                {movimientosQuery.data?.map((m) => (
                  <li key={m.id} className="text-ink-600">
                    <span className="text-clay-500">→</span> {m.motivo || "(sin motivo indicado)"}
                  </li>
                ))}
                {movimientosQuery.data?.length === 0 && <li className="text-ink-400">Sin movimientos registrados.</li>}
              </ul>
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  registrarMovimiento.mutate();
                }}
                className="flex gap-2 items-end flex-wrap"
              >
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Nueva ubicación</label>
                  <select required value={ubicacionNueva} onChange={(e) => setUbicacionNueva(e.target.value)} className="glass-input min-w-[12rem]">
                    <option value="">Seleccionar...</option>
                    {ubicacionesPlanas.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Motivo</label>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="glass-input" />
                </div>
                <button className="btn-glass">Registrar</button>
              </form>
            </div>
          </Seccion>

          <Seccion titulo="Observaciones">
            <p className="text-sm text-ink-700">{pieza.observaciones || "—"}</p>
            {pieza.observaciones && (
              <button onClick={() => dispararRia01.mutate()} disabled={dispararRia01.isPending} className="text-xs font-medium text-clay-700 hover:underline disabled:opacity-50">
                {dispararRia01.isPending ? "Analizando..." : "Extraer datos de observaciones (RIA-01)"}
              </button>
            )}
            {dispararRia01.isSuccess && (
              <p className="text-xs text-emerald-700">
                Sugerencia generada. Revísala en "Calidad de Datos" antes de que se aplique a la ficha (RN-009).
              </p>
            )}
          </Seccion>

          <Seccion titulo="Auditoría · RF-040">
            <ul className="text-xs text-ink-500 space-y-1">
              {auditoriaQuery.data?.map((r, i) => (
                <li key={i}>
                  <span className="chip !py-0 !px-1.5 mr-1.5">{r.accion}</span>
                  {r.campo}: "{r.valorAnterior ?? "—"}" → "{r.valorNuevo ?? "—"}"
                </li>
              ))}
              {auditoriaQuery.data?.length === 0 && <li>Sin cambios registrados todavía.</li>}
            </ul>
          </Seccion>
        </div>
      </div>
    </div>
  );
}
