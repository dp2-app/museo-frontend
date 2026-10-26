# F5 · frontend de Importación (conciliación y aprobación)

Especificación: [`Base-de-conocimiento/flujos/F5.md`](https://github.com/dp2-app/Base-de-conocimiento/blob/main/flujos/F5.md).
Contrato: `museo-backend/docs/openapi.yaml` (rutas `/datos/v1/importacion/*`).

## Avance

| Issue | Alcance | Estado |
|---|---|---|
| #22 | Cliente `apiDatos` (`/datos/v1`), tipos del contrato v3, rutas y parámetros de Importación | Hecho |
| #23 | Revisión del lote: resumen, candidatos con su regla, acciones por fila (RF-32, RF-33, RF-34, RF-36) | Pendiente |
| #24 | Bitácora de cargas y datos de origen en la ficha (RF-37, RF-39) | Pendiente |
| #25 | Reglas de duplicado, umbral y aprobador (RF-58) | Pendiente |
| #26 | Cola de curación (RF-40, deseable) | Pendiente |

## #22 · qué cambió

- `src/lib/api.ts`: `apiDatos` apunta a `/datos/v1`. Por defecto se deriva de `VITE_API_BASE_URL` (cambia `/api/v1` por
  `/datos/v1`); `VITE_DATOS_BASE_URL` lo sobrescribe. Mismo token y misma salida a `/login` ante un 401.
- `src/types/index.ts`: `CargaExcel`, `FilaImportacion`, `CandidatoFila`, `CambioCampo`, `ReglasImportacion` y
  `CuracionImportacion` según `openapi.yaml`.
- `ImportacionPage` y `CargaDetailPage` llaman a `/datos/v1/importacion/*`. Ajustes de contrato: el campo de la plantilla
  es `plantillaMapeoId`, la página de filas usa `tamano` (antes `pageSize`), rechazar una carga exige `motivo`
  y las advertencias vienen en `datosNormalizados.advertencias`.
- Los errores usan el formato `{"errores": [...]}` que `extraerMensajeError` ya interpreta.

## Verificación

- `npm run build` y `npm run lint` (solo las dos advertencias previas).
- En el navegador (Playwright) contra el backend local con la migración `0107`: subir un Excel de tres filas, ver el resumen
  (2 nuevas, 1 posible duplicado) y rechazar la carga con motivo; ninguna respuesta con estado 4xx/5xx.
  Capturas en `docs/f5/evidencias/`.
- Nunca se probó contra Supabase.
