import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, TriangleAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { extraerMensajeError, VOLVER_A_STORAGE_KEY } from "../lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
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
    if (cargando) return;
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
    <div className="login-shell login-redesign">
      <aside className="login-story" aria-label="Museo Luis Repetto Málaga">
        <img src="/brand/matp_lockup_blanco.svg" alt="Museo de Artes y Tradiciones Populares Luis Repetto Málaga" className="login-brand" />
        <div className="login-editorial">
          <div className="login-artwork" aria-hidden="true"><div className="login-artwork-arch"><img src="/brand/matp_emblema_retablo.svg" alt="" /></div><span className="login-artwork-line" /></div>
          <p className="login-eyebrow">Patrimonio vivo</p>
          <p className="login-story-title">Cada pieza,<br /><em>una historia por cuidar.</em></p>
          <p className="login-story-description">Documentamos el presente para conservar la memoria del mañana.</p>
        </div>
        <p className="login-institution">Instituto Riva-Agüero<br /><span>Pontificia Universidad Católica del Perú</span></p>
      </aside>
      <header className="login-mobile-brand"><img src="/brand/matp_lockup_blanco.svg" alt="Museo de Artes y Tradiciones Populares Luis Repetto Málaga" /></header>
      <div className="login-entry">
        <div className="login-form-card">
          <div className="login-welcome"><span className="login-welcome-icon"><LockKeyhole size={22} aria-hidden="true" /></span><p className="login-eyebrow">Gestión de colecciones</p><h1>Bienvenido<br />al museo</h1><p>Ingresa a tu espacio de trabajo.</p></div>
          <form onSubmit={onSubmit} className="login-form" aria-label="Acceder al museo" aria-busy={cargando}>
            <div className="login-message-slot">
              {error ? <p id="login-error" role="alert" className="ui-error"><TriangleAlert size={18} className="shrink-0 mt-0.5" aria-hidden="true" /><span>{error}</span></p> : volverA ? <p role="status" className="login-session-message">Tu sesión venció. Vuelve a ingresar para seguir donde estabas; lo último que escribías no se guardó.</p> : <p className="login-access-note">Usa la cuenta que te asignó la administración del museo.</p>}
            </div>
            <div>
              <label className="form-label" htmlFor="login-email">Correo</label>
              <div className="login-input-wrap"><Mail size={19} className="login-input-icon" aria-hidden="true" /><input id="login-email" type="email" autoComplete="username" inputMode="email" required disabled={cargando} value={email} onChange={e => setEmail(e.target.value)} className="glass-input" placeholder="nombre@institucion.pe" aria-describedby={error ? "login-error" : undefined} /></div>
            </div>
            <div>
              <label className="form-label" htmlFor="login-password">Contraseña</label>
              <div className="login-input-wrap"><LockKeyhole size={19} className="login-input-icon" aria-hidden="true" /><input id="login-password" type={mostrarPassword ? "text" : "password"} autoComplete="current-password" required disabled={cargando} value={password} onChange={e => setPassword(e.target.value)} className="glass-input login-password-input" aria-describedby={error ? "login-error" : undefined} /><button type="button" className="login-password-toggle" disabled={cargando} aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={mostrarPassword} aria-controls="login-password" onClick={() => setMostrarPassword(!mostrarPassword)}>{mostrarPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>
            </div>
            <button type="submit" disabled={cargando} className="btn-primary login-submit">{cargando ? <LoaderCircle size={19} className="motion-safe:animate-spin" aria-hidden="true" /> : null}{cargando ? "Ingresando…" : "Ingresar"}{!cargando && <ArrowRight size={19} aria-hidden="true" />}</button>
            <div className="login-progress-slot">{lento && <p role="status">Estamos preparando tu acceso. La primera conexión puede tardar un poco; espera sin recargar.</p>}</div>
          </form>
          <p className="login-support">¿Necesitas una cuenta o ayuda para ingresar?<br /><strong>Contacta a la administración del museo.</strong></p>
        </div>
        <p className="login-entry-footer">Museo de Artes y Tradiciones Populares<br /><span>Luis Repetto Málaga</span></p>
      </div>
    </div>
  );
}
