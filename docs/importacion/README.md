# Validación de importación desde la interfaz

La pantalla usa `/datos/v1/importacion`, selecciona explícitamente la hoja y envía `plantillaMapeoId`. `VITE_DATOS_API_BASE_URL` permite configurar ese contrato si tiene otra URL. Sin esa variable se deriva del prefijo `/api/v1` de `VITE_API_BASE_URL`. Ambos clientes comparten la autenticación y el tratamiento de errores.

La preparación y el flujo de usuario se describen en [la guía del backend](../../../museo-backend/docs/importacion-inventario.md). El formato administrativo y sus catálogos deben existir antes de usar el Excel preparado. La base compartida no se modifica con esta entrega.

## Prueba de navegador real

`npm run test:importacion` ejecuta `tests/importacion.e2e.cjs` con Playwright y Chrome. Requiere backend y frontend locales, esquema migrado, un administrador de prueba y la configuración del formato cargada en una **base desechable que empieza sin piezas**. No usa respuestas simuladas ni SQL para marcar filas revisadas.

Variables:

| Variable | Uso |
|---|---|
| `IMPORTACION_WEB` | URL del frontend local. |
| `IMPORTACION_API` | Base de negocio local, terminada en `/api/v1`. |
| `IMPORTACION_DATOS` | Opcional; base de datos/integración, terminada en `/datos/v1`. |
| `IMPORTACION_ACCOUNT_FILE` | JSON local con `email` y `password` del administrador ficticio. No versionar credenciales. |
| `IMPORTACION_EXCEL_FILE` | Excel preparado, con Inventario (4.380 filas) y AJB (3.379). |
| `IMPORTACION_ERROR_FILE` | Fixture de dos hojas, AJB con una fila y un material inexistente; Inventario con datos distintos para detectar una hoja incorrecta. |
| `IMPORTACION_CORRECTED_FILE` | La misma fixture con AJB corregida. |
| `IMPORTACION_FORMATO` | Opcional; por defecto «Inventario MATP (formato habitual)». |
| `IMPORTACION_PLAYWRIGHT_MODULE` | Opcional; ruta absoluta a Playwright si se usa un runtime externo. |
| `IMPORTACION_EVIDENCIA` | Carpeta de capturas, reporte de errores y `validacion.json`. |

La prueba verifica login, archivo no admitido, destinos vigentes, error real de catálogo, reporte descargable, corrección manual, rechazo con motivo, recarga de AJB con su formato, cancelación sin aplicar piezas, paginación y filtros. Después importa las dos hojas completas, confirma expresamente los posibles duplicados, revisa todas sus filas por API y aprueba desde la interfaz. Comprueba que no se creen piezas al revisar y que la aprobación registre las 7.759 piezas. Incluye capturas de escritorio y móvil y comprueba que no haya excepciones de React.

Los permisos negativos y la atomicidad se validan adicionalmente en las pruebas del backend. Las fichas importadas quedan en borrador para su revisión habitual; importar no equivale a aprobar su publicación o completar campos que el origen no tenía.

## Resultado del 25 de octubre de 2026

La ejecución completa desde Chrome terminó sin errores de React y aprobó las dos hojas: **7.759 piezas y 13.835 códigos**, sin filas con errores ni advertencias en el Excel preparado. Las 11.698 relaciones con listas, 7.759 tenencias, 7.759 movimientos y 7.759 procedencias quedaron registradas. La comparación de esos seis conjuntos con la importación previamente validada no encontró diferencias en los datos de inventario; se excluyeron identidades generadas y fechas de operación.

Evidencia: [navegador](./validacion-interfaz.json) y [comparación de la base local](./validacion-base.json). El archivo probado tiene SHA-256 `3f960bdfc365b199ef2aea13afaf0f5f37e39a63ffdde301fe84e8ac648cc15b`.

Pasaron las **185 pruebas** del backend, la compilación de producción del frontend y la verificación del contrato OpenAPI y de la matriz de permisos. Lint termina sin errores; conserva dos advertencias previas en `AuthContext.tsx` y `UbicacionMovimientosPage.tsx`. Vite también avisa del tamaño del bundle.

La validación se realizó exclusivamente en PostgreSQL local, con el esquema vigente 0106 y la configuración administrativa del formato. **No se aplicaron datos, migraciones ni configuración en Supabase.** Los demás módulos del frontend que la base de conocimiento identifica como pendientes de adaptación mantienen ese trabajo separado.
