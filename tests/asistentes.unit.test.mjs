import test from 'node:test';
import assert from 'node:assert/strict';
import { validarUbicacion, normalizarUbicacion } from '../src/lib/ubicaciones.ts';
import { registrarPiezaConFotos, validarUrlFoto } from '../src/lib/altaPieza.ts';

const sede = { nivelTipo: 'sede', parentId: null, nombre: 'Sede histórica', codigo: 'SEDE-01', direccion: 'Jr. de la Unión 123, Lima' };
test('una sede raíz completa no exige un padre', () => assert.deepEqual(validarUbicacion(sede), {}));
test('una ubicación interior exige sede y todos sus datos', () => {
  assert.deepEqual(Object.keys(validarUbicacion({ nivelTipo: 'ubicacion', parentId: null, nombre: ' ', codigo: '\t', direccion: '' })).sort(), ['codigo', 'direccion', 'nombre', 'parentId']);
});
test('normaliza espacios sin inventar código ni dirección', () => {
  assert.deepEqual(normalizarUbicacion({ ...sede, parentId: 'se-descarta', nombre: '  Sede histórica  ', codigo: ' SEDE-01 ', direccion: ' Jr. de la Unión 123, Lima ' }), sede);
});
test('las fotografías rechazan direcciones inseguras o archivos que no son imágenes', () => {
  for (const value of ['http://example.test/a.jpg', 'javascript:alert(1)', 'https://example.test/a.pdf', 'no-es-url']) assert.ok(validarUrlFoto(value));
  assert.equal(validarUrlFoto(' https://example.test/foto.JPG?version=2 '), null);
});

function escenario() {
  const llamadas = [];
  const progreso = { fotos: {} };
  const fotos = [{ clave: 'a', url: 'https://example.test/a.jpg', vista: '', formato: 'jpg' }, { clave: 'b', url: 'https://example.test/b.jpg', vista: '', formato: 'jpg' }];
  const operaciones = {
    crear: async () => { llamadas.push('pieza'); return { id: 'pieza-1' }; },
    subir: async () => { llamadas.push('subir'); return 'https://example.test/subida.jpg'; },
    agregarFoto: async (id, foto) => { llamadas.push(foto.url); return { id: foto.url.endsWith('a.jpg') ? 'foto-a' : 'foto-b' }; },
    elegirPrincipal: async (id, fotoId) => { llamadas.push(`principal:${fotoId}`); },
  };
  return { llamadas, progreso, fotos, operaciones };
}
test('crear sin fotografías usa un único registro y no llama al almacenamiento', async () => {
  const s = escenario(); assert.equal(await registrarPiezaConFotos(s.progreso, [], '', s.operaciones), 'pieza-1');
  assert.deepEqual(s.llamadas, ['pieza']);
});
test('guarda cada fotografía y respeta la principal elegida', async () => {
  const s = escenario(); await registrarPiezaConFotos(s.progreso, s.fotos, 'b', s.operaciones);
  assert.deepEqual(s.llamadas, ['pieza', s.fotos[0].url, s.fotos[1].url, 'principal:foto-b']);
});
test('si falla una fotografía, reintenta sin duplicar la pieza ni las fotos confirmadas', async () => {
  const s = escenario(); const original = s.operaciones.agregarFoto; let fallo = true;
  s.operaciones.agregarFoto = async (id, foto) => {
    if (foto.url.endsWith('b.jpg') && fallo) { fallo = false; throw new Error('Fallo temporal'); }
    return original(id, foto);
  };
  await assert.rejects(registrarPiezaConFotos(s.progreso, s.fotos, 'a', s.operaciones), /Fallo temporal/);
  assert.equal(s.progreso.piezaId, 'pieza-1'); assert.equal(s.progreso.fotos.a.id, 'foto-a');
  await registrarPiezaConFotos(s.progreso, s.fotos, 'a', s.operaciones);
  assert.equal(s.llamadas.filter((x) => x === 'pieza').length, 1);
  assert.equal(s.llamadas.filter((x) => x === s.fotos[0].url).length, 1);
});
test('si falla el enlace de una foto subida, el reintento conserva la URL y no vuelve a subirla', async () => {
  const s = escenario(); s.fotos = [{ clave: 'a', archivo: { size: 100 }, formato: 'jpg', vista: '' }];
  let fallo = true; const original = s.operaciones.agregarFoto;
  s.operaciones.agregarFoto = async (id, foto) => { if (fallo) { fallo = false; throw new Error('No se pudo enlazar'); } return original(id, foto); };
  await assert.rejects(registrarPiezaConFotos(s.progreso, s.fotos, 'a', s.operaciones));
  await registrarPiezaConFotos(s.progreso, s.fotos, 'a', s.operaciones);
  assert.equal(s.llamadas.filter((x) => x === 'subir').length, 1);
});
test('si falla la elección de principal, reintenta solo esa operación', async () => {
  const s = escenario(); let fallo = true; const original = s.operaciones.elegirPrincipal;
  s.operaciones.elegirPrincipal = async (...args) => { if (fallo) { fallo = false; throw new Error('Principal pendiente'); } return original(...args); };
  await assert.rejects(registrarPiezaConFotos(s.progreso, s.fotos, 'b', s.operaciones));
  const antes = s.llamadas.length; await registrarPiezaConFotos(s.progreso, s.fotos, 'b', s.operaciones);
  assert.deepEqual(s.llamadas.slice(antes), ['principal:foto-b']);
});
test('una pieza que no se pudo crear no inicia las fotografías', async () => {
  const s = escenario(); s.operaciones.crear = async () => { throw new Error('Datos inválidos'); };
  await assert.rejects(registrarPiezaConFotos(s.progreso, s.fotos, 'a', s.operaciones));
  assert.equal(s.progreso.piezaId, undefined); assert.deepEqual(s.llamadas, []);
});
