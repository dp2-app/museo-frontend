# F10 · Prueba de punta a punta (`npm run test:f10`)

Recorre las funciones de IA contra el backend y el frontend **reales**, con el proveedor de IA real configurado en el backend
local (Groq). No intercepta ni simula respuestas: si la IA no está configurada, la prueba falla con el 503 del backend.

| Paso | Qué comprueba |
|---|---|
| RIA-06 · Buscar con IA (Colección) | La IA interpreta la pregunta en filtros que se muestran como chips; el total es el de `GET /piezas` con esos mismos filtros; cada consulta queda `registrada` con quién preguntó y sin revisor; quitar un chip recalcula sin volver a la IA y el registro guarda `filtrosAplicados`; cada persona ve solo sus preguntas y no entran a la cola. |
| RIA-05 · Armar sala | «con fotografía» se aplica como condición (si nadie la cumple, la sala queda vacía con un mensaje, sin rellenar); quitar la condición vuelve a proponer; el curador elige 3 piezas y exporta solo esas a Excel. |
| Permisos | El Gestor no ve el índice (`ia.indexar` es solo del Administrador; la API responde 403); Consulta interna pregunta (`piezas.ver`) pero no ve Armar sala ni puede pedir una sala (403). |
| Límite de uso | Más de `IA_CONSULTAS_POR_MINUTO` consultas por minuto dan 429 `limite_consultas`. |
| RIA-01 · observaciones | La propuesta queda `pendiente` y, al rechazarla, la ficha no cambia (DA-006). Solo por API: la interfaz no tiene hoy esta revisión. |

## Cómo correrla

Solo contra `localhost`, con una base **exclusiva de pruebas**: deja consultas, sugerencias y exportaciones que no se borran (RN-05).
Necesita tres cuentas locales con la misma contraseña (Administrador, Gestor de colecciones y Consulta interna); por defecto
`e2e.f10.admin@example.com`, `e2e.f10.gestor@example.com` y `e2e.f10.consulta@example.com` (se cambian con `F10_EMAIL_*`).
Guarda la contraseña en `.env.e2e.local` (ignorado por git) como `F10_PASSWORD=...`.

```bash
set -a; . ./.env.e2e.local; set +a
F10_PLAYWRIGHT_MODULE=<ruta a playwright o playwright-core> npm run test:f10
```

Usa el Chrome instalado (`channel: 'chrome'`). Las capturas y el `resultado.json` quedan en `evidencia-f10/` (ignorado por git):
**no los subas a este repositorio, que es público**, porque muestran datos reales del inventario. La evidencia de cada corrida
va a la base de conocimiento (privada), en `flujos/evidencias/`.

## Última corrida

17/11/2026, base local con las 4.380 piezas de la hoja Inventario y Groq real (`openai/gpt-oss-120b`): **12 comprobaciones aprobadas**.
Evidencia: `Base-de-conocimiento/flujos/evidencias/F10-e2e-2026-11-17/`.
