import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambiosFicha, datosFicha, nombreFicha, ubicacionesPlanas } from '../src/lib/ficha.ts';
import { datosEditables } from '../src/lib/fichaF0.ts';
import { cambiosMetadatosFoto } from '../src/lib/metadatosFoto.ts';

const datos = (campos = {}, listas = {}) => ({ campos, listas });
const campo = (clave, cambios = {}) => ({ clave, activo: true, soloLectura: false, almacenamiento: 'columna', ...cambios });

test('abrir y guardar una ficha sin cambios no debe reenviar valores históricos', () => {
  const original = datos({ denominacion: 'Retablo', autor: null }, { materiales: ['inactivo', 'madera'] });
  assert.deepEqual(cambiosFicha(original, structuredClone(original)), datos());
});

test('PATCH cambia solo la observación y conserva los demás datos del servidor', () => {
  assert.deepEqual(cambiosFicha(datos({ autor: 'Persona A', observaciones: 'Anterior' }), datos({ observaciones: 'Nueva' })), datos({ observaciones: 'Nueva' }));
});

test('null borra explícitamente un valor opcional; omitir una clave lo conserva', () => {
  assert.deepEqual(cambiosFicha(datos({ autor: 'Persona A', observaciones: 'Anterior' }), datos({ observaciones: null })), datos({ observaciones: null }));
});

for (const [nombre, nuevo] of [['cero', 0], ['falso', false], ['texto vacío', '']]) {
  test(`PATCH no descarta ${nombre} por interpretarlo como ausencia`, () => {
    assert.deepEqual(cambiosFicha(datos({ valor: 'Anterior' }), datos({ valor: nuevo })), datos({ valor: nuevo }));
  });
}

test('agregar un campo dinámico no exige modificar el cliente', () => {
  assert.deepEqual(cambiosFicha(datos(), datos({ marca_taller: 'Firma A' })), datos({ marca_taller: 'Firma A' }));
});

test('listas sin cambios no se envían aunque cambie el orden de selección', () => {
  const original = datos({}, { materiales: ['yeso', 'madera'] });
  const nuevo = datos({}, { materiales: ['madera', 'yeso'] });
  const copia = structuredClone([original, nuevo]);
  assert.deepEqual(cambiosFicha(original, nuevo), datos());
  assert.deepEqual([original, nuevo], copia, 'No mutar los arrays de los formularios');
});

test('vaciar una lista se envía; omitir otra lista no la vacía', () => {
  assert.deepEqual(cambiosFicha(datos({}, { materiales: ['madera'], tecnicas: ['tallado'] }), datos({}, { materiales: [] })), datos({}, { materiales: [] }));
});

test('cambiar un valor multivalor reemplaza únicamente esa lista', () => {
  assert.deepEqual(cambiosFicha(datos({}, { materiales: ['madera'] }), datos({}, { materiales: ['yeso'] })), datos({}, { materiales: ['yeso'] }));
});

test('la conversión para editar conserva nulos, campos adicionales e ids de listas inactivas', () => {
  const ficha = { campos: { denominacion: 'Retablo', descripcion: null, medida_texto: 'Aprox. 20 cm' }, listas: { materiales: [{ id: 'antiguo', etiqueta: 'Material inactivo' }] } };
  assert.deepEqual(datosFicha(ficha), datos(ficha.campos, { materiales: ['antiguo'] }));
});

test('el formulario nunca manda claves desconocidas, campos inactivos o de solo lectura', () => {
  const catalogo = [campo('denominacion'), campo('estado_pieza_id', { soloLectura: true }), campo('ubicacion_actual_id', { soloLectura: true }), campo('archivado', { activo: false })];
  assert.deepEqual(datosEditables(catalogo, datos({ denominacion: 'Retablo', estado_pieza_id: 'estado', ubicacion_actual_id: 'sede', archivado: 'dato', desconocido: 'dato' })), datos({ denominacion: 'Retablo' }));
});

test('las listas múltiples se envían en listas y los campos adicionales en campos', () => {
  const catalogo = [campo('materiales', { almacenamiento: 'lista' }), campo('firma', { almacenamiento: 'adicional' })];
  assert.deepEqual(datosEditables(catalogo, datos({ firma: 'Autor A' }, { materiales: ['madera'], desconocida: ['x'] })), datos({ firma: 'Autor A' }, { materiales: ['madera'] }));
});

test('el filtrado de F0 y el PATCH de F2 juntos conservan los campos que no son editables', () => {
  const original = datos({ denominacion: 'Retablo', ubicacion_actual_id: 'sede', archivado: 'histórico' }, { materiales: ['inactivo'] });
  const editables = datosEditables([campo('denominacion'), campo('ubicacion_actual_id', { soloLectura: true }), campo('archivado', { activo: false }), campo('materiales', { almacenamiento: 'lista' })], { ...structuredClone(original), campos: { ...original.campos, denominacion: 'Retablo corregido' } });
  assert.deepEqual(cambiosFicha(original, editables), datos({ denominacion: 'Retablo corregido' }));
});

test('una sede sin ambientes puede seleccionarse directamente', () => {
  assert.deepEqual(ubicacionesPlanas([{ id: 'sede', nombre: 'Museo', nivelTipo: 'sede', activo: true }]).map(u => [u.id, u.etiqueta]), [['sede', 'Museo']]);
});

test('F6 presenta sedes y ambientes con rutas legibles sin modificar el catálogo', () => {
  const nodos = [{ id: 'a', nombre: 'Sede A', hijos: [{ id: 'rack', nombre: 'Depósito · Rack 3' }] }, { id: 'b', nombre: 'Sede B', hijos: [] }];
  const copia = structuredClone(nodos);
  assert.deepEqual(ubicacionesPlanas(nodos).map(u => [u.id, u.etiqueta]), [['a', 'Sede A'], ['rack', 'Sede A › Depósito · Rack 3'], ['b', 'Sede B']]);
  assert.deepEqual(nodos, copia);
});

test('un catálogo de ubicaciones vacío no produce opciones ficticias', () => {
  assert.deepEqual(ubicacionesPlanas([]), []);
});

test('la denominación legible respeta el contrato v3 y contempla fichas incompletas', () => {
  assert.equal(nombreFicha({ campos: { denominacion: 'Retablo' } }), 'Retablo');
  assert.equal(nombreFicha({ campos: { denominacion: null } }), 'Sin denominación');
  assert.equal(nombreFicha({ campos: {} }), 'Sin denominación');
});

test('editar solo la fecha de una foto no reenvía el tipo de vista inactivo ni el fotógrafo', () => {
  assert.deepEqual(cambiosMetadatosFoto({ tipoVistaId: 'inactivo', fotografoId: 'historico', fechaFotografia: null, restringidoUso: true }, { tipoVistaId: 'inactivo', fotografoId: 'historico', fechaFotografia: '2026-10-01', restringidoUso: true }), { fechaFotografia: '2026-10-01' });
});

test('se puede limpiar explícitamente el fotógrafo sin borrar los demás metadatos', () => {
  assert.deepEqual(cambiosMetadatosFoto({ fotografoId: 'historico', restringidoUso: false }, { fotografoId: null, restringidoUso: false }), { fotografoId: null });
});

test('cambiar una restricción de true a false se envía como una modificación explícita', () => {
  assert.deepEqual(cambiosMetadatosFoto({ restringidoUso: true }, { restringidoUso: false }), { restringidoUso: false });
});

test('guardar metadatos sin cambios no envía un PATCH de todos los campos', () => {
  assert.deepEqual(cambiosMetadatosFoto({ restringidoUso: false }, { tipoVistaId: null, fotografoId: null, fechaFotografia: null, restringidoUso: false }), {});
});
