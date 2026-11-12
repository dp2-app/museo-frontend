# F7 · Búsqueda y ficha completa (frontend)

Especificación y decisiones: `Base-de-conocimiento/flujos/F7.md` (F7-D1 a D6). Contrato: `museo-backend/docs/openapi.yaml` (`GET /piezas`).

## Colección: filtros por atributo (RF-42, RF-43)

La pantalla **Colección** usa el mismo componente de filtros que Consultas y reportes (`src/components/f8/FiltrosReporte.tsx`), así que la búsqueda
y los reportes nunca difieren en qué filtros ofrecen:

- Texto de la ficha (sin mayúsculas ni tildes, cada palabra en cualquier campo y orden; un código también se encuentra aquí), código del museo, colección,
  ubicación, estado de la pieza, estado de conservación, material, **tipo de bien**, **clasificación**, autor, **procedencia**, época y «solo incompletas».
- «Estado de ficha» solo se ofrece con `piezas.ver_no_aprobadas`; sin ese permiso el backend devuelve solo fichas aprobadas.
- Un filtro sobre un campo oculto para el rol no se muestra (el backend además lo rechaza con 403 `campo_no_visible`).
- Las opciones salen de las listas de F0 (`/listas/{clave}/valores`), con los valores inactivos, que pueden estar en piezas antiguas.

El botón es «Aplicar filtros» (antes «Buscar»); «Limpiar» borra todos los filtros. Los filtros nuevos (tipo de bien, clasificación, procedencia) también
aparecen en Consultas y reportes; los reportes los aplican cuando el backend acepta los filtros de la búsqueda en `/reportes/*` (museo-backend#59).

## Ficha, columna de completitud y errores 4xx (QA del Sprint 4)

- **Ficha con una sola llamada (#100, RF-44).** `PiezaDetailPage` lee `GET /piezas/{id}/ficha-completa` y pasa a sus componentes lo que ya trae (códigos, tenencias, fotografías, documentos, movimientos y estados) como datos iniciales: ya no pide `/piezas/{id}`, `/fotografias`, `/documentos`, `/codigos`, `/movimientos`, `/estados` ni `/tenencias` al abrir. Tras una operación se invalida la caché y cada parte se vuelve a pedir a su propio endpoint. Siguen siendo llamadas aparte los catálogos de los formularios y `/auditoria` (la ficha completa no la incluye). La visibilidad por rol la aplica el backend en ese único punto.
- **Columna «Completitud» (#102).** El listado de Colección muestra «Estado de la ficha» y «Completitud»: «Completa» o «Faltan N campos», con el detalle en el tooltip. `camposFaltantes` ya viene filtrado por el rol; `codigos_externos` y `fotografias` se muestran como «código del museo» y «fotografía».
- **Sin reintentos en 4xx (#107).** `QueryClient` no repite una consulta que respondió 4xx (`reintentarConsulta` en `lib/api.ts`): el 403 `ficha_no_aprobada` se muestra de inmediato, antes tardaba ~8 s por tres reintentos. La red y los 5xx se reintentan hasta 2 veces.

## Pruebas

`npm run test:f7` (Playwright, backend real local con una base de pruebas, nunca Supabase): `F7_EMAIL` y `F7_PASSWORD` de un administrador.
Crea tres piezas con una marca única y comprueba el texto sin tildes, por palabras, con comodines literales y combinado con un filtro por atributo.
`F7_CI_EMAIL` y `F7_CI_PASSWORD` (Consulta interna, opcionales) activan la comprobación de que un 403 se muestra de inmediato y no se reintenta. También verifica la columna «Completitud» y que la ficha usa una sola llamada a `/ficha-completa`.
