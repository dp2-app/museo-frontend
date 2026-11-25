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
| `/asistente-ia` | Asistente IA | `ia.usar`, `piezas.ver` (con solo `piezas.ver` se ve únicamente la pestaña «Preguntar») |
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
- **Importación**: sobre la API de datos `/datos/v1/importacion/*` mediante `datosApi` (selección de hoja, revisión del lote, aprobar/rechazar/cancelar). F5 agrega reglas de duplicado, bitácora con reglas aplicadas y cola de curación (ver `docs/f5/README.md`).
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
- **Asistente IA** (`AsistenteIAPage`, antes `IASugerenciasPage`) — *histórico: la pestaña «Calidad de datos» descrita
  aquí se retiró el 03/11/2026 (ver «F10 · Preguntar»)*: todo lo que
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

Pestaña «Armar sala» del Asistente IA (`src/components/f10/ArmarSala.tsx`). La pestaña «Calidad de datos» (RIA-01/RIA-02) se retiró el 03/11/2026: ver «F10 · Preguntar».

- `POST /ia/salas/sugerir` `{pedido, cantidad}` (10–30) devuelve `SalaSugerida`: mensaje breve de la IA, ranking con puntaje y alertas (`ficha_no_aprobada`, `conservacion`, `en_prestamo`). Se muestra tal cual: el frontend no reordena, no filtra ni completa nada.
- El curador marca piezas (por defecto todas) y `POST /ia/salas/{sugerenciaId}/exportar` `{piezaIds}` descarga el Excel. El botón se habilita con `reportes.exportar`; el backend vuelve a validar.
- Sin IA configurada el backend responde 503 y se muestra su mensaje: nunca se simula una respuesta (DA-006).
- Con `ia.indexar` (solo el Administrador, museo-backend#163; antes `ia.ejecutar_lote`), arriba aparece `EstadoIndiceSalas`: piezas con búsqueda por significado al día, pendientes, uso de hoy contra el cupo diario (con el 7 % reservado para consultas), última y próxima indexación diaria (`GET /ia/salas/indice`, se refresca cada 15 s mientras corre) y el botón «Indexar ahora» (`POST /ia/salas/indexar`).
- Contrato y decisiones: `Base-de-conocimiento/flujos/F10.md` (RIA-05) y `DA-015`. Verificado con `npm run build`, `npm run lint` (dos advertencias previas) y en el navegador contra el backend local (escritorio y móvil; sin claves de IA solo se probó el estado 503).

## F7 · filtros de Colección (2/11/2026)

La pantalla Colección reutiliza `FiltrosReporte` (F8): texto, código, colección, ubicación, estados, material, tipo de bien, clasificación, autor, procedencia y época. No dupliques otro formulario de filtros: agrega el campo al componente y a `lib/reportes.ts`. Detalle en `docs/f7/README.md`; reglas del texto (sin tildes, por palabras) en `museo-backend/CLAUDE.md`. Prueba: `npm run test:f7`.

## F2/F6 autorizado y validado (27/10/2026)

El usuario autorizó frontend F2 y F6 completo, con notificación previa a cambios y actualización de conocimiento. Ver docs/f2-f6/README.md y ../Base-de-conocimiento/flujos/F2-F6-implementacion-2026-10-27.md. Colección, ficha y ubicación/movimientos usan v3 (campos/listas/etiquetas, version, baja POST con motivo). No restaurar tipos/endpoints legados en estas páginas. FormularioFicha admite edicion/etiquetasActuales opcionales sin alterar la vista previa. Pruebas de navegador contra API/PostgreSQL local real; no usar producción. N10 sigue abierta. Se conserva acceso a extracción de observaciones F10 sin cambiar su backend.

## F8 · Consultas y reportes sobre v3 (28/10/2026)

`ConsultasReportesPage` usa el contrato v3 (requiere museo-backend#59): filtros comunes de F7 para búsqueda y reportes
(`components/f8/`, `hooks/useOpcionesFiltro.ts`, `lib/reportes.ts`), pestañas Inventario, Por estado, Por ubicación e
Información incompleta (con % por colección), Excel por `datosApi` y catálogo completo solo con `reportes.exportar_total`.
Se muestra lo que arma el backend, sin recalcular. PDF: impresión del navegador mientras P36 siga abierta. Detalle en `docs/f8/README.md`.
La pestaña **Indicadores** (P37, requiere museo-backend#124) muestra tarjetas y una tabla por colección (`components/f8/Indicadores.tsx`); cada una trae el `filtro` de F7 que lista lo que falta
y «Ver piezas» lo aplica en Búsqueda (`verPiezas` en la página; `FiltrosReporte` acepta `inicial` y se remonta con `key`). La comparación con la línea base solo llega para quien ve todo el catálogo.

## F10 · Preguntar (RIA-06, 03/11/2026)

Pestaña «Preguntar» del Asistente IA (`src/components/f10/PreguntarColeccion.tsx`), primera pestaña; se ve con `piezas.ver`. «Armar sala» sigue con `ia.usar`.

**Retiro de «Calidad de datos» (03/11/2026, decisión del dueño de F10):** la pestaña seguía sobre el contrato anterior al v3. El KPI mostraba «undefined», los nombres de los duplicados no cargaban y la cola mezclaba propuestas de sala. Se quitaron:
- la pestaña completa, con sus KPIs, la cola de RIA-01/RIA-02, «Fusionar» (HU-21) y la `BusquedaAsistida`, que reemplaza «Preguntar»;
- el panel «Revisión de observaciones» de la ficha (`PiezaDetailPage`), que generaba sugerencias de RIA-01 que ya no tendrían dónde revisarse.

Los endpoints (`/ia/sugerencias`, `/ia/extraccion-observaciones/*`, `/ia/deteccion-duplicados`, `/reportes/calidad-datos`) siguen en el backend y sus tipos siguen en `src/types/index.ts`.

- `POST /ia/consultas` `{pregunta}` devuelve `ConsultaIA`: mensaje (lo arma el backend con el total real), `interpretacion` (un chip por filtro con su estado), `avisos`, `filtros` (parámetros de `GET /piezas`), `total` y la página 1 de piezas (`Ficha`).
- Quitar un chip o elegir una alternativa de un filtro `ambiguo` recalcula los filtros en el cliente y pide `GET /piezas` (también para las páginas siguientes): **no vuelve a llamar a la IA**. La exportación usa `descargarExcel("/exportaciones/piezas.xlsx", filtros)` con `reportes.exportar`.
- Sin IA configurada el backend responde 503 y se muestra su mensaje. Contrato y decisiones: `Base-de-conocimiento/flujos/F10.md` (RIA-06).
- **RIA-06 es solo registro (D4, museo-backend#160):** al quitar un chip o elegir una alternativa, además de buscar, la pantalla manda
  `PUT /ia/consultas/{sugerenciaId}/filtros-aplicados` `{filtros}` para que el registro de la consulta guarde con qué filtros se quedó la
  persona. Es solo trazabilidad: si falla, no se muestra error ni cambia la búsqueda. Más de 10 consultas por minuto dan 429 `limite_consultas`.
- **Espera de la IA (#101):** «Preguntar» y «Armar sala» usan `EsperaIA` (`components/f10/EsperaIA.tsx`): aro animado, mensajes de avance
  que se suceden hasta el último, esqueleto de resultados y, a los 20 s, aviso de que el proveedor está ocupado. Las animaciones van con
  `motion-safe:` (nada se mueve con `prefers-reduced-motion`) y el lector de pantalla oye un solo aviso. Úsalo en cualquier espera de IA nueva.

## Inicio, «Qué le falta» y cifras únicas (16/11/2026, issues #118, #121, #208 a #210)

- Navegación: Inicio, Colección, Ubicación y movimientos, Importación, Consultas y reportes, **Armar sala** (antes «Asistente IA»), Administración. Sin códigos internos (HU/RF/RN) en textos visibles.
- **Inicio** (`PanelPrincipalPage`) muestra lo que arma `GET /reportes/panel-principal`: fichas completas, «Por qué hay N fichas incompletas» (`motivosIncompletas`, un botón «Completar» por motivo) y pendientes; cada enlace lleva a `/coleccion?<filtro de F7>` con el `filtro` que trae el backend (`enlaceColeccion`, `filtrosDeDireccion` en `lib/reportes.ts`). No recalcula nada.
- **Colección**: la columna «Qué le falta» muestra un chip por cada clave de `camposFaltantes`; cada chip abre la ficha con `?campo=<clave>`, que abre la edición, señala los campos que faltan (borde, `aria-invalid`, barra «Faltan N campos») y enfoca el pedido. `FormularioFicha` recibe `faltantes` y `enfocar`.
- **Inventario ya no trae `resumen`** (museo-backend#211): el resumen vive en Inicio y en el nuevo `GET /reportes/estado-catalogo`; esta pantalla solo lista una fila por pieza.
- **Armar sala** muestra `condiciones` del pedido como chips que se quitan (`ignorarCondiciones`); el frontend no filtra, vuelve a pedir la propuesta.
- Este cambio exige museo-backend#211 (ya mergeado).
- **Segunda entrega (#119, #120, #121, #208):** Gestionar colecciones es una tabla con panel lateral; **Ubicación y movimientos** tiene el árbol sede › ubicación a la izquierda y la tabla de piezas con casillas a la derecha: sobre las marcadas se «Mueve» (motivo obligatorio) o se «Cambia el estado», una a una contra `POST /piezas/{id}/movimientos|estados` (no hay endpoint masivo) y se informa cuáles fallaron; sedes y ubicaciones tienen su pantalla (`/ubicacion-y-movimientos/sedes`).
  «Preguntar» pasó a **«Buscar con IA»** dentro de Colección (`piezas.ver`); `/asistente-ia` (Armar sala) pide solo `ia.usar`. La pestaña «Indicadores» pasó a **«Estado del catálogo»** (`GET /reportes/estado-catalogo`, `faltantes` campo por campo con su «Ver piezas»).
  `?campo=fotografias|codigos_externos` lleva a esa sección de la ficha (no son campos del formulario). Sin vista previa del próximo código de la colección: el backend no tiene ese endpoint.

## F10 · prueba de punta a punta (17/11/2026)

`npm run test:f10` (`tests/f10.e2e.cjs`, guía en `docs/f10/README.md`) recorre Buscar con IA, Armar sala, los permisos de F10 por rol, el límite de
consultas y RIA-01 contra el backend local con Groq real. La evidencia (capturas con datos reales del inventario) **no se sube aquí, que es público**:
va a `Base-de-conocimiento/flujos/evidencias/`. La CI corre `npm run test:unit`; las pruebas e2e necesitan backend y Chrome y se corren a mano.


## Refinamiento visual unificado · 22/11/2026

La rama `Refactorización` aplica el estándar de `../prototipo-frontend/FRONTEND_DESIGN_SPEC.md` §26 (rama documental `docs/refinamiento-visual-20261122`). La especificación sigue teniendo una sola fuente. Componentes comunes, controles de 44px, texto secundario accesible, primario rojo oscuro y fotografía completa; Dub/ORYZO son referencias, no dependencias. Se conservan contratos, permisos, siete destinos y formato de impresión. No crear consultas por cada pieza del catálogo para obtener una miniatura: la respuesta actual del listado no incluye fotografías. Las pruebas visuales usan datos sintéticos aislados y no certifican mutaciones del backend.

La segunda pasada visual solicitada por el usuario sigue §27: navegación lateral, paleta petróleo/cobre/marfil, tarjetas fotográficas con `fotoPrincipal` de la API y selección de piezas en Inicio. La primera afirmación de que el listado no incluye fotografía era incorrecta; no añadir consultas por tarjeta. Es una propuesta visual de refactorización pendiente de revisión institucional, con logotipos originales intactos.


### Acceso visual · 22/11/2026

`LoginPage` usa los activos de marca existentes, panel editorial petróleo/arena, tarjeta de acceso sobre marfil y acción cobre. No depende de imágenes externas. Incluye control accesible para mostrar/ocultar contraseña, estados de espera y espacio reservado para errores. Se conservan `useAuth`, la autenticación real y el retorno a la ruta previa tras vencer la sesión. No añadir enlaces de recuperación de contraseña sin un flujo implementado. Comprobado con Playwright en cinco tamaños, errores/espera simulados y acceso real contra la copia local aislada.

## Inicio, reportes y salas (24/11/2026)

Inicio prioriza colecciones y pendientes; los motivos de incompletitud empiezan plegados. Reportes abre en Estado del catálogo con cobertura, faltantes y avance por colección (`components/f8/PanoramaCatalogo.tsx`); Búsqueda, filtros, exportaciones e impresión se conservan. Salas usa un formulario de tema/cantidad y `CatalogoSala` (cuatro columnas en escritorio o lista, selección compartida y fotografías ampliables). La API debe incluir `PiezaSala.fotoPrincipal` (museo-backend, ampliación aditiva). No pedir fichas individuales por tarjeta ni inventar fotos/porcentajes. Recorrido, heurísticas, pruebas y limitaciones en `docs/ux-2026-11-24.md`.

## Fotografía desde el celular (23/11/2026)

En la ficha, el panel «Fotografías» muestra **«Fotografía rápida»** (`components/TomarFotoPieza.tsx`) con el permiso `fotos.gestionar`: «Tomar foto» abre la cámara trasera (`<input type="file" accept="image/*" capture="environment">`; en el computador abre el selector de archivos), se ve la vista previa y «Guardar fotografía» sube la imagen y la registra con `POST /piezas/{id}/fotografias` en un solo paso. «Elegir de la galería» y «Repetir» completan el flujo.
- `lib/fotoCamara.ts` reduce la foto a 2400 px de lado mayor, respeta la orientación EXIF y la pasa a JPEG: una foto de 8–12 MB sale en ~0,5 MB y cumple siempre «JPG o PNG hasta 15 MB». HEIC que el navegador no pueda leer da un aviso de cambiar la cámara a «Más compatible».
- Usa la subida directa a Cloudinary (`lib/cloudinary.ts`); sin `VITE_CLOUDINARY_CLOUD_NAME`/`VITE_CLOUDINARY_UPLOAD_PRESET` el panel dice que falta configurarla y queda solo el formulario por URL. No hay cambios en el backend ni en la API.
- Camino rápido para completar fichas: el chip «Fotografía» de «Qué le falta» (`?campo=fotografias`) lleva a esa sección; al guardar, la ficha se refresca y ese faltante desaparece.
- Pruebas: `npm run test:unit` (reducción de tamaño) y `npm run test:foto-camara` (Pixel 7 emulado contra el backend local; **Cloudinary se intercepta**, así que la subida real a Cloudinary no está certificada por esa prueba).

## Asistentes de registro e importación y popup de ubicaciones (24/11/2026)

`RegistroPiezaModal` reutiliza F0/F1 en cuatro etapas: ficha, identificación, fotos y confirmación; crea en borrador al confirmar. `lib/altaPieza.ts` conserva resultados confirmados para reintentar fotos sin repetirlos. La selección de archivos y cámara requiere Cloudinary; también se admiten enlaces HTTPS de imágenes. `UbicacionModal` comparte creación y edición desde la cabecera y el catálogo: nombre, código, dirección y sede para ubicaciones interiores son obligatorios, también en la API. Se conserva sede › ubicación. `DialogoMuseo` gestiona foco, Escape y bloqueo durante escrituras. La importación conserva su propio asistente y RN-08.

Detalle, heurísticas y evidencia: `docs/asistentes-2026-11-24.md`. Backend completo: 634 pruebas aprobadas (197 unitarias y 437 de integración) en base de QA local; frontend: 35 unitarias. E2E reales y verificación HTTP de las altas, fotos, principal, códigos y movimientos iniciales. Estas verificaciones locales no certifican Groq ni Cloudinary externos sin sus configuraciones; la publicación se verifica por separado.

## IA integrada en Colección y filtro de fotografía (24/11/2026)

- **Buscar con IA (RIA-06) está en la barra de búsqueda de Colección** (`components/f10/BarraBusquedaIA.tsx`, que reemplaza a `PreguntarColeccion.tsx`):
  - «Buscar» aplica `q` sin IA.
  - «Preguntar a la IA» aplica los `filtros` de `POST /ia/consultas` a la misma grilla y a `FiltrosReporte`. `PiezasPage` remonta el formulario con un contador `version` en su `key`.
  - No hay tabla aparte. Los chips «Entendí» siguen pudiéndose quitar o elegir, sin volver a llamar a la IA y con `filtros-aplicados` (D4).
- **Armar sala se abre desde el trabajo diario:** Colección, Inicio, la ficha («Armar sala con piezas como esta») y la barra. Todos usan `/asistente-ia?tema=`: `ArmarSala` precarga el tema y no lo envía solo.
- **Fotografía:** en `FiltrosReporte` es un selector Todas / Con / Sin (`conFotografia` / `sinFotografia`, nunca juntos). Sirve para Colección y Reportes.
- Verificación: lint, build, `test:unit` y Playwright con API simulada. `tests/f10.e2e.cjs` se ajustó a la barra; necesita backend local con Groq.
- **Ajustes de UX para la expo (25/11/2026):**
  - La galería de Inicio pide `conFotografia: true`.
  - Colección tiene el acceso «Ver piezas con fotografía» / «Ver todas las piezas», que alterna `conFotografia`.
  - «Preguntar a la IA» ya no se deshabilita con la barra vacía: enfoca el campo y sugiere un ejemplo.
  - Cuando faltan datos, la tarjeta dice «Le falta» en lugar de «Información de la ficha».
