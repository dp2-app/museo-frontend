# Refinamiento visual del museo

La fuente de diseño es `prototipo-frontend/FRONTEND_DESIGN_SPEC.md`, §26, en la rama documental `docs/refinamiento-visual-20261122`. Este archivo explica la implementación y su verificación; no mantiene una segunda especificación.

## Implementación

`SistemaVisual.tsx` reúne cabeceras, carga, estado vacío y fotografía ampliable. `Layout.tsx` mantiene los siete destinos y sus permisos, ofrece salto al contenido, menú móvil y cuenta cerrable por Escape. `index.css` y el tema centralizan controles, tipografía, tablas, estados y movimiento reducido para todas las páginas y los subflujos de F0/F1/F5/F6/F8/F9/F10.

El catálogo permite alternar tarjetas y tabla sobre los mismos resultados, filtros y paginación. No solicita una fotografía por cada pieza: el listado no incluye ese dato. La ficha completa presenta la foto principal recibida por API con ampliación nativa y conserva los editores de archivos, sus metadatos y los permisos existentes. Los SVG institucionales no se alteran.

## Comprobaciones

- `npm run build`, `npm run lint` y `npm run test:unit`.
- `npm run test:visual`: pruebas de interfaz con datos sintéticos y respuestas interceptadas solo en Playwright. No contactan Supabase, no invocan IA y no sustituyen el QA del backend ni una prueba con datos reales.
- Navegador: trece rutas a 390, 768 y 1440px; catálogo, fotografía, Administración, reportes/impresión, foco, menú móvil, permisos de consulta, errores de acceso y errores del panel.

Para el navegador, iniciar Vite con `VITE_API_BASE_URL=http://127.0.0.1:5178/api/v1` y `VITE_DATOS_API_BASE_URL=http://127.0.0.1:5178/datos/v1`, puerto 5178. El test rechaza URLs externas como destino y sustituye esas rutas HTTP dentro de su contexto aislado. Requiere Playwright (como las demás suites E2E del proyecto); `F0_PLAYWRIGHT_MODULE` permite indicar una instalación existente. `VISUAL_BROWSER_CHANNEL` selecciona el canal, Chrome por defecto; `VISUAL_WEB` cambia el puerto. Guardar las capturas fuera del repo mediante `VISUAL_EVIDENCIA`, o en el directorio ignorado `test-results/visual`.

Las capturas contienen una ilustración y registros identificados como sintéticos. El listado, los permisos y los contratos del producto siguen dependiendo de la API real. No se incluye una API falsa en el código de la aplicación.

La compilación sigue advirtiendo del tamaño del paquete JavaScript y lint conserva una advertencia previa de Fast Refresh en AuthContext; no bloquean la compilación. La división de paquetes no forma parte de este cambio visual.
