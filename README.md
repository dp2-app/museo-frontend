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
