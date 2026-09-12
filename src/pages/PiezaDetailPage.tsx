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

  if (piezaQuery.isLoading) return <p className="text-sm text-stone-500">Cargando ficha...</p>;
  if (piezaQuery.isError || !piezaQuery.data)
    return <p className="text-sm text-red-600">No se pudo cargar la pieza.</p>;

  const pieza = piezaQuery.data;
  const ubicacionesPlanas = aplanarUbicaciones(ubicacionesQuery.data ?? []);

  return (
    <div className="space-y-8">
      <div>
        <Link to="/piezas" className="text-sm text-amber-700 hover:underline">
          ← Volver a piezas
        </Link>
        <h2 className="text-xl font-semibold text-stone-900 mt-1">{pieza.denominacion || "(sin denominación)"}</h2>
        <p className="text-sm text-stone-500">
          {pieza.informacionCompleta ? "Información completa" : "Información incompleta (RF-019)"}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {/* Ficha básica */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h3 className="font-medium text-stone-900">Ficha (RF-006)</h3>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            editar.mutate();
          }}
          className="flex gap-2 max-w-lg"
        >
          <input
            defaultValue={pieza.denominacion ?? ""}
            onChange={(e) => setDenominacion(e.target.value)}
            className="flex-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button className="bg-stone-900 text-white rounded px-3 py-1.5 text-sm hover:bg-stone-800">
            Guardar denominación
          </button>
        </form>
        <dl className="grid grid-cols-2 gap-2 text-sm text-stone-600">
          <div>
            <dt className="text-xs text-stone-400">Propietario</dt>
            <dd>{pieza.propietario}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Disponibilidad</dt>
            <dd>{pieza.disponibilidad}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Observaciones</dt>
            <dd>{pieza.observaciones || "—"}</dd>
          </div>
        </dl>
        {pieza.observaciones && (
          <button
            onClick={() => dispararRia01.mutate()}
            disabled={dispararRia01.isPending}
            className="text-xs text-amber-700 hover:underline disabled:opacity-50"
          >
            {dispararRia01.isPending ? "Analizando..." : "Extraer datos de observaciones (RIA-01)"}
          </button>
        )}
        {dispararRia01.isSuccess && (
          <p className="text-xs text-green-700">
            Sugerencia generada. Revísala en "Sugerencias IA" antes de que se aplique a la ficha (RN-009).
          </p>
        )}
      </section>

      {/* Códigos externos */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h3 className="font-medium text-stone-900">Identificadores (RF-002 — hasta 5)</h3>
        <ul className="space-y-1 text-sm">
          {pieza.codigosExternos.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="font-mono bg-stone-100 px-2 py-0.5 rounded">{c.valor}</span>
              {c.bloqueadoEdicion && (
                <span className="text-xs text-stone-400" title="RN-002/RF-003: inmutable">
                  🔒 bloqueado
                </span>
              )}
            </li>
          ))}
          {pieza.codigosExternos.length === 0 && <li className="text-stone-400">Sin identificadores registrados.</li>}
        </ul>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            agregarCodigo.mutate();
          }}
          className="flex gap-2 items-end flex-wrap"
        >
          <div>
            <label className="block text-xs text-stone-500">Tipo</label>
            <select
              required
              value={tipoIdentificador}
              onChange={(e) => setTipoIdentificador(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-sm"
            >
              <option value="">Seleccionar...</option>
              {tiposIdentificadorQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.valor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500">Valor</label>
            <input
              required
              value={valorCodigo}
              onChange={(e) => setValorCodigo(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button className="bg-stone-900 text-white rounded px-3 py-1.5 text-sm hover:bg-stone-800">Añadir</button>
        </form>
      </section>

      {/* Fotografías */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h3 className="font-medium text-stone-900">Fotografías (RF-013)</h3>
        <div className="flex flex-wrap gap-3">
          {pieza.fotografias.map((f) => (
            <img key={f.id} src={f.url} alt="" className="w-24 h-24 object-cover rounded border border-stone-200" />
          ))}
          {pieza.fotografias.length === 0 && <p className="text-sm text-stone-400">Sin fotografías registradas.</p>}
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
              className="text-sm"
            />
            {subirFoto.isPending && <span className="text-xs text-stone-500">Subiendo...</span>}
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
              className="flex-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
            />
            <button className="bg-stone-900 text-white rounded px-3 py-1.5 text-sm hover:bg-stone-800">Añadir</button>
          </form>
        )}
      </section>

      {/* Movimientos */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h3 className="font-medium text-stone-900">Historial de movimientos (RF-017)</h3>
        <ul className="text-sm space-y-1">
          {movimientosQuery.data?.map((m) => (
            <li key={m.id} className="text-stone-600">
              → {m.motivo || "(sin motivo indicado)"}
            </li>
          ))}
          {movimientosQuery.data?.length === 0 && <li className="text-stone-400">Sin movimientos registrados.</li>}
        </ul>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            registrarMovimiento.mutate();
          }}
          className="flex gap-2 items-end flex-wrap"
        >
          <div>
            <label className="block text-xs text-stone-500">Nueva ubicación</label>
            <select
              required
              value={ubicacionNueva}
              onChange={(e) => setUbicacionNueva(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5 text-sm min-w-[12rem]"
            >
              <option value="">Seleccionar...</option>
              {ubicacionesPlanas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500">Motivo</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded border border-stone-300 px-2 py-1.5 text-sm" />
          </div>
          <button className="bg-stone-900 text-white rounded px-3 py-1.5 text-sm hover:bg-stone-800">Registrar</button>
        </form>
      </section>

      {/* Auditoría */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-2">
        <h3 className="font-medium text-stone-900">Auditoría (RF-040)</h3>
        <ul className="text-xs text-stone-500 space-y-1">
          {auditoriaQuery.data?.map((r, i) => (
            <li key={i}>
              [{r.accion}] {r.campo}: "{r.valorAnterior ?? "—"}" → "{r.valorNuevo ?? "—"}"
            </li>
          ))}
          {auditoriaQuery.data?.length === 0 && <li>Sin cambios registrados todavía.</li>}
        </ul>
      </section>
    </div>
  );
}
