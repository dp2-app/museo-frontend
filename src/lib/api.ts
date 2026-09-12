import axios from "axios";

export const TOKEN_STORAGE_KEY = "museo.accessToken";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/** Extrae un mensaje legible del "detail" que FastAPI/HTTPException devuelve
 * en sus distintas formas (string, lista de errores de validación, etc.). */
export function extraerMensajeError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "string" ? d : d.mensaje ?? d.msg ?? JSON.stringify(d)))
      .join("; ");
  }
  return "Ocurrió un error inesperado. Intenta nuevamente.";
}
