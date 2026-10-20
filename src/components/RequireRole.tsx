import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermisos } from "../hooks/usePermisos";

/** Spec de diseño §5: un ítem de nav no permitido no se renderiza (ver
 * NavEnlaces/seccionesPara); una ruta visitada directamente sin permiso
 * redirige a "/" — el RBAC visual es UX, la autorización real siempre la
 * valida el backend (401/403). */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { rol, isPending, isError, refetch } = usePermisos();
  if (isPending) return <p role="status">Comprobando sesión…</p>;
  if (isError && !rol) return <div role="alert"><p>No se pudo comprobar el acceso.</p><button type="button" className="btn-glass" onClick={() => { void refetch(); }}>Reintentar</button></div>;
  if (!rol || !roles.includes(rol)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
