# museo-frontend

Interfaz web del Sistema de Gestión y Digitalización de Colecciones Museográficas —
Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (PUCP, curso 1INF47).

Stack: **React + TypeScript + Vite + Tailwind CSS**, según el
[Plan de Adquisiciones](../DPW/ARCHIVOS/02.Museo.PlanAdquisiciones.v1.pdf) oficial del equipo.
Consume la API de [museo-backend](../museo-backend); ver ahí el contrato completo
(`docs/openapi.yaml`) y el modelo de datos.

## Puesta en marcha

Requiere que [museo-backend](../museo-backend) esté corriendo (por defecto en
`http://localhost:8000`).

```bash
npm install
cp .env.example .env      # ajustar VITE_API_BASE_URL si el backend no está en localhost:8000
npm run dev
```

La aplicación queda en `http://localhost:5173`. El primer usuario se crea con
`python -m app.seed` en el backend (ver su README).

## Pruebas e integración continua

| Nivel | Herramienta | Qué prueba | Comando |
|---|---|---|---|
| Unitarias | Vitest | Funciones de `src/lib` (errores de la API, ficha, ubicaciones, navegación por permiso) | `npm test` |
| Componentes (integración) | Vitest + Testing Library | Pantallas completas con la API simulada: alta, ficha, edición con conflicto, revisión, fotos, códigos, tenencia, bajas | `npm test` |
| Punta a punta | Playwright | El navegador contra el backend real y un PostgreSQL de pruebas | `npm run test:e2e` |

`npm run test:cobertura` exige al menos 80 % de líneas en el código cubierto (ver `vite.config.ts`). Las pruebas
de punta a punta necesitan el backend corriendo y una cuenta de prueba:

```bash
E2E_API=http://localhost:8000/api/v1 E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
```

La CI (`.github/workflows/build.yml`) corre en cada PR: lint, tipos, pruebas con cobertura y build. Después
levanta `museo-backend@main` con una base nueva y corre Playwright. Para eso necesita el secreto
`BACKEND_REPO_TOKEN`, un token de solo lectura de `dp2-app/museo-backend`; sin él, ese trabajo se salta. Vercel
publica una vista previa por PR y producción al fusionar en `main`.

## Estructura

```
src/
  components/   # Layout, ProtectedRoute
  contexts/     # AuthContext (JWT en localStorage, decodificado con jwt-decode)
  lib/          # cliente axios (api.ts) con interceptor de token y manejo de 401
  pages/        # una página por pantalla, alineadas a los módulos de la API
  types/        # espejo TypeScript de los schemas de museo-backend (camelCase)
```

## Páginas

| Ruta | Cubre |
|---|---|
| `/login` | Autenticación (RNF-012) |
| `/piezas`, `/piezas/:id` | Módulo 1 — búsqueda combinada (RF-031/032), ficha, identificadores (RF-002), fotografías (RF-013), movimientos (RF-017), auditoría (RF-040) |
| `/colecciones` | Colecciones (RF-010) |
| `/importacion`, `/importacion/:id` | Módulo 3 — carga de Excel, previsualización con clasificación por fila, aprobación explícita (RF-027) |
| `/ia` | Cola de revisión human-in-the-loop de sugerencias de IA (RN-009) |

## Notas de diseño

- El wire format de la API es camelCase (ver `app/schemas/base.py` en el backend);
  los tipos en `src/types/index.ts` lo reflejan exactamente.
- Las fotografías se referencian por URL (ya subida a Cloudinary); esta interfaz no
  sube el binario directamente todavía — es un punto de extensión pendiente.
- `AuthContext` decodifica el JWT en el cliente solo para leer `rol` y expiración;
  la autorización real siempre se valida en el backend.
