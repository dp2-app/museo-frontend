import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/** Spec de diseño §5: un ítem de nav no permitido no se renderiza (ver
 * NavEnlaces/seccionesPara); una ruta visitada directamente sin permiso
 * redirige a "/" — el RBAC visual es UX, la autorización real siempre la
 * valida el backend (401/403). */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { rol } = useAuth();
  if (!rol || !roles.includes(rol)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
