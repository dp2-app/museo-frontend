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

## Pruebas

`npm run test:f7` (Playwright, backend real local con una base de pruebas, nunca Supabase): `F7_EMAIL` y `F7_PASSWORD` de un administrador.
Crea tres piezas con una marca única y comprueba el texto sin tildes, por palabras, con comodines literales y combinado con un filtro por atributo.
