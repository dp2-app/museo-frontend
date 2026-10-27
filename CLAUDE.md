# Contexto del proyecto — museo-frontend

> Este archivo lo lee automáticamente Claude Code al abrir este repo. Está pensado
> para que **cualquier integrante del equipo**, al pedirle ayuda a su Claude en este
> proyecto, tenga el mismo contexto sin tener que reexplicarlo. **Actualízalo** cuando
> termines algo de la sección "Pendiente" o cuando tomes una decisión de diseño nueva —
> es más barato mantenerlo al día que dejar que quede desactualizado..

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
MATP/PUCP que el equipo definió en `prototipo-frontend/FRONTEND_DESIGN_SPEC.md`
(colores institucionales azul/rojo, Montserrat+Source Serif 4, logo oficial,
íconos Lucide) y se reestructuró la navegación a las **7 páginas** de esa
especificación — ver "Las 7 páginas" más abajo. La diferencia clave con el
prototipo: aquí **nada está simulado**; toda pantalla habla con el backend real
(FastAPI + PostgreSQL), incluido lo que en el prototipo era mock puro (usuarios,
QR, exportación, flujo de aprobación de ficha) — esas piezas se implementaron
también en `museo-backend` en la misma sesión de rediseño (ver su CLAUDE.md,
sección "Hecho y verificado", commits de HU-05/HU-06/HU-17/HU-21/HU-22).

## Leer antes de tocar código

1. `../prototipo-frontend/FRONTEND_DESIGN_SPEC.md` — fuente única de verdad de diseño
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

## Las 7 páginas (spec §6, §8) y sus permisos

| Ruta | Página | Se muestra con al menos uno de estos permisos (`src/lib/secciones.ts`) |
|---|---|---|
| `/` | Panel principal | cualquier usuario con sesión |
| `/coleccion` | Colección | `piezas.ver` |
| `/ubicacion-y-movimientos` | Ubicación y movimientos | `movimientos.registrar`, `estados.cambiar`, `ubicaciones.gestionar` |
| `/importacion` | Importación | `importacion.ver`, `importacion.cargar` |
| `/consultas-y-reportes` | Consultas y reportes | `reportes.ver` |
| `/asistente-ia` | Asistente IA | `ia.usar` |
| `/administracion` | Administración | cualquiera de los `*.ver` de configuración, usuarios, roles y auditoría |

**La autorización es por permiso, nunca por nombre de rol (F9, RNF-08).** `usePermisos()` lee `GET /auth/sesion` (`puede`, `puedeAlguno`); no se decodifica el JWT.
`ROL_ETIQUETA` solo traduce el nombre del rol para mostrarlo. El permiso real de cada acción está en `Base-de-conocimiento` y en `museo-backend/docs/matriz-permisos.md`.
Cada sección de Administración se muestra con su permiso «ver» y sus acciones de edición dependen de su permiso «editar». La pantalla de roles asigna un nivel por funcionalidad (sin acceso / solo ver / ver y editar) y, en la misma pantalla, los campos de la ficha que el rol ve. Más detalle en `docs/f9/README.md`.

`RequirePermiso` (spec §5): un ítem de nav no permitido no se renderiza (`seccionesPara(puedeAlguno)`); visitar una ruta directamente sin permiso redirige a `/`.
Esto es solo UX: la autorización real la valida el backend (401/403) en cada endpoint. Rutas legadas `/piezas`, `/colecciones` e `/ia` redirigen a sus equivalentes.

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


## F0 · frontend v3 autorizado (19/10/2026)

El líder autorizó específicamente las pantallas F0 según el pedido del dueño; las notas globales de evaluación las cambia el líder. Alcance: Administración con campos, listas/equivalencias, institución y vista previa. `src/components/f0/` contiene esas secciones y los componentes reutilizables `FormularioFicha` y `CamposFaltantes` para F2. No se construye la matriz de visibilidad (F9).

- Campos y listas se leen del contrato v3: `/campos-ficha`, `/config/campos-ficha`, `/listas/{clave}/valores`. No introducir vocabularios fijos ni datos MSW.
- `api.ts` admite errores v3 y legados y normaliza el nombre del token v3 exclusivamente para el login legado. `usePermisos()` lee `/auth/sesion`; el JWT no es fuente de permisos. AuthContext permanece intacto.
- `useConsultaF0()` separa la caché por cuenta/sesión. No reutilizar catálogos visibles de otra cuenta.
- `FormularioFicha` entrega `{campos, listas}` sin campos de solo lectura/inactivos; el consumidor F2 aporta el guardado y la versión de PATCH. Sin callback es vista previa y nunca escribe piezas. Solo ayuda visual para obligatorios; toda validación real está en el backend.
- `CamposFaltantes` muestra el resultado del backend, incluidas las claves `codigos_externos`/`fotografias`; no vuelve a calcular completitud ni reglas de régimen.
- Se conservan los tipos/páginas de otros flujos. Las incompatibilidades de esos flujos con v3 se informan sin corregirlas dentro de F0. Ver `docs/f0/README.md`.
- Usar tokens existentes y foco visible. En F0 se usa `rojo-oscuro` para contraste AA de botones con texto blanco, sin crear colores; las entradas móviles usan 16 px.
- Verificación: `npm run build`, `npm run lint` (dos advertencias previas), Playwright opcional `npm run test:f0` con runtime ya disponible. Evidencia y capturas en `docs/f0/`. Nunca probar contra Supabase durante desarrollo.

## F1 · identificadores y tenencia (21/10/2026)

Pantallas sobre el contrato v3 (requiere museo-backend#41). Detalle, pruebas y capturas en `docs/f1/README.md`.

- **Administración › Códigos y tenencia** (`config.codigos_tenencia`): tipos de código (RF-55), regímenes y códigos que admiten (RF-56) y propietarios (`propietarios.ver`). `PERMISOS_ADMINISTRACION` solo suma `config.codigos_tenencia`: Administración sigue siendo configuración.
- **Colección › Pendientes de código I** (`/coleccion/pendientes-codigo-i`, RF-06) y **Préstamos temporales** (`/coleccion/prestamos-temporales`, `tenencias.ver`). Se llega por `<AccesosF1 />` en `PiezasPage`; consérvalo al reescribir la página.
- Para la ficha (F2): `AgregarCodigo`, `CorregirCodigo` (RF-05), `ResultadoValidacion` e `InsigniaPendienteI` en `components/f1/`; hooks en `hooks/useCodigosF1.ts` y `hooks/useCatalogosF1.ts`; tipos en `types/f1.ts`; criterios (`pendienteDeCodigoI`, `admite`, `puedeCorregir`) en `lib/f1.ts`.
- Validar mientras se escribe es `POST /codigos/validar` en modo `manual`; la regla final siempre es del backend. Una corrección se valida sin pieza ni régimen (lo mismo que revisa `corregir_codigo`).
- Una pieza nueva sin régimen toma el primer régimen activo de inventario por `orden`: la pantalla de regímenes lo marca y propone el orden siguiente al mayor.
- Verificación: `npm run build`, `npm run lint` y `npm run test:f1` (Playwright, backend real local, cuentas en `F1_ACCOUNT_FILE`).

## F10 · Armar sala (RIA-05), autorizado por el líder (25/10/2026)

Pestaña «Armar sala» del Asistente IA (`src/components/f10/ArmarSala.tsx`); la pestaña «Calidad de datos» conserva lo anterior (RIA-01/RIA-02, sin adaptar aún al contrato v3).

- `POST /ia/salas/sugerir` `{pedido, cantidad}` (10–30) devuelve `SalaSugerida`: mensaje breve de la IA, ranking con puntaje y alertas (`ficha_no_aprobada`, `conservacion`, `en_prestamo`). Se muestra tal cual: el frontend no reordena, no filtra ni completa nada.
- El curador marca piezas (por defecto todas) y `POST /ia/salas/{sugerenciaId}/exportar` `{piezaIds}` descarga el Excel. El botón se habilita con `reportes.exportar`; el backend vuelve a validar.
- Sin IA configurada el backend responde 503 y se muestra su mensaje: nunca se simula una respuesta (DA-006).
- Con `ia.ejecutar_lote`, arriba aparece `EstadoIndiceSalas`: piezas con búsqueda por significado al día, pendientes, uso de hoy contra el cupo diario (con el 7 % reservado para consultas), última y próxima indexación diaria (`GET /ia/salas/indice`, se refresca cada 15 s mientras corre) y el botón «Indexar ahora» (`POST /ia/salas/indexar`).
- Contrato y decisiones: `Base-de-conocimiento/flujos/F10.md` (RIA-05) y `DA-015`. Verificado con `npm run build`, `npm run lint` (dos advertencias previas) y en el navegador contra el backend local (escritorio y móvil; sin claves de IA solo se probó el estado 503).

## F2/F6 autorizado y validado (27/10/2026)

El usuario autorizó frontend F2 y F6 completo, con notificación previa a cambios y actualización de conocimiento. Ver docs/f2-f6/README.md y ../Base-de-conocimiento/flujos/F2-F6-implementacion-2026-10-27.md. Colección, ficha y ubicación/movimientos usan v3 (campos/listas/etiquetas, version, baja POST con motivo). No restaurar tipos/endpoints legados en estas páginas. FormularioFicha admite edicion/etiquetasActuales opcionales sin alterar la vista previa. Pruebas de navegador contra API/PostgreSQL local real; no usar producción. N10 sigue abierta. Se conserva acceso a extracción de observaciones F10 sin cambiar su backend.
