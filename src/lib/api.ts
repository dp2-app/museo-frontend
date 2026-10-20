import axios from "axios";
import type { ErrorApi } from "../types";

export const TOKEN_STORAGE_KEY = "museo.accessToken";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Puente de login v3 para AuthContext legado. No cambia ni inventa claims del JWT.
    if (response.config.url === "/auth/login" && response.data?.accessToken && !response.data.access_token) {
      response.data = { ...response.data, access_token: response.data.accessToken };
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

function objeto(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

/** Ambos contratos: errores de dominio v3 y detail del backend legado/Pydantic. */
export function extraerErroresApi(error: unknown): ErrorApi[] {
  const data = objeto(objeto(objeto(error)?.response)?.data);
  const origen = data?.errores ?? data?.detail;
  if (typeof origen === "string") return [{ codigo: "error", campo: null, mensaje: origen }];
  if (!Array.isArray(origen)) return [];
  return origen.flatMap((item): ErrorApi[] => {
    if (typeof item === "string") return [{ codigo: "error", campo: null, mensaje: item }];
    const e = objeto(item);
    if (!e) return [];
    const mensaje = e.mensaje ?? e.msg;
    if (typeof mensaje !== "string") return [];
    const campo = typeof e.campo === "string" ? e.campo : Array.isArray(e.loc)
      ? e.loc.filter((p) => p !== "body" && p !== "query").map(String).join(".") : null;
    return [{ campo, codigo: typeof e.codigo === "string" ? e.codigo : String(e.type ?? "invalido"), mensaje }];
  });
}

export function erroresPorCampo(error: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const e of extraerErroresApi(error)) {
    if (e.campo) resultado[e.campo] = [resultado[e.campo], e.mensaje].filter(Boolean).join("; ");
  }
  return resultado;
}

export function extraerMensajeError(error: unknown): string {
  return extraerErroresApi(error).map((e) => e.mensaje).join("; ") ||
    "No se pudo completar la operación. Comprueba la conexión e intenta nuevamente.";
}
