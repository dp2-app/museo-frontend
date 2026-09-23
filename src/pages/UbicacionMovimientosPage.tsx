import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Printer, Warehouse } from "lucide-react";
import { api, extraerMensajeError } from "../lib/api";
import { aplanarUbicaciones, rutaUbicacion } from "../lib/ubicaciones";
import type { Movimiento, Pagina, Pieza, UbicacionFisica } from "../types";

// Ubicación y movimientos (HU-07, HU-08): selector de pieza + breadcrumb
// jerárquico + código QR real (imprimible) + formulario de traslado +
// historial inmutable. Roles: Administrador, Conservación (spec §6).
export function UbicacionMovimientosPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [piezaId, setPiezaId] = useState<string | null>(null);
  const [ubicacionNueva, setUbicacionNueva] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const piezasQuery = useQuery({
    queryKey: ["piezas", "buscar-ubicacion", busqueda],
    queryFn: async () =>
      (await api.get<Pagina<Pieza>>("/piezas", { params: { codigo: busqueda || undefined, page_size: 20 } })).data,
  });

  const piezaQuery = useQuery({
    queryKey: ["pieza", piezaId],
    queryFn: async () => (await api.get<Pieza>(`/piezas/${piezaId}`)).data,
    enabled: !!piezaId,
  });

  const ubicacionesQuery = useQuery({
    queryKey: ["ubicaciones"],
    queryFn: async () => (await api.get<UbicacionFisica[]>("/ubicaciones")).data,
  });

  const movimientosQuery = useQuery({
    queryKey: ["movimientos", piezaId],
    queryFn: async () => (await api.get<Movimiento[]>(`/piezas/${piezaId}/movimientos`)).data,
    enabled: !!piezaId,
  });

  const ubicacionesPlanas = aplanarUbicaciones(ubicacionesQuery.data ?? []);
  const breadcrumb = rutaUbicacion(piezaQuery.data?.ubicacionActualId ?? null, ubicacionesQuery.data ?? []);

  useEffect(() => {
    if (!piezaId) {
      setQrDataUrl(null);
      return;
    }
    // Código QR real (librería qrcode, no un patrón simulado): apunta a la
    // ficha de la pieza en este mismo sistema, para escanear en depósito.
    const url = `${window.location.origin}/coleccion/${piezaId}`;
    QRCode.toDataURL(url, { margin: 1, width: 180 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [piezaId]);

  const registrarMovimiento = useMutation({
    mutationFn: async () =>
      (
        await api.post<Movimiento>(`/piezas/${piezaId}/movimientos`, {
          ubicacionNuevaId: ubicacionNueva,
          motivo: motivo || undefined,
        })
      ).data,
    onSuccess: () => {
      setError(null);
      setMotivo("");
      setUbicacionNueva("");
      queryClient.invalidateQueries({ queryKey: ["pieza", piezaId] });
      queryClient.invalidateQueries({ queryKey: ["movimientos", piezaId] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function imprimirQr() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Warehouse size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Ubicación y movimientos</h1>
          <p className="text-sm text-gris-2">HU-07, HU-08 · ubicación física, código QR y traslados.</p>
        </div>
      </div>

      <div className="glass-panel-sm p-4 space-y-3">
        <label className="form-label" htmlFor="buscar-pieza">
          Buscar pieza por código o denominación
        </label>
        <input
          id="buscar-pieza"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="glass-input max-w-md"
          placeholder="Código de inventario..."
        />
        <div className="flex flex-wrap gap-2">
          {piezasQuery.data?.items.slice(0, 10).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPiezaId(p.id)}
              className={`chip ${piezaId === p.id ? "!bg-azul !text-white !border-azul" : ""}`}
            >
              {p.denominacion || "(sin denominación)"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rojo bg-rojo/10 border border-rojo/30 rounded-btn px-3 py-2">{error}</p>}

      {piezaQuery.data && (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="glass-panel p-5 space-y-4">
            <h2 className="section-title">Ubicación actual</h2>
            {breadcrumb.length > 0 ? (
              <p className="text-sm text-texto">{breadcrumb.join(" › ")}</p>
            ) : (
              <p className="text-sm text-gris-2">Esta pieza no tiene ubicación asignada.</p>
            )}

            <div className="flex items-center gap-4 print:block">
              {qrDataUrl && <img src={qrDataUrl} alt="Código QR de la ficha de esta pieza" className="w-32 h-32" />}
              <div>
                <p className="text-sm font-semibold text-azul">
                  {piezaQuery.data.denominacion || "(sin denominación)"}
                </p>
                <button type="button" onClick={imprimirQr} className="btn-glass mt-2 !py-1.5 !px-3 !text-sm print:hidden">
                  <Printer size={16} aria-hidden="true" /> Imprimir código QR
                </button>
              </div>
            </div>

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                registrarMovimiento.mutate();
              }}
              className="flex flex-wrap gap-2 items-end pt-2 border-t border-linea"
            >
              <div>
                <label className="form-label" htmlFor="nueva-ubicacion">
                  Nueva ubicación
                </label>
                <select
                  id="nueva-ubicacion"
                  required
                  value={ubicacionNueva}
                  onChange={(e) => setUbicacionNueva(e.target.value)}
                  className="glass-input min-w-[12rem]"
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
                <label className="form-label" htmlFor="motivo-traslado">
                  Motivo
                </label>
                <input
                  id="motivo-traslado"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Préstamo, exposición, restauración..."
                  className="glass-input"
                />
              </div>
              <button type="submit" disabled={registrarMovimiento.isPending} className="btn-primary">
                Registrar traslado
              </button>
            </form>
          </section>

          <section className="glass-panel p-5">
            <h2 className="section-title mb-3">Historial de movimientos · RF-017</h2>
            <ul className="space-y-2 text-sm">
              {movimientosQuery.data?.map((m) => (
                <li key={m.id} className="border-b border-linea pb-2 last:border-0">
                  <span className="text-rojo">→</span> {m.motivo || "(sin motivo indicado)"}
                </li>
              ))}
              {movimientosQuery.data?.length === 0 && (
                <li className="text-gris-2">Sin movimientos registrados todavía.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
