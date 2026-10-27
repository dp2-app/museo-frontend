# F5 · frontend de Importación (conciliación y aprobación)

Especificación: [`Base-de-conocimiento/flujos/F5.md`](https://github.com/dp2-app/Base-de-conocimiento/blob/main/flujos/F5.md).
Contrato: `museo-backend/docs/openapi.yaml` (rutas `/datos/v1/importacion/*`).

## Avance

| Issue | Alcance | Estado |
|---|---|---|
| #22 | Importación sobre `/datos/v1` y tipos del contrato v3 | Hecho en `main` (PR #28, `datosApi`); este flujo agrega solo los tipos de F5 |
| #23 | Revisión del lote: resumen, candidatos, cambios, aprobar/rechazar/cancelar (RF-32, RF-33, RF-34, RF-36) | Cubierta por el PR #28; falta «enviar a curación» por fila |
| #24 | Bitácora de cargas con reglas aplicadas y datos de origen en la ficha (RF-37, RF-39) | Pendiente |
| #25 | Reglas de duplicado, umbral y aprobador (RF-58) | Hecho en `feat/25-reglas-importacion`: panel plegable en Importación (`components/f5/ReglasImportacion.tsx`) |
| #26 | Cola de curación (RF-40, deseable) | Pendiente |

## Tipos de F5 (`src/types/index.ts`)

`CargaExcel.reglasAplicadas`, `ReglasImportacion` / `ReglaDuplicado` y `CuracionImportacion`, según `openapi.yaml`.

## Reglas de importación (#25)

Panel plegable en `/importacion` sobre `GET/PUT /datos/v1/importacion/reglas`:

- Activa o apaga las tres reglas configurables; la del mismo código (RF-32) se muestra fija.
- Umbral de similitud entre 0,30 y 1,00 (el servidor valida de nuevo).
- Permiso aprobador (P33): la lista sale de `GET /permisos`, que exige `roles.ver`; sin ese permiso se muestra el vigente, sin cambiarlo.
- Cambiar reglas exige `importacion.configurar`; ver, `importacion.ver`. «Requiere aprobación» no se puede apagar (RN-08).
- Quien tenga el permiso aprobador puede aprobar también una carga que subió (F5-P1 sigue abierta con el museo).

Evidencia: `docs/f5/evidencias/reglas-importacion.png`. En el navegador, contra el backend local: valores iniciales
(0,60, `importacion.aprobar`), rechazo local de 0,10, guardado de 0,75 con una regla apagada, y persistencia tras recargar,
sin respuestas 4xx ni errores de página.

## Verificación

- `npm run build` y `npm run lint` (solo las dos advertencias previas).
- Contra el backend local con la migración `0107` (sin Supabase): el recorrido de importación del PR #28 sigue funcionando
  tras integrar `main` con este flujo.
