# F2 · Evidencia del frontend (registro manual y vida de la pieza)

Dueño: Divano Pérez Nina. Especificación: `Base-de-conocimiento/flujos/F2.md`. Contrato: `museo-backend/docs/openapi.yaml`.

## Cómo se verificó

| Nivel | Qué | Resultado (24/10/2026) |
|---|---|---|
| Componentes (Vitest + Testing Library) | Pantallas de F2 con la API simulada, una prueba por criterio | 46 pruebas, todas pasan; 89 % de líneas del código de F2 |
| Punta a punta (Playwright) | El navegador contra `museo-backend@main` y PostgreSQL 17 locales | 3 pruebas, todas pasan (`tests/e2e/f2-ficha.spec.ts`) |
| Manual en el navegador | Admin y Catalogador/practicante; escritorio y 375 px de ancho | Sin desborde horizontal; cada rol ve solo sus acciones |

Para regenerar las capturas (necesita el backend corriendo y una cuenta de prueba):

```bash
E2E_EVIDENCIA=1 E2E_API=http://localhost:8000/api/v1 E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
```

## Requisitos de la matriz

| Requisito | Criterio de aceptación | Evidencia |
|---|---|---|
| **RF-01** Registrar y editar la ficha | El formulario muestra los campos del catálogo vigente por grupos, con tipo, obligatoriedad y vocabulario; guarda solo si cumple RF-12 | `NuevaPiezaPage.test.tsx` (obligatorios, un solo POST, error del backend junto al campo) · `PiezaDetailPage.test.tsx` (edición, solo cambios, conflicto 409) · [01](evidencia/01-alta-con-codigo-y-ubicacion.png), [02](evidencia/02-ficha-recien-creada.png) |
| **RF-02** Identificador interno | Toda pieza tiene UUID aunque no tenga códigos | Alta sin códigos en la prueba E2E de ficha incompleta ([08](evidencia/08-revision-bloqueada-por-faltantes.png)) |
| **RF-07** Colecciones y subcolecciones | Un usuario autorizado mantiene colecciones y subcolecciones | `PiezasPage.test.tsx` (Subcolecciones) |
| **RF-08** Pieza con o sin colección | Con colección y código, con colección sin código, o sin colección | Alta con y sin colección (E2E y prueba de componentes) |
| **RF-10** Múltiples fotografías | N fotos; reordenar y elegir la principal | `PiezaDetailPage.test.tsx` (principal, flechas, arrastre, fotógrafo y fecha, uso restringido) · [03](evidencia/03-ficha-aprobada-con-foto.png) |
| **RF-11** Documentos | Uno o más documentos con tipo, fecha y descripción; descargables | `FichaSecciones.test.tsx` (Documentos) · [05](evidencia/05-documento-y-correccion-del-codigo-i.png) |
| **RF-13** Baja lógica y restauración | Sale de las búsquedas, conserva sus datos y se restaura, siempre con motivo | `PiezaDetailPage.test.tsx` (baja) · `PiezasPage.test.tsx` (restauración) |
| **RF-14** Responsable del registro | La ficha muestra quién y cuándo creó y modificó | Sección «Registro» de la ficha ([05](evidencia/05-documento-y-correccion-del-codigo-i.png)) |
| **RNF-11** Auditoría | Cada cambio con valor anterior, nuevo, autor, fecha y motivo | `FichaSecciones.test.tsx` (historial legible) · [05](evidencia/05-documento-y-correccion-del-codigo-i.png) |
| **RNF-09** Mismo mensaje en API e interfaz | La pantalla muestra el texto del backend | Errores de código duplicado, comodato con código I y revisión incompleta ([06](evidencia/06-comodato-rechazado-por-codigo-i.png), [08](evidencia/08-revision-bloqueada-por-faltantes.png)) |
| **RNF-12** Fotos y documentos | La base guarda solo referencias; formato y tamaño se validan antes de subir | `f2.test.ts` (validarArchivo) |

## Recorridos de la especificación

| Recorrido | Evidencia |
|---|---|
| R1 · Crear una ficha | E2E 1 y 2 · [01](evidencia/01-alta-con-codigo-y-ubicacion.png), [02](evidencia/02-ficha-recien-creada.png) |
| R2 · Editar (también una ficha incompleta) | E2E 3 · `f2.test.ts` (soloCambios) · prueba «al editar envía solo lo que cambió» |
| R3 · Aprobar, rechazar y bandeja del gestor | E2E 1 · `PiezasPage.test.tsx` (Bandeja de revisión) · [03](evidencia/03-ficha-aprobada-con-foto.png) |
| R4 · Fotografías | E2E 1 · pruebas de fotos en `PiezaDetailPage.test.tsx` |
| R5 · Documentos | E2E 2 · `FichaSecciones.test.tsx` |
| R6 · Baja y restauración | `PiezaDetailPage.test.tsx` · `PiezasPage.test.tsx` |

Además, en la ficha: códigos del museo con corrección excepcional del código I (RF-05), tenencia con los datos del comodato (RN-03, RN-07; [06](evidencia/06-comodato-rechazado-por-codigo-i.png), [07](evidencia/07-alta-en-comodato-restringido.png)) y sugerencias de IA con revisión humana (F10, DA-006).

## Fuera del alcance de F2

Cambio de ubicación y de estado (F6, se enlaza a «Ubicación y movimientos»), reglas de códigos y tenencia (F1, las aplica el backend), búsqueda avanzada y reportes (F7/F8).
