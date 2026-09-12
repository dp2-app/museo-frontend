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
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <form onSubmit={onSubmit} className="bg-white shadow-md rounded-lg p-8 w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Museo "Luis Repetto Málaga"</h1>
          <p className="text-sm text-stone-500">Sistema de gestión de colecciones</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-stone-700">Correo</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-stone-900 text-white rounded py-2 text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
