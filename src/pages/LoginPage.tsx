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
      navigate("/piezas");
    } catch (err) {
      setError(extraerMensajeError(err) || "Email o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="glass-panel w-full max-w-sm p-8 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <svg viewBox="0 0 32 32" className="h-12 w-12" aria-hidden="true">
            <rect width="32" height="32" rx="10" fill="#B8622F" />
            <path d="M16 6 L26 16 L16 26 L6 16 Z" fill="none" stroke="#F6E4D4" strokeWidth="2" />
            <circle cx="16" cy="16" r="3.2" fill="#F6E4D4" />
          </svg>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink-800">Museo "Luis Repetto Málaga"</h1>
            <p className="text-sm text-ink-400">Sistema de gestión de colecciones</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-clay-800 bg-clay-50/80 border border-clay-200 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400">Correo</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-400">Contraseña</label>
          <input
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
