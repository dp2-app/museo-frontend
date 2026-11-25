# Registro, ubicaciones e importación por etapas

Implementación local del 24/11/2026. Se conserva la identidad del museo y el contrato de ficha configurable de F0.

## Recorridos

- **Carga masiva:** se abre sobre Colección. Archivo → columnas → revisión → confirmación. La lectura y la validación muestran su estado real; no hay porcentajes temporizados. Después de validar, el lote se conserva en el servidor y puede retomarse. Revisar filas no aplica cambios: sigue siendo necesaria la aprobación explícita de F5. Los enlaces anteriores a `/importacion/:cargaId` abren el mismo diálogo.
- **Registro individual:** ficha → identificación y ubicación → fotografías → confirmación. Los obligatorios provienen de F0; se reutilizan sus controles y los complementos de F1. Volver entre pasos conserva la información. La pieza se crea como borrador después de confirmar. Se pueden añadir enlaces HTTPS de fotografías, elegir la principal y registrar sin imágenes con un aviso claro. El selector de archivos y la cámara se habilitan cuando está configurado el almacenamiento existente de Cloudinary.
- **Ubicaciones:** el botón superior de Ubicación y movimientos y las acciones del catálogo abren el mismo popup. Nombre, código y dirección son obligatorios y se recortan espacios exteriores. Una ubicación interior exige una sede activa; al elegirla se propone su dirección, editable. Las sedes raíz no tienen padre. Editar mantiene el nivel y la sede, como antes.

La API también rechaza omitir datos en altas y vaciar explícitamente nombre, código o dirección en ediciones. Un PATCH parcial de estado conserva los datos restantes. Los registros históricos pueden consultarse aunque tengan información pendiente: no se inventaron valores ni se cambió su estructura en PostgreSQL.

## Recuperación y accesibilidad

El registro conserva el ID de la pieza, los IDs de las fotos y las URL de archivos que el servidor confirmó. Si falla una foto o la elección de principal, se reintentan los pendientes. Se puede revisar la selección sin volver a crear la pieza. No se agregó idempotencia a los endpoints existentes: la pérdida de una respuesta antes de conocer su ID requiere comprobar el catálogo antes de repetir.

Los diálogos nativos mantienen el fondo inerte, limitan el foco, aceptan Escape y devuelven el foco a la acción de origen. Durante una escritura se bloquea el cierre. Los errores de obligatorios llevan al primer control inválido. Los identificadores de controles de importación no se duplican con formularios del fondo. Las barras superior e inferior permanecen visibles y el contenido se desplaza dentro del popup. Se corrigió el margen que el espaciado de la página aplicaba al diálogo móvil.

## Heurísticas de Nielsen

| Heurística | Aplicación concreta |
| --- | --- |
| Visibilidad del estado | Paso actual, estados de lectura, validación y guardado; resultados y pendientes reales. |
| Correspondencia con el mundo real | Sede, ubicación, ficha, código I, fotografía principal y borrador. |
| Control y libertad | Atrás, Escape, cierre explícito, revisión de fotografías pendientes y continuación de lotes guardados. |
| Consistencia | Mismo sistema visual y patrón de cuatro etapas que la carga masiva. |
| Prevención de errores | Obligatorios en UI y API, rechazo de blancos, sede requerida, códigos a medias bloqueados y aprobación explícita. |
| Reconocimiento | Valores conservados al volver, datos precargados al editar, fotos visibles y resumen antes de registrar. |
| Eficiencia | Dirección propuesta desde la sede, formatos de columnas reutilizables y revisión conjunta de filas. |
| Diseño minimalista | Operaciones centradas en popups; reglas y detalles secundarios desplegables. |
| Recuperación de errores | Mensajes junto al campo, código duplicado sin perder el formulario y reintentos sobre resultados confirmados. |
| Ayuda | Indicaciones de formato, asteriscos, explicación de imágenes opcionales y del registro como borrador. |

Referencia: [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/).

## Verificación

- Backend completo en PostgreSQL local exclusivo `museo_ux_test`: **634 pruebas aprobadas**, 197 unitarias y 437 de integración. Las pruebas crean su esquema temporal; no usan la base de demostración ni Supabase.
- Frontend: **35 unitarias aprobadas**. Cubren campos obligatorios y fallos al crear, subir, enlazar fotografías o elegir principal, con reintentos sin repetir resultados confirmados.
- Compilación de producción y lint; permanece la advertencia preexistente de Fast Refresh de `AuthContext` y el aviso del tamaño del bundle.
- E2E con navegador y API reales: alta de sede y ubicación completas, rechazo de vacíos, edición, alta de pieza con colección, material, medida, código I y ubicación inicial, dos fotos y selección de la segunda como principal; código duplicado, datos conservados y alta sin foto tras corregirlo. También se verifica que no hay cambios antes de confirmar y que Escape devuelve el foco.
- Comprobación posterior mediante HTTP: una sola pieza por cada alta, dos fotos con una principal, medida y código conservados, un movimiento inicial y edición de ubicación persistida. Evidencia de esta sesión en `tmp/museo-local/asistentes-evidencia/` de la raíz consolidada.

Las fotos utilizadas en QA son referencias públicas de The Met sobre datos marcados como ficticios. La subida externa de archivos a Cloudinary no se certifica sin su configuración. La IA real sigue pendiente de la clave de Groq en el entorno local; no se habilitaron respuestas simuladas. Las verificaciones anteriores corresponden al entorno local; la publicación se comprueba mediante los estados de despliegue y la respuesta de los servicios.
