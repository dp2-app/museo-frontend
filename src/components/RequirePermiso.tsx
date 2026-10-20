import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermisos } from "../hooks/usePermisos";

/** Una ruta visitada sin ninguno de los permisos redirige a «/». Es solo UX: la autorización real
 * la valida el backend en cada endpoint (RNF-08, 401/403). Lista vacía: cualquier usuario con sesión. */
export function RequirePermiso({ permisos, children }: { permisos: string[]; children: ReactNode }) {
  const { sesion, isPending, isError, refetch, puedeAlguno } = usePermisos();
  if (isPending) return <p role="status">Comprobando sesión…</p>;
  if (isError && !sesion) {
    return (
      <div role="alert">
        <p>No se pudo comprobar el acceso.</p>
        <button type="button" className="btn-glass" onClick={() => { void refetch(); }}>Reintentar</button>
      </div>
    );
  }
  if (!puedeAlguno(...permisos)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
