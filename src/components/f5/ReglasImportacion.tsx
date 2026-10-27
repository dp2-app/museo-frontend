import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { api, datosApi, extraerMensajeError } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { Permiso, ReglasImportacion as Reglas } from "../../types";

const UMBRAL_MIN = 0.3;
const UMBRAL_MAX = 1;

/** RF-58 y P33: reglas de duplicado, umbral de similitud y permiso aprobador.
 * Todo se valida en el servidor; aquí solo se evita enviar un valor fuera de rango. Rige desde la siguiente carga. */
export function ReglasImportacion() {
  const reglas = useQuery({ queryKey: ["reglas-importacion"],
    queryFn: async () => (await datosApi.get<Reglas>("/importacion/reglas")).data });
  if (reglas.isPending) return <p className="text-sm text-gris-2">Cargando reglas de importación…</p>;
  if (reglas.isError) return <p role="alert" className="text-sm">No se pudieron cargar las reglas: {extraerMensajeError(reglas.error)}</p>;
  return <FormularioReglas reglas={reglas.data} />;
}

function FormularioReglas({ reglas }: { reglas: Reglas }) {
  const cache = useQueryClient();
  const { puede } = usePermisos();
  const puedeEditar = puede("importacion.configurar");
  const puedeListarPermisos = puede("roles.ver");
  const [activas, setActivas] = useState(() => reglas.reglas.filter((r) => r.activa && r.configurable).map((r) => r.clave));
  const [umbral, setUmbral] = useState(() => reglas.similitudMinima.toFixed(2));
  const [aprobador, setAprobador] = useState(reglas.permisoAprobador);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const permisos = useQuery({ queryKey: ["f9", "permisos"], enabled: puedeEditar && puedeListarPermisos,
    queryFn: async () => (await api.get<Permiso[]>("/permisos")).data });

  const guardar = useMutation({
    mutationFn: async () => (await datosApi.put<Reglas>("/importacion/reglas", {
      reglasActivas: activas, similitudMinima: Number(umbral), permisoAprobador: aprobador,
    })).data,
    onSuccess: (data) => {
      cache.setQueryData(["reglas-importacion"], data);
      setError(""); setAviso("Reglas guardadas. Rigen desde la siguiente carga; los lotes ya cargados conservan las suyas.");
    },
    onError: (e) => { setAviso(""); setError(extraerMensajeError(e)); },
  });

  const numero = Number(umbral);
  const umbralValido = Number.isFinite(numero) && numero >= UMBRAL_MIN && numero <= UMBRAL_MAX;
  const opcionesAprobador = (permisos.data ?? []).map((p) => p.clave);
  if (aprobador && !opcionesAprobador.includes(aprobador)) opcionesAprobador.push(aprobador);

  function alternar(clave: string) {
    setActivas((previas) => previas.includes(clave) ? previas.filter((c) => c !== clave) : [...previas, clave]);
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setAviso("");
    if (!umbralValido) { setError(`El umbral debe estar entre ${UMBRAL_MIN.toFixed(2)} y ${UMBRAL_MAX.toFixed(2)}.`); return; }
    guardar.mutate();
  }

  return <details className="glass-panel p-5">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold">
      <Settings2 size={20} aria-hidden="true" />Reglas de duplicado y aprobación
    </summary>
    <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
      <fieldset className="space-y-2" disabled={!puedeEditar || guardar.isPending}>
        <legend className="form-label">Criterios para marcar un posible duplicado</legend>
        {reglas.reglas.map((r) => <label key={r.clave} className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={r.configurable ? activas.includes(r.clave) : true}
            disabled={!r.configurable} onChange={() => alternar(r.clave)} />
          <span>{r.etiqueta}{!r.configurable && <span className="text-sm text-gris-2"> (siempre activa: es la regla de RF-32)</span>}</span>
        </label>)}
      </fieldset>

      <div>
        <label htmlFor="reglas-umbral" className="form-label">Similitud mínima de la denominación ({UMBRAL_MIN.toFixed(2)} a {UMBRAL_MAX.toFixed(2)})</label>
        <input id="reglas-umbral" type="number" inputMode="decimal" step="0.05" min={UMBRAL_MIN} max={UMBRAL_MAX}
          className="glass-input max-w-[8rem]" value={umbral} disabled={!puedeEditar || guardar.isPending}
          aria-invalid={!umbralValido} onChange={(e) => setUmbral(e.target.value)} />
      </div>

      <div>
        <label htmlFor="reglas-aprobador" className="form-label">Permiso que autoriza aprobar una carga</label>
        {puedeEditar && puedeListarPermisos
          ? <select id="reglas-aprobador" className="glass-input" value={aprobador} disabled={guardar.isPending || permisos.isPending}
              onChange={(e) => setAprobador(e.target.value)}>
              {opcionesAprobador.map((clave) => <option key={clave} value={clave}>{clave}</option>)}
            </select>
          : <p id="reglas-aprobador"><code>{reglas.permisoAprobador}</code></p>}
        <p className="mt-1 text-sm text-gris-2">Quien tenga este permiso puede aprobar, también una carga que subió. Aprobar sigue siendo una acción explícita (RN-08).</p>
      </div>

      {reglas.requiereAprobacion && <p className="text-sm text-gris-2">Toda carga requiere aprobación antes de tocar el catálogo. Esta condición no se puede apagar.</p>}
      {error && <p role="alert" className="text-sm">{error}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
      {puedeEditar
        ? <button type="submit" className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? "Guardando…" : "Guardar reglas"}</button>
        : <p className="text-sm text-gris-2">Solo quien tenga permiso para configurar la importación puede cambiar estas reglas.</p>}
    </form>
  </details>;
}
