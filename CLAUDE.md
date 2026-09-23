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

Este repo es el **frontend, conectado al backend real** (a diferencia del repo
`sgdcm-frontend`, que es el prototipo visual del mismo equipo con datos simulados
por MSW, sin backend). El backend vive en el repo hermano
[`museo-backend`](../museo-backend), clonado al lado de este en `E:\Codes\GIT`.
**Lee `../museo-backend/CLAUDE.md` también** — ahí está el detalle de las reglas de
negocio (RN-*) que esta interfaz debe respetar.

## Rediseño 2026-09: se adoptó el sistema de diseño del prototipo

Este frontend usaba antes una paleta propia "Liquid Glass" (terracota/clay,
Fraunces+Manrope). Se reemplazó por completo por el sistema de diseño oficial
MATP/PUCP que el equipo definió en `sgdcm-frontend/FRONTEND_DESIGN_SPEC.md`
(colores institucionales azul/rojo, Montserrat+Source Serif 4, logo oficial,
íconos Lucide) y se reestructuró la navegación a las **7 páginas** de esa
especificación — ver "Las 7 páginas" más abajo. La diferencia clave con el
prototipo: aquí **nada está simulado**; toda pantalla habla con el backend real
(FastAPI + PostgreSQL), incluido lo que en el prototipo era mock puro (usuarios,
QR, exportación, flujo de aprobación de ficha) — esas piezas se implementaron
también en `museo-backend` en la misma sesión de rediseño (ver su CLAUDE.md,
sección "Hecho y verificado", commits de HU-05/HU-06/HU-17/HU-21/HU-22).

## Leer antes de tocar código

1. `../sgdcm-frontend/FRONTEND_DESIGN_SPEC.md` — fuente única de verdad de diseño
   (colores, tipografía, iconografía, RBAC, las 7 páginas, componentes). Cualquier
   color/radio/sombra fuera de `tailwind.config.js`/`src/index.css` es un error.
2. `../museo-backend/docs/openapi.yaml` — contrato REST completo. `src/types/index.ts`
   es su espejo en TypeScript; si el backend cambia un endpoint, actualiza ambos.
3. `../museo-backend/docs/01-data-model.md` — para entender qué representa cada
   entidad (pieza, código externo, tenencia, ubicación...) y por qué.
4. `../DPW/ARCHIVOS/Matriz_Requerimientos_Museo_ATP_LuisRepetto_v2_ISO29148.xlsx` —
   los RF/RN/RNF/RIA originales, con evidencia de entrevista al cliente.
5. `../DPW/ARCHIVOS/02.Museo.PlanAdquisiciones.v1.pdf` — stack oficial del curso.

## Stack (no negociable sin tocar el Plan de Adquisiciones)

React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + axios.
Dos desviaciones documentadas (mismo criterio que la desviación de Cloudinary ya
documentada en `museo-backend/CLAUDE.md`):

- **`lucide-react`**: librería de íconos exigida por la especificación de diseño
  §4 (monolínea, ISC, gratis). Sin ella habría que dibujar ~25 íconos a mano.
- **`qrcode`**: generación de códigos QR reales para Ubicación y movimientos
  (HU-07). Librería libre y sin costo; se prefirió sobre un patrón simulado
  porque el QR debe ser escaneable de verdad (apunta a la ficha de la pieza en
  este mismo sistema), no solo visualmente parecido a uno.

## Las 7 páginas (spec §6, §8) y sus roles

| Ruta | Página | Roles (nombres reales del backend, ver `src/lib/secciones.ts`) |
|---|---|---|
| `/` | Panel principal | todos |
| `/coleccion` | Colección | Administrador, Gestor de colecciones, Catalogador/practicante, Consulta interna |
| `/ubicacion-y-movimientos` | Ubicación y movimientos | Administrador, Conservación |
| `/importacion` | Importación | Administrador, Catalogador/practicante |
| `/consultas-y-reportes` | Consultas y reportes | Administrador, Gestor de colecciones, Consulta interna |
| `/asistente-ia` | Asistente IA | Administrador, Gestor de colecciones, Catalogador/practicante |
| `/administracion` | Administración | Administrador |

`ROL_ETIQUETA` en `secciones.ts` traduce esos nombres técnicos (los que ya usa
`app/core/roles.py` en el backend) a los nombres "amigables" del spec (Curador,
Conservador, Consulta) **solo para mostrar en la UI** — la autorización real
siempre compara contra el nombre técnico. Rutas legadas `/piezas`, `/colecciones`
e `/ia` redirigen a sus equivalentes nuevas (`/coleccion`, `/coleccion`,
`/asistente-ia`) para no romper enlaces existentes.

`RequireRole` (spec §5): un ítem de nav no permitido no se renderiza
(`seccionesPara(rol)` en `NavEnlaces`); visitar una ruta directamente sin permiso
redirige a `/`. Esto es solo UX — la autorización real la valida el backend
(401/403) en cada endpoint.

## Estado actual

### Hecho y verificado en el navegador contra el backend real

- **Sistema de diseño oficial**: tokens de `FRONTEND_DESIGN_SPEC.md` §3 en
  `tailwind.config.js` (azul/rojo/rojo-oscuro/gris-1/gris-2/arcilla/paja/verde/
  texto/fondo-suave/linea/foco) + Montserrat/Source Serif 4. Las clases viejas
  (`clay`/`sand`/`ink`/`indigo`) se mantienen como **alias** apuntando a los
  tokens nuevos para no reescribir cada página — código nuevo debe usar los
  nombres oficiales (`bg-rojo`, `text-azul`, etc.) directamente.
- **Logo y marca oficiales**: SVG de `public/brand/` (copiados tal cual de
  `sgdcm-frontend/public/brand/`, nunca redibujados — son signos registrados de
  la PUCP). Favicon `matp_avatar_rojo.svg`, header con `matp_lockup_positivo.svg`,
  footer con `matp_lockup_sobre_azul_blanco.svg`.
- **Header/nav/footer rediseñados** (`components/Layout.tsx`): escritorio con
  lockup + nav filtrado por rol + menú de cuenta; móvil con isotipo + indicador
  de rol + menú a pantalla completa (`<dialog>` nativo, foco atrapado gratis).
- **Panel principal** (`PanelPrincipalPage`, HU-17/HU-09): KPIs reales desde
  `GET /reportes/panel-principal` (total, % completo, sin ubicación, requieren
  restauración), barras de distribución por colección, alertas con enlace a la
  ficha.
- **Colección** (`PiezasPage`/`PiezaDetailPage`): todo lo que ya funcionaba
  (búsqueda, alta, identificadores con 🔒, fotografías, movimientos, auditoría)
  más el widget "Gestionar colecciones" (RF-010, plegable) y el **flujo de
  aprobación de ficha real** (HU-05): botones Enviar a revisión/Aprobar/Rechazar
  visibles-pero-deshabilitados según rol y estado actual, `PATCH
  /piezas/{id}/estado-ficha`, chip de estado con los colores del spec §7, motivo
  de rechazo obligatorio.
- **Ubicación y movimientos** (`UbicacionMovimientosPage`, nueva, HU-07/HU-08):
  selector de pieza, breadcrumb jerárquico real (`lib/ubicaciones.ts`), **código
  QR real** (librería `qrcode`, no un patrón simulado — apunta a la ficha de la
  pieza) con botón de impresión (`window.print()`), formulario de traslado e
  historial, todo contra los endpoints reales de `museo-backend`.
- **Importación**: sin cambios funcionales, solo re-estilizada.
- **Consultas y reportes** (`ConsultasReportesPage`, nueva, HU-14 a HU-16):
  búsqueda multifacética solo sobre piezas `estadoFicha=aprobada`; AND lo
  resuelve el backend en una consulta; **OR se resuelve en el cliente** (una
  consulta real por filtro activo + unión por id — el backend no tiene
  semántica OR nativa; ver comentario en el archivo) — nunca se inventan datos.
  Exportar Excel llama a `GET /reportes/exportar` real (`.xlsx` real, no
  simulado); "Exportar PDF" abre una vista imprimible (`window.print()`), el
  PDF real lo genera el navegador vía "Guardar como PDF" — mismo criterio que
  usó el prototipo hermano para no requerir una librería de generación de PDF
  en el servidor.
- **Asistente IA** (`AsistenteIAPage`, antes `IASugerenciasPage`): todo lo que
  ya funcionaba (RIA-01/RIA-02, KPIs de calidad de datos) más el botón
  **"Fusionar"** (HU-21, `POST /ia/sugerencias/{id}/fusionar`) sobre pares de
  posibles duplicados, y una sección de **"búsqueda asistida por vocabulario
  controlado"**: reconoce colecciones/categorías reales dentro de la pregunta y
  cuenta piezas aprobadas — deliberadamente **no** se implementó como un chat
  RAG/Text-to-SQL real (HU-20 lo pide, pero no hay modelo de lenguaje para eso
  en el stack ni presupuesto para uno nuevo) ni se simuló una respuesta de IA
  que no existe: mismo principio de "nunca fingir una respuesta de IA" que ya
  rige RIA-01 en `museo-backend` (ver su CLAUDE.md).
- **Administración** (`AdministracionPage`, nueva, HU-06/HU-22): usuarios y
  roles (CRUD real contra `/usuarios`+`/roles`), catálogos maestros/vocabularios
  (alta + baja con bloqueo 409 si el término está en uso), bitácora de auditoría
  global (`GET /auditoria`). Todo real, ninguna lista mock aparte del login
  (a diferencia del prototipo, donde "crear un usuario" no habilitaba acceso
  real — aquí sí, porque pega contra el mismo backend que autentica).
- Layout responsive verificado en viewport móvil (RNF-001) y RBAC verificado con
  Playwright: el nav de un Catalogador no muestra Ubicación/Consultas/Administración,
  y visitar esas rutas a mano redirige a `/`.

### Pendiente

- **Migrar `VITE_API_BASE_URL` a la URL real de despliegue** una vez el backend esté
  en un servicio compartido (Render/Railway) apuntando a Supabase — hoy todo el
  equipo prueba contra `localhost:8000`.
- **Configurar el upload preset "unsigned" real en Cloudinary** y compartir
  `VITE_CLOUDINARY_CLOUD_NAME`/`VITE_CLOUDINARY_UPLOAD_PRESET` con el equipo (hoy
  nadie los tiene configurados; la UI cae al modo manual, que funciona pero no es
  la experiencia final).
- **HU-20 (chat RAG/Text-to-SQL real)**: la búsqueda asistida actual es honesta
  pero limitada (reconoce solo colección/categoría, no fechas ni rangos); si el
  equipo consigue presupuesto/tiempo para integrar Gemma en este flujo, sería
  una extensión natural de RIA-01 (mismo proveedor, mismo patrón de fallo
  explícito si no está configurado).
- **HU-22 (SSO PUCP/Google Workspace)**: no implementado — fuera del stack
  cerrado (JWT propio); anotado igual en `museo-backend/CLAUDE.md`.
- **Sin pruebas automatizadas de frontend** (el Plan de Adquisiciones prevé
  Playwright para E2E; no hay ningún test escrito en este repo todavía — el
  rediseño se verificó manualmente en el navegador contra el backend real,
  capturas en la conversación de la sesión que lo hizo).
- **Sin CI/CD ni despliegue en Vercel configurado.**

## Convenciones de código

- El wire format de la API es **camelCase** (ver `src/types/index.ts`); no lo
  cambies a snake_case aunque el backend interno use snake_case en Python.
- Cada página en `src/pages/` es dueña de sus propias mutaciones/queries de
  TanStack Query; no hay una capa de "store" global aparte del `AuthContext`.
- Los mensajes de error al usuario pasan por `extraerMensajeError()` en `src/lib/api.ts`,
  que sabe interpretar tanto un `detail` string como una lista de errores de
  validación de FastAPI.
- **Sistema de diseño oficial MATP/PUCP** (ver `FRONTEND_DESIGN_SPEC.md` del
  prototipo hermano): paleta azul/rojo/gris institucional en `tailwind.config.js`,
  tipografía Montserrat (`font-display`, también la base `sans`) + Source Serif 4
  itálica (`font-accent`, **solo** para el nombre de la pieza en la ficha), radios
  por componente (`rounded-btn|card|modal|pill`), una sola sombra (`shadow-sombra`).
  Clases reutilizables de `src/index.css` (los nombres se conservan del sistema
  "glass" anterior por compatibilidad, pero ya no dibujan translucidez/blur):
  - `.glass-panel` / `.glass-panel-sm` — tarjeta sólida blanca, `rounded-card`,
    `shadow-sombra`, borde `linea`.
  - `.glass-input` — inputs/selects; foco = anillo `--foco` 3px, nunca se quita.
  - `.btn-primary` (rojo, acción principal) / `.btn-glass` (borde azul,
    acción secundaria) / `.btn-danger-text` (texto azul, bajo énfasis).
  - `.chip` — pill azul/fondo-suave; usa `<ChipEstadoFicha estado={...} />`
    (componente, no clases sueltas) para los 4 colores de estado de ficha (§7).
  - `.kpi-card` — tarjetas de métricas.
  - `.form-label` — etiqueta de campo (Montserrat SemiBold 12px mayúsculas).
  Usa estas clases en vez de inventar combinaciones nuevas — es lo que mantiene
  la app coherente entre páginas.
- **Íconos**: solo `lucide-react`, según el mapa de `FRONTEND_DESIGN_SPEC.md` §4,
  más el ícono propio `IconoRetablo` (sección Colección, máscara CSS sobre
  `public/brand/icon_retablo_24.svg`).

## Cómo correr esto

Ver [README.md](README.md). Requiere que `museo-backend` esté corriendo (por
defecto en `http://localhost:8000`).

## Flujo de equipo

Por la Estrategia de Gestión del proyecto: trabajo por rama, integración vía pull
request revisado por **un integrante distinto del autor**. Si agregas una pantalla
nueva o cambias una existente de forma visible, pruébala en el navegador contra el
backend real antes de dar el PR por terminado — no basta con que compile.
