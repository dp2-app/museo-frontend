import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { api, TOKEN_STORAGE_KEY } from "../lib/api";

interface JwtPayload {
  sub: string;
  rol: string;
  exp: number;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  usuarioId: string | null;
  rol: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodificarToken(token: string | null): JwtPayload | null {
  if (!token) return null;
  try {
    const payload = jwtDecode<JwtPayload>(token);
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));

  const payload = useMemo(() => decodificarToken(token), [token]);

  async function login(email: string, password: string) {
    const { data } = await api.post<{ access_token: string }>("/auth/login", { email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    setToken(data.access_token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }

  const value: AuthContextValue = {
    isAuthenticated: payload !== null,
    usuarioId: payload?.sub ?? null,
    rol: payload?.rol ?? null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
