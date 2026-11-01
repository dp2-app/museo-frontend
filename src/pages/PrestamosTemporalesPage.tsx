import { Link } from "react-router-dom";
import { ChevronLeft, Handshake } from "lucide-react";
import { PrestamosTemporales } from "../components/f1/PrestamosTemporales";

/** RN-04: bienes recibidos en préstamo temporal. Operación diaria (no configuración), por eso vive en Colección. */
export function PrestamosTemporalesPage() {
  return <div className="space-y-6">
    <div>
      <Link to="/coleccion" className="btn-danger-text inline-flex items-center gap-1 text-sm"><ChevronLeft size={20} aria-hidden="true" />Colección</Link>
      <div className="mt-2 flex items-center gap-4">
        <span className="hidden sm:flex h-14 w-14 items-center justify-center rounded-card bg-white border border-linea"><Handshake size={24} className="text-azul" aria-hidden="true" /></span>
        <div>
          <h1>Préstamos temporales</h1>
          <p className="text-sm text-gris-2">Bienes que el museo recibe por un tiempo, con su prestador, fechas y condiciones.</p>
        </div>
      </div>
    </div>
    <PrestamosTemporales />
  </div>;
}
