import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { extraerMensajeError } from "../lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(extraerMensajeError(err) || "Email o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-fondo-suave">
      <form onSubmit={onSubmit} className="glass-panel w-full max-w-sm p-8 space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/brand/pucp_isotipo_positivo.svg" alt="" aria-hidden="true" className="h-14" />
          <div>
            <h1 className="text-lg leading-snug">Museo "Luis Repetto Málaga"</h1>
            <p className="text-sm text-gris-2">Sistema de gestión de colecciones</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-rojo bg-rojo/10 border border-rojo/30 rounded-btn px-3 py-2">{error}</p>
        )}

        <div className="space-y-1.5">
          <label className="form-label" htmlFor="login-email">
            Correo
          </label>
          <input
            id="login-email"
            type="email"
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
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input"
          />
        </div>
        <button type="submit" disabled={cargando} className="btn-primary w-full py-2.5">
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
