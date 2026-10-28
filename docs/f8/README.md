# F8 · Consultas y reportes (frontend)

Pantalla `/consultas-y-reportes` (`src/pages/ConsultasReportesPage.tsx`) sobre el contrato v3. Requiere museo-backend#59.

- **Filtros comunes** (`components/f8/FiltrosReporte.tsx`): los mismos de `GET /piezas` (F7): texto, código, colección,
  ubicación, estado de la pieza, estado de conservación, material, autor, época, estado de ficha (solo con
  `piezas.ver_no_aprobadas`) y «solo incompletas». Un filtro sobre un campo oculto para el rol no se muestra.
- **Pestañas**: Búsqueda (paginada), Inventario (RF-45), Por estado y Por ubicación (RF-46; la de ubicación no aparece si el
  rol no ve la ubicación) e Información incompleta con % por colección (RF-47).
- Cada reporte muestra lo que devuelve el backend: institución, título, fecha, filtros aplicados y total. El frontend no
  recalcula totales, porcentajes ni faltantes.
- **Exportar Excel** (con `reportes.exportar`): `GET /datos/v1/exportaciones/piezas.xlsx` en la búsqueda y
  `GET /datos/v1/exportaciones/reportes/{reporte}.xlsx` en cada reporte (RF-48). **Exportar catálogo completo** solo con
  `reportes.exportar_total` (RF-49, no aplica filtros).
- **PDF**: P36 sigue abierta. Por ahora, «Imprimir o guardar como PDF» usa la impresión del navegador; el encabezado, el
  pie y los controles no se imprimen.
- Se retiró la combinación «O (OR)» del cliente: hacía varias consultas con parámetros legados que ya no existen. El backend
  combina los filtros con Y (RF-43).

## Verificación (28/10/2026)

`npm run build` y `npm run lint` (solo la advertencia previa de `AuthContext`). En el navegador (Playwright) contra el
backend y PostgreSQL locales con 6 piezas de prueba: filtro por colección, los cuatro reportes, descarga del Excel,
vista de impresión y móvil (390 px), sin errores de consola. Nunca contra Supabase.

| Captura | Qué muestra |
|---|---|
| `f8-incompletos-filtro.png` | Información incompleta filtrada por la colección «Retablos» |
| `f8-por-estado.png` | Subtotales por estado de la pieza y de conservación |
| `f8-impresion.png` | Vista de impresión (guardar como PDF) |
| `f8-movil.png` | Inventario en móvil |
