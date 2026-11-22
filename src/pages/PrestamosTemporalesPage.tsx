import { CabeceraPagina } from "../components/SistemaVisual";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { PrestamosTemporales } from "../components/f1/PrestamosTemporales";

/** RN-04: bienes recibidos en préstamo temporal. Operación diaria (no configuración), por eso vive en Colección. */
export function PrestamosTemporalesPage() {
  return <div className="space-y-6">
    <div>
      <Link to="/coleccion" className="btn-danger-text inline-flex items-center gap-1 text-sm"><ChevronLeft size={20} aria-hidden="true" />Colección</Link>
      <div className="mt-4"><CabeceraPagina titulo="Préstamos temporales" descripcion="Bienes que el museo recibe por un tiempo, con su prestador, fechas y condiciones." /></div>
    </div>
    <PrestamosTemporales />
  </div>;
}
