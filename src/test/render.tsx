import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../contexts/AuthContext";
import { api, TOKEN_STORAGE_KEY } from "../lib/api";

/** JWT de prueba: AuthContext solo lee `sub` y `exp` (la firma la valida el backend). */
function tokenDePrueba() {
  const payload = btoa(JSON.stringify({ sub: "usuario-prueba", exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecera.${payload}.firma`;
}

type Respuesta = unknown | ((cuerpo?: unknown) => unknown);
export type Respuestas = Record<string, Respuesta>;

/** Error con la forma que devuelve axios, para probar cómo la UI muestra los errores del backend. */
export function errorApi(status: number, errores: { codigo: string; mensaje: string; campo?: string | null }[]) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { errores } } });
}

/** Simula la API: cada clave es «MÉTODO /ruta» (o solo «/ruta» para GET). Lo no previsto falla la prueba. */
export function simularApi(respuestas: Respuestas, permisos: string[]) {
  const todas: Respuestas = {
    "/auth/sesion": { usuario: { id: "usuario-prueba", nombre: "Prueba", rol: { nombre: "Administrador" } }, permisos, camposOcultos: [] },
    ...respuestas,
  };
  const responder = (metodo: string) => async (url: string, cuerpo?: unknown) => {
    const clave = [metodo === "GET" ? url : "", `${metodo} ${url}`].find((k) => k && k in todas);
    if (!clave) throw new Error(`Llamada no prevista en la prueba: ${metodo} ${url}`);
    const r = todas[clave];
    const data = typeof r === "function" ? await (r as (c?: unknown) => unknown)(cuerpo) : r;
    return { data, status: 200 };
  };
  return {
    get: vi.spyOn(api, "get").mockImplementation(responder("GET") as never),
    post: vi.spyOn(api, "post").mockImplementation(responder("POST") as never),
    patch: vi.spyOn(api, "patch").mockImplementation(responder("PATCH") as never),
    put: vi.spyOn(api, "put").mockImplementation(responder("PUT") as never),
  };
}

/** Renderiza una pantalla con sesión, caché y router, como en la app real. */
export function renderizar(ui: ReactNode, { ruta = "/", patron = "*", otras = {} as Record<string, ReactNode> } = {}) {
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenDePrueba());
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <AuthProvider>
          <Routes>
            <Route path={patron} element={ui} />
            {Object.entries(otras).map(([p, el]) => <Route key={p} path={p} element={el} />)}
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
