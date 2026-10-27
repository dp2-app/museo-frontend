import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Bot, Download } from "lucide-react";
import { api, extraerMensajeError } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { SalaSugerida } from "../../types";
import { EstadoIndiceSalas } from "./EstadoIndiceSalas";

const CANTIDAD_MIN = 10;
const CANTIDAD_MAX = 30;

/** F10 · RIA-05: el curador describe un tema o estilo, la IA propone un ranking de piezas y él
 * elige cuáles toma y exporta (DA-006: nada se escribe en la ficha). El ranking y el mensaje vienen
 * del backend; si la IA no está configurada, el backend responde 503 y aquí solo se muestra el error. */
export function ArmarSala() {
  const { puede } = usePermisos();
  const [pedido, setPedido] = useState("");
  const [cantidad, setCantidad] = useState(20);
  const [sala, setSala] = useState<SalaSugerida | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const sugerir = useMutation({
    mutationFn: async () => (await api.post<SalaSugerida>("/ia/salas/sugerir", { pedido, cantidad })).data,
    onSuccess: (data) => {
      setError(null);
      setSala(data);
      setElegidas(new Set(data.piezas.map((p) => p.piezaId)));
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const exportar = useMutation({
    mutationFn: async () => {
      if (!sala) return;
      const piezaIds = sala.piezas.filter((p) => elegidas.has(p.piezaId)).map((p) => p.piezaId);
      const { data } = await api.post(`/ia/salas/${sala.sugerenciaId}/exportar`, { piezaIds }, { responseType: "blob" });
      const url = URL.createObjectURL(data as Blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "sala-propuesta.xlsx";
      enlace.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => setError(null),
    onError: (err) => setError(extraerMensajeError(err)),
  });

  function onSugerir(e: FormEvent) {
    e.preventDefault();
    sugerir.mutate();
  }

  function alternar(id: string) {
    setElegidas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.add(id);
      return nuevas;
    });
  }

  const todas = sala !== null && sala.piezas.length > 0 && elegidas.size === sala.piezas.length;

  return (
    <section className="space-y-4" aria-labelledby="titulo-armar-sala">
      <div>
        <h2 id="titulo-armar-sala" className="section-title">Armar una sala</h2>
        <p className="text-sm text-gris-2 max-w-2xl">
          Describe el tema o estilo de la sala y la IA te propone las piezas del catálogo que mejor encajan, de mayor a
          menor coincidencia. Tú eliges cuáles tomar (también alguna con puntaje bajo) y exportas tu selección.
        </p>
      </div>

      {puede("ia.ejecutar_lote") && <EstadoIndiceSalas />}

      <form onSubmit={onSugerir} className="glass-panel p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1">
          <span className="form-label">Tema o estilo</span>
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder='Ej.: "Navidad andina", "máscaras de madera de Puno", "toros de Pucará"'
            maxLength={500}
            className="glass-input"
            required
          />
        </label>
        <label className="sm:w-36">
          <span className="form-label">Piezas ({CANTIDAD_MIN}–{CANTIDAD_MAX})</span>
          <input
            type="number"
            min={CANTIDAD_MIN}
            max={CANTIDAD_MAX}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className="glass-input"
          />
        </label>
        <button type="submit" disabled={sugerir.isPending || !pedido.trim()} className="btn-primary shrink-0">
          {sugerir.isPending ? "Buscando piezas..." : "Proponer piezas"}
        </button>
      </form>

      {error && <p className="text-sm text-rojo" role="alert">{error}</p>}

      {sala && (
        <div className="space-y-3">
          <div className="glass-panel-sm p-4 flex items-start gap-3" role="status">
            <Bot size={22} className="text-azul shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-texto">{sala.mensaje}</p>
              <p className="text-xs text-gris-2 mt-1">
                Propuesta de IA ({sala.modeloUsado}) · búsqueda {sala.busqueda === "hibrida" ? "por significado y por texto" : "solo por texto"}
                {sala.pocasPiezas && !sala.fueraDeTema && " · hay pocas piezas para este tema"}
              </p>
            </div>
          </div>

          {!sala.fueraDeTema && sala.piezas.length > 0 && (
            <div className="glass-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-linea">
                <p className="text-sm text-gris-2">
                  {elegidas.size} de {sala.piezas.length} piezas elegidas
                </p>
                <button
                  onClick={() => exportar.mutate()}
                  disabled={exportar.isPending || elegidas.size === 0 || !puede("reportes.exportar")}
                  title={puede("reportes.exportar") ? undefined : "Exportar requiere el permiso reportes.exportar"}
                  className="btn-glass inline-flex items-center gap-2"
                >
                  <Download size={16} aria-hidden="true" />
                  {exportar.isPending ? "Exportando..." : "Exportar selección a Excel"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={todas}
                          onChange={() => setElegidas(todas ? new Set() : new Set(sala.piezas.map((p) => p.piezaId)))}
                          aria-label="Elegir todas las piezas"
                        />
                      </th>
                      <th className="px-3 py-3 font-semibold">#</th>
                      <th className="px-3 py-3 font-semibold">Puntaje</th>
                      <th className="px-3 py-3 font-semibold">Pieza</th>
                      <th className="px-3 py-3 font-semibold">Material</th>
                      <th className="px-3 py-3 font-semibold">Procedencia</th>
                      <th className="px-3 py-3 font-semibold">Ubicación</th>
                      <th className="px-3 py-3 font-semibold">Alertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {sala.piezas.map((p) => (
                      <tr key={p.piezaId} className="hover:bg-fondo-suave transition align-top">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={elegidas.has(p.piezaId)}
                            onChange={() => alternar(p.piezaId)}
                            aria-label={`Elegir ${p.denominacion ?? "pieza"}`}
                          />
                        </td>
                        <td className="px-3 py-3 text-gris-2">{p.posicion}</td>
                        <td className="px-3 py-3 font-semibold text-azul">{p.puntaje}</td>
                        <td className="px-3 py-3">
                          <Link to={`/coleccion/${p.piezaId}`} className="font-medium text-texto hover:underline">
                            {p.denominacion || "(sin denominación)"}
                          </Link>
                          <p className="text-xs text-gris-2">
                            {[p.codigo, p.tipoBien, p.autor].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-gris-2">{p.materiales || "—"}</td>
                        <td className="px-3 py-3 text-gris-2">{p.procedencia || "—"}</td>
                        <td className="px-3 py-3 text-gris-2">{p.ubicacion || "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            {p.alertas.map((a) => (
                              <span key={a.codigo} className="inline-flex items-center gap-1 text-xs text-rojo-oscuro">
                                <AlertTriangle size={13} aria-hidden="true" />
                                {a.mensaje}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
