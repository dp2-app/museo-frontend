import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { extraerMensajeError, VOLVER_A_STORAGE_KEY } from "../lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [lento, setLento] = useState(false);
  // Si la sesión venció a medio trabajo, la ruta quedó guardada: se avisa y, al ingresar, se regresa a ella.
  const [volverA] = useState<string | null>(() => {
    try { return sessionStorage.getItem(VOLVER_A_STORAGE_KEY); } catch { return null; }
  });

  // El servidor gratuito se duerme tras un rato sin uso y la primera respuesta puede tardar cerca de un minuto.
  useEffect(() => {
    if (!cargando) return;
    const aviso = setTimeout(() => setLento(true), 4000);
    return () => clearTimeout(aviso);
  }, [cargando]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      const desde = (location.state as { desde?: string } | null)?.desde ?? volverA ?? undefined;
      try { sessionStorage.removeItem(VOLVER_A_STORAGE_KEY); } catch { /* sin almacenamiento */ }
      navigate(desde?.startsWith("/") && !desde.startsWith("//") ? desde : "/");
    } catch (err) {
      setError(extraerMensajeError(err) || "Email o contraseña incorrectos");
    } finally {
      setCargando(false);
      setLento(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-story" aria-label="Museo Luis Repetto Málaga">
        <img src="/brand/matp_lockup_sobre_azul_blanco.svg" alt="Museo de Artes y Tradiciones Populares Luis Repetto Málaga" className="w-64" />
        <div className="space-y-6"><img src="/brand/matp_emblema_retablo.svg" alt="" aria-hidden="true" className="h-32 w-32 brightness-0 invert opacity-75" />
          <p className="login-story-title">Cada pieza tiene una historia.</p><p className="text-white/80 max-w-md">Un espacio de trabajo para documentar, cuidar y conocer las colecciones del museo.</p></div>
        <p className="text-sm text-white/80">Instituto Riva-Agüero · Pontificia Universidad Católica del Perú</p>
      </aside>
      <div className="login-entry"><form onSubmit={onSubmit} className="login-form">
        <div className="flex flex-col items-start gap-4">
          <img src="/brand/matp_lockup_positivo.svg" alt="Museo Luis Repetto Málaga" className="h-12 lg:hidden" />
          <div>
            <h1>Ingresar</h1>
            <p className="text-sm text-gris-2">Accede a tu espacio de trabajo del museo.</p>
          </div>
        </div>

        {volverA && !error && (
          <p role="status" className="text-sm text-texto">
            Tu sesión venció. Vuelve a ingresar para seguir donde estabas; lo último que escribías no se guardó.
          </p>
        )}

        {error && (
          <p role="alert" className="ui-error">{error}</p>
        )}

        <div className="space-y-1.5">
          <label className="form-label" htmlFor="login-email">
            Correo
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="form-label" htmlFor="login-password">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input"
          />
        </div>
        <button type="submit" disabled={cargando} className="btn-primary w-full py-2.5">
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
        {lento && <p role="status" className="text-sm">El servidor estaba inactivo y está despertando. Puede tardar hasta un minuto: espera sin recargar la página.</p>}
      </form></div>
    </div>
  );
}
