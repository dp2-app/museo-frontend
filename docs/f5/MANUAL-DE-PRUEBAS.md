# Manual de pruebas de F5 (conciliación y aprobación de cargas)

Todo se prueba en local, contra PostgreSQL propio. **Nunca contra Supabase.**

## 1. Preparación

Necesita PostgreSQL 17 (o 16), Node 20 o superior y Python 3.12.

1. Crear una base vacía, por ejemplo `museo_dev`.
2. Backend (`museo-backend`, rama con el cierre de F5 y la migración `0109_union_0107_0108`):
   - `.env` con `DATABASE_URL` (base local), `DB_SCHEMA=museo`, `JWT_SECRET_KEY` (cualquier texto) y `FRONTEND_ORIGIN=http://localhost:5173`.
   - `alembic upgrade head`, luego `python -m app.herramientas.crear_admin correo@ejemplo.pe "Nombre"`.
   - `uvicorn app.main:app --port 8000`.
3. Frontend: `npm install`, `npm run dev` y abrir `http://localhost:5173` (use `localhost`, no `127.0.0.1`, por CORS).
4. En PowerShell use `npm.cmd` en lugar de `npm` si la política de scripts lo bloquea.

## 2. Prueba automática (10 controles)

La prueba exige una base **vacía** y corre una sola vez por base.

```
npx playwright install chromium     # una sola vez
$env:F5_EMAIL="correo-del-admin"; $env:F5_PASSWORD="su-contraseña"
npm run test:f5
```

Debe imprimir 10 líneas `OK` y terminar sin errores 4xx/5xx. Las capturas quedan en `F5_EVIDENCIA` (por defecto `evidencia-f5/`). Para repetirla hay que recrear la base.

## 3. Prueba manual en el navegador

Entrar como administrador. Los archivos de ejemplo están en `tests/fixtures/f5/` (`lote1.xlsx`, `lote2.xlsx`).

**A. Reglas de duplicado (RF-58, issue #25).** En Importación abrir «Reglas de duplicado y aprobación».
Debe verse la regla de código exacto fija, similitud mínima 0,60 y el aprobador. Poner 0,10 y guardar: se rechaza con un mensaje. Poner 0,75, apagar una regla y guardar: recargar la página y comprobar que se conservan.

**B. Enviar una fila a curación (RF-40, issue #31).** Cargar `lote1.xlsx` y entrar a la carga. En una fila pulsar «Enviar a curación»: aparece «Irá a la cola de curación al aprobar la carga» y el botón pasa a «Quitar de curación». Quitar y volver a enviar.

**C. Aprobar y ver la cola (RF-36, RF-40, issue #32).** Marcar las filas como revisadas y «Aprobar carga completa». En Importación, «Ver la cola de curación»: deben aparecer la fila marcada («Quien revisó el lote la marcó para curación») y la fila sin título («Título / Denominación es obligatorio»). El filtro de estado y los enlaces a la pieza y a la carga funcionan.

**D. Validar un pendiente (RF-40, issue #33).** En la cola pulsar «Validar», escribir una nota y confirmar. Baja de «Pendientes» y aparece en «Validados» con fecha y nota. Con un rol sin `importacion.curar` el botón no aparece.

**E. Reglas con que se concilió (RF-39, issue #34).** Abrir cualquier carga: la línea «Reglas con que se concilió esta carga» lista las reglas y la similitud mínima de ese momento. Cambiar el umbral en Importación y cargar `lote2.xlsx`: la carga nueva muestra el umbral nuevo y la anterior conserva el suyo. Cancelar una carga pide motivo y queda en la bitácora.

## 4. Backend

`TEST_DATABASE_URL=postgresql+psycopg://…/museo_test pytest -q` (PostgreSQL exclusivo de pruebas, con la extensión `vector` instalada): 249 passed.
`python scripts/exportar_openapi.py --verificar` y `python scripts/exportar_matriz_permisos.py --verificar` deben decir que están al día.

## 5. Limpieza

`DROP DATABASE museo_dev;` si ya no la necesita. Las reglas quedan en sus valores por defecto al terminar la prueba automática.
