import { Handshake, Hash } from "lucide-react";
import { usePermisos } from "../../hooks/usePermisos";
import { Link } from "react-router-dom";

export function InsigniaPendienteI() {
  return <span className="chip !bg-paja/15 !border-paja/40 !text-texto inline-flex items-center gap-1">
    <Hash size={12} aria-hidden="true" />Pendiente de código I</span>;
}

/** Accesos de F1 desde Colección: pendientes de código I (RF-06) y préstamos temporales (RN-04), según permiso.
 * Una sola línea en la página para no chocar con F2. */
export function AccesosF1() {
  const { puede } = usePermisos();
  return <div className="flex flex-wrap gap-3">
    <Link to="/coleccion/pendientes-codigo-i" className="btn-glass"><Hash size={20} aria-hidden="true" />Pendientes de código I</Link>
    {puede("tenencias.ver") && <Link to="/coleccion/prestamos-temporales" className="btn-glass"><Handshake size={20} aria-hidden="true" />Préstamos temporales</Link>}
  </div>;
}
