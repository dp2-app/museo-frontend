# Contexto del proyecto — museo-frontend

> Este archivo lo lee automáticamente Claude Code al abrir este repo. Está pensado
> para que **cualquier integrante del equipo**, al pedirle ayuda a su Claude en este
> proyecto, tenga el mismo contexto sin tener que reexplicarlo. **Actualízalo** cuando
> termines algo de la sección "Pendiente" o cuando tomes una decisión de diseño nueva —
> es más barato mantenerlo al día que dejar que quede desactualizado.

## Qué es esto

Sistema de Gestión y Digitalización de Colecciones Museográficas para el Museo de
Artes y Tradiciones Populares "Luis Repetto Málaga" (PUCP, curso 1INF47, equipo de
11 integrantes). Proyecto real con cliente real (Gabriela, museo), no solo académico.

Este repo es el **frontend**. El backend (con toda la documentación de diseño,
modelo de datos y contrato de API) vive en el repo hermano
[`museo-backend`](../museo-backend), clonado al lado de este en `E:\Codes\GIT`.
**Lee `../museo-backend/CLAUDE.md` también** — ahí está el detalle de las reglas de
negocio (RN-*) que esta interfaz debe respetar.

## Leer antes de tocar código

1. `../museo-backend/docs/openapi.yaml` — contrato REST completo. `src/types/index.ts`
   es su espejo en TypeScript; si el backend cambia un endpoint, actualiza ambos.
2. `../museo-backend/docs/01-data-model.md` — para entender qué representa cada
   entidad (pieza, código externo, tenencia, ubicación...) y por qué.
3. `../DPW/ARCHIVOS/Matriz_Requerimientos_Museo_ATP_LuisRepetto_v2_ISO29148.xlsx` —
   los RF/RN/RNF/RIA originales, con evidencia de entrevista al cliente.
4. `../DPW/ARCHIVOS/02.Museo.PlanAdquisiciones.v1.pdf` — stack oficial del curso.

## Stack (no negociable sin tocar el Plan de Adquisiciones)

React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + axios.

## Estado actual

### Hecho y verificado en el navegador contra el backend real

- Login con JWT (`AuthContext`, token en `localStorage`, decodificado con `jwt-decode`
  solo para leer rol/expiración — la autorización real siempre se valida en el backend).
- **Piezas**: búsqueda combinada (código, colección, incompletas), alta, edición de
  ficha, identificadores (con indicador visual 🔒 cuando el código "I" está
  bloqueado), historial de movimientos, auditoría.
- **Ficha de pieza rediseñada** (`PiezaDetailPage`) siguiendo el formato de registro
  que el cliente mostró como referencia (surdoc.cl/registro/8-1): galería de fotos
  fija a la izquierda y secciones tituladas "Identificación" / "Descripción" /
  "Estado y ubicación" / "Observaciones" / "Auditoría" a la derecha, con filas
  etiqueta-valor. Cada código externo se lista como su propia fila (tipo + valor +
  🔒 si aplica + chip "no vigente" si `vigente=false`) en vez de una sola línea de
  chips — así se ve explícito el soporte a múltiples códigos grabados en una misma
  pieza que el cliente pidió en las reuniones (RF-002, ya soportado por el backend
  vía `codigos_externos`, esto solo mejora cómo se presenta). **Aún sin probar
  contra el backend real** (no había PostgreSQL disponible en la sesión donde se
  hizo el cambio) — probarlo en el navegador antes de dar el PR por terminado.
- **Colecciones**: listado y alta.
- **Fotografías**: subida directa a Cloudinary desde el navegador (unsigned upload
  preset, sin exponer el API secret — ver `src/lib/cloudinary.ts`). Si
  `VITE_CLOUDINARY_CLOUD_NAME`/`VITE_CLOUDINARY_UPLOAD_PRESET` no están configurados,
  cae de vuelta a un campo de URL manual sin romper nada.
- **Importación de Excel**: subida de archivo, selector de plantilla de mapeo
  existente o creación de una nueva (filas dinámicas columna-Excel → campo-destino),
  previsualización por fila con clasificación, aprobación/rechazo explícito antes de
  tocar el catálogo.
- **Asistente de Calidad de Datos** (`/ia`): pantalla única que combina RIA-01 y
  RIA-02 en vez de tratarlas como botones sueltos — tarjetas KPI (% de catálogo
  completo, piezas incompletas, duplicados por revisar, observaciones por analizar),
  botón de ejecución en lote de RIA-01 (deshabilitado con explicación si Gemma 4 no
  está configurado en el backend) y la cola de revisión con comparación legible de
  posibles duplicados (nombre de ambas piezas, no un JSON crudo). Es la respuesta a
  "2 soluciones innovadoras con IA" del enunciado: no una tercera funcionalidad, sino
  una forma de presentar las dos ya comprometidas como una sola herramienta coherente.
- Layout responsive verificado en viewport móvil (RNF-001: uso en depósito con
  tablet/celular).

### Pendiente

- **Migrar `VITE_API_BASE_URL` a la URL real de despliegue** una vez el backend esté
  en un servicio compartido (Render/Railway) apuntando a Supabase — hoy todo el
  equipo prueba contra `localhost:8000`.
- **Configurar el upload preset "unsigned" real en Cloudinary** y compartir
  `VITE_CLOUDINARY_CLOUD_NAME`/`VITE_CLOUDINARY_UPLOAD_PRESET` con el equipo (hoy
  nadie los tiene configurados; la UI cae al modo manual, que funciona pero no es
  la experiencia final).
- **RF-036 (exportación de resultados a Excel)**: el backend no expone todavía un
  endpoint real de exportación `.xlsx`; falta implementarlo en el backend antes de
  poder agregar el botón de "Exportar" en `PiezasPage`.
- **RF-034 (reporte de piezas por ubicación)**: sin endpoint en el backend aún; no
  hay pantalla de reportes dedicada en el frontend, solo el resumen inline de
  información incompleta.
- **Sin manejo de roles en la UI**: el rol viene del JWT y se muestra, pero ningún
  botón se oculta/deshabilita todavía según el rol del usuario (RF-039). Hoy la
  única protección real es la del backend (403 si el rol no alcanza).
- **Sin pruebas automatizadas de frontend** (el Plan de Adquisiciones prevé
  Playwright para E2E; no hay ningún test escrito en este repo todavía).
- **Sin CI/CD ni despliegue en Vercel configurado.**

## Convenciones de código

- El wire format de la API es **camelCase** (ver `src/types/index.ts`); no lo
  cambies a snake_case aunque el backend interno use snake_case en Python.
- Cada página en `src/pages/` es dueña de sus propias mutaciones/queries de
  TanStack Query; no hay una capa de "store" global aparte del `AuthContext`.
- Los mensajes de error al usuario pasan por `extraerMensajeError()` en `src/lib/api.ts`,
  que sabe interpretar tanto un `detail` string como una lista de errores de
  validación de FastAPI.
- **Sistema de diseño "glass" temático** (no uses `stone`/`amber` genéricos de
  Tailwind, ya se reemplazaron): paleta `clay` (terracota, inspirada en cerámica),
  `sand` e `ink` definida en `tailwind.config.js`, tipografía Fraunces (títulos,
  clase `font-display`) + Manrope (cuerpo), y un lenguaje "Liquid Glass" con las
  clases reutilizables de `src/index.css`:
  - `.glass-panel` / `.glass-panel-sm` — superficies translúcidas con blur para
    tarjetas y secciones.
  - `.glass-nav` — la barra de navegación flotante en `Layout.tsx`.
  - `.glass-input` — inputs/selects.
  - `.btn-primary` (acción principal, degradado terracota) / `.btn-glass`
    (acción secundaria) / `.btn-danger-text` (enlace de acción menor).
  - `.chip` — etiquetas de estado; añade `!bg-emerald-100/80 !border-emerald-200
    !text-emerald-800` para el estado "positivo" (completo/aprobado).
  - `.kpi-card` — tarjetas de métricas (ver `IASugerenciasPage.tsx`).
  Usa estas clases en vez de inventar combinaciones nuevas de `bg-white
  border rounded` — es lo que mantiene la app coherente entre páginas.

## Cómo correr esto

Ver [README.md](README.md). Requiere que `museo-backend` esté corriendo (por
defecto en `http://localhost:8000`).

## Flujo de equipo

Por la Estrategia de Gestión del proyecto: trabajo por rama, integración vía pull
request revisado por **un integrante distinto del autor**. Si agregas una pantalla
nueva o cambias una existente de forma visible, pruébala en el navegador contra el
backend real antes de dar el PR por terminado — no basta con que compile.
