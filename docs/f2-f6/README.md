# F2 y F6 · integración v3

Implementado el 27/10/2026. [Especificación y validación](../../../Base-de-conocimiento/flujos/F2-F6-implementacion-2026-10-27.md), [contrato F6](../../../Base-de-conocimiento/contratos-api/F6-estado-ubicacion.md), [API generada](../../../museo-backend/docs/openapi.yaml).

- `/coleccion`: búsqueda paginada, registro dinámico, colecciones/subcolecciones.
- `/coleccion/:id`: edición parcial/versionada, revisión, códigos, fotos, documentos, estado/ubicación e historiales y baja con motivo.
- `/ubicacion-y-movimientos`: catálogo de dos niveles, selector paginado, QR, traslado/estado independientes.
- `/administracion`: restauración con `piezas.restaurar`.

Contrato v3 en `lib/ficha.ts`; consultas por sesión en `lib/recursosFicha.ts`. F0 recibe `edicion`/`etiquetasActuales` opcionales; el editor calcula PATCH y conserva la instantánea para 409. No cambia AuthContext ni los tipos legados de otros flujos.

## Reproducir validación

Pruebas unitarias del cliente: `npm run test:unit` (Node 24 o compatible con eliminación de tipos TypeScript). No requieren servidor ni base. La [validación ampliada](../../../Base-de-conocimiento/flujos/F2-F6-validacion-completa-2026-10-27.md) separa estos resultados de integración y navegador.

1. Base PostgreSQL local **exclusiva para pruebas**, migrada a head, con cuenta de administrador local. Backend: `AUTH_PROVEEDOR=local`, `IA_PROVEEDOR=deshabilitado`, `ARCHIVOS_URL_BASE=https://res.cloudinary.com/museo-pruebas`. No usar Supabase.
2. Iniciar frontend con `VITE_API_BASE_URL`/`VITE_DATOS_API_BASE_URL` hacia esa API y `FRONTEND_ORIGIN` correspondiente en backend.
3. Establecer `F0_WEB`, `F0_API`, `F0_EMAIL`, `F0_PASSWORD`, `F0_EVIDENCIA`. `F0_PLAYWRIGHT_MODULE` opcional para señalar módulo Playwright externo. Se usa Chrome headless.
4. `npm run test:f2-f6`, `npm run test:f2-f6:acceso`, `npm run test:f0`, `npm run build`, `npm run lint`.
5. Backend: `TEST_DATABASE_URL` local con nombre terminado en `_test`, `python -m pytest -q`. Crea/desecha esquema temporal.

Los scripts no simulan respuestas y rechazan URLs no locales. Las pruebas de navegador **crean datos sintéticos que se conservan en esa base**, no restauran toda la base. La prueba de acceso restaura la visibilidad de estado/ubicación de Conservación a visible; usar una base nueva con permisos iniciales. Crea cuentas de consulta/conservación si no se indican `F0_CONSULTA_EMAIL` y `F0_CONSERVACION_EMAIL` (contraseña de prueba compartida).

Validación ampliada: **267 pruebas backend (132 unitarias, 135 de integración), 22 unitarias frontend y 6 escenarios de concurrencia aprobados**. Pasan los recorridos F2/F6, acceso, límites, F0, grupos, F9 e importación/conservación de 7.759 piezas. TypeScript/build y lint sin errores; capturas y JSON en `F0_EVIDENCIA`. Advertencias: Fast Refresh previo de AuthContext y chunk >500 kB. El diagnóstico global conserva fallos previos en Consultas/reportes y Asistente IA: ver el informe antes de certificar otras pantallas.

Casos adicionales: `test:f2-f6:limites`, `test:f2-f6:importados` y `test:pantallas`. Este último devuelve error mientras persistan los fallos fuera de F2/F6. La edición de fotos envía solo metadatos modificados y conserva referencias fuera del selector. Los campos de texto F0 admiten varias líneas para preservar observaciones del inventario.

## Archivos y límites

Subida de fotos desde equipo requiere `VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_UPLOAD_PRESET`. También se admite URL autorizada. Fotos JPG/PNG hasta 15 MB; documentos PDF/JPG/PNG hasta 25 MB por URL autorizada. La API almacena referencias y metadatos. No se implementa otro proveedor de documentos sin resolver F2-P4. Las pruebas registran URLs sintéticas: no verifican disponibilidad remota ni transferencia física a Cloudinary.

N10 permanece abierta; no se fusionan disponibilidad y estado. No hay migraciones, cambios a producción ni despliegue.
