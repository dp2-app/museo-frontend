import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, extraerMensajeError } from "../lib/api";
import { cloudinaryConfigurado, subirImagenACloudinary } from "../lib/cloudinary";
import type {
  CodigoExterno,
  Fotografia,
  Movimiento,
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

export function PiezaDetailPage() {
  const { piezaId } = useParams<{ piezaId: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

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

      {/* Ficha básica */}
      <section className="glass-panel p-5 space-y-4">
        <h3 className="section-title">Ficha · RF-006</h3>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            editar.mutate();
          }}
          className="flex gap-2 max-w-lg"
        >
          <input defaultValue={pieza.denominacion ?? ""} onChange={(e) => setDenominacion(e.target.value)} className="glass-input" />
          <button className="btn-glass shrink-0">Guardar</button>
        </form>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Propietario</dt>
            <dd className="text-ink-700 mt-0.5">{pieza.propietario}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Disponibilidad</dt>
            <dd className="text-ink-700 mt-0.5">{pieza.disponibilidad}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Observaciones</dt>
            <dd className="text-ink-700 mt-0.5">{pieza.observaciones || "—"}</dd>
          </div>
        </dl>
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
      </section>

      {/* Códigos externos */}
      <section className="glass-panel p-5 space-y-4">
        <h3 className="section-title">Identificadores · RF-002 (hasta 5)</h3>
        <ul className="flex flex-wrap gap-2">
          {pieza.codigosExternos.map((c) => (
            <li key={c.id} className="chip !bg-white/70">
              <span className="font-mono">{c.valor}</span>
              {c.bloqueadoEdicion && (
                <span title="RN-002/RF-003: inmutable" className="ml-0.5">
                  🔒
                </span>
              )}
            </li>
          ))}
          {pieza.codigosExternos.length === 0 && <li className="text-sm text-ink-400">Sin identificadores registrados.</li>}
        </ul>
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
          <button className="btn-glass">Añadir</button>
        </form>
      </section>

      {/* Fotografías */}
      <section className="glass-panel p-5 space-y-4">
        <h3 className="section-title">Fotografías · RF-013</h3>
        <div className="flex flex-wrap gap-3">
          {pieza.fotografias.map((f) => (
            <img key={f.id} src={f.url} alt="" className="w-24 h-24 object-cover rounded-2xl border border-white/60 shadow-glass-sm" />
          ))}
          {pieza.fotografias.length === 0 && <p className="text-sm text-ink-400">Sin fotografías registradas.</p>}
        </div>
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
              className="text-sm text-ink-600"
            />
            {subirFoto.isPending && <span className="text-xs text-ink-400">Subiendo...</span>}
          </div>
        ) : (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              registrarUrlFoto.mutate(urlFoto);
            }}
            className="flex gap-2 max-w-lg"
          >
            <input
              required
              placeholder="URL ya subida a un servicio de imágenes"
              value={urlFoto}
              onChange={(e) => setUrlFoto(e.target.value)}
              className="glass-input"
            />
            <button className="btn-glass shrink-0">Añadir</button>
          </form>
        )}
      </section>

      {/* Movimientos */}
      <section className="glass-panel p-5 space-y-4">
        <h3 className="section-title">Historial de movimientos · RF-017</h3>
        <ul className="text-sm space-y-1.5">
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
      </section>

      {/* Auditoría */}
      <section className="glass-panel p-5 space-y-2">
        <h3 className="section-title">Auditoría · RF-040</h3>
        <ul className="text-xs text-ink-500 space-y-1">
          {auditoriaQuery.data?.map((r, i) => (
            <li key={i}>
              <span className="chip !py-0 !px-1.5 mr-1.5">{r.accion}</span>
              {r.campo}: "{r.valorAnterior ?? "—"}" → "{r.valorNuevo ?? "—"}"
            </li>
          ))}
          {auditoriaQuery.data?.length === 0 && <li>Sin cambios registrados todavía.</li>}
        </ul>
      </section>
    </div>
  );
}
