import type { CampoFicha, FichaCompleta } from "../types";

/** Datos de prueba con la forma exacta del contrato v3 (museo-backend/docs/openapi.yaml). */
const campo = (clave: string, etiqueta: string, extra: Partial<CampoFicha> = {}): CampoFicha => ({
  id: clave, clave, etiqueta, tipo: "texto", lista: null, multivalor: false, obligatorio: false, orden: 10,
  grupo: "Identificación", ayuda: null, activo: true, esBase: true, almacenamiento: "columna", soloLectura: false, ...extra,
});

export const CAMPOS: CampoFicha[] = [
  campo("denominacion", "Título / Denominación", { obligatorio: true, orden: 1 }),
  campo("autor", "Autor / Atribuido / Firmado", { orden: 2, grupo: "Descripción" }),
  campo("procedencia", "Procedencia", { orden: 3, grupo: "Descripción" }),
  campo("estado_conservacion_id", "Estado de conservación", {
    orden: 4, grupo: "Conservación", tipo: "lista", lista: { id: "l1", clave: "estado_conservacion", nombre: "Estado de conservación" } }),
];

export const TIPOS_CODIGO = [
  { id: "tc-i", clave: "I", nombre: "N° de inventario MATP (I)", descripcion: null, patron: null, esUnico: true, inmutable: true, esPrincipal: true, permiteMultiples: false, orden: 1, activo: true },
  { id: "tc-col", clave: "coleccion", nombre: "Código de la colección", descripcion: null, patron: null, esUnico: false, inmutable: false, esPrincipal: false, permiteMultiples: true, orden: 2, activo: true },
];

export const REGIMENES = [
  { id: "r-prop", clave: "propiedad", nombre: "Propiedad", descripcion: null, ingresaInventarioPermanente: true, requiereContraparte: false, requiereFechas: false, orden: 1, activo: true },
  { id: "r-com", clave: "comodato", nombre: "Comodato", descripcion: null, ingresaInventarioPermanente: false, requiereContraparte: true, requiereFechas: false, orden: 2, activo: true },
];

export const PROPIETARIOS = [{ id: "pr-1", tipoPersona: "natural", nombre: "Alicia Jiménez Borja", esPorDefecto: false, activo: true }];
export const UBICACIONES = [{ id: "sede", parentId: null, nivelTipo: "sede", nombre: "Sede central", hijos: [
  { id: "rack", parentId: "sede", nivelTipo: "ubicacion", nombre: "Depósito 2 · Rack 3", hijos: [] }] }];
export const ESTADOS_CONSERVACION = [{ id: "ec-bueno", etiqueta: "Bueno", codigo: null, orden: 1, activo: true, esSistema: true }];
export const VISTAS = [{ id: "v-frontal", etiqueta: "Frontal", codigo: null, orden: 1, activo: true, esSistema: true }];

export const CATALOGOS = {
  "/campos-ficha": CAMPOS,
  "/tipos-codigo": TIPOS_CODIGO,
  "/regimenes": REGIMENES,
  "/propietarios": PROPIETARIOS,
  "/ubicaciones": UBICACIONES,
  "/listas/estado_conservacion/valores": ESTADOS_CONSERVACION,
  "/listas/tipo_vista_foto/valores": VISTAS,
  "/personas": [{ id: "per-1", nombreCompleto: "Daniel Giannoni", alias: null, activo: true }],
  "/listas/tipo_documento/valores": [{ id: "td-acta", etiqueta: "Acta", codigo: null, orden: 1, activo: true, esSistema: true }],
};

export function ficha(cambios: Partial<FichaCompleta> = {}): FichaCompleta {
  return {
    id: "p1", version: "2026-10-20T10:00:00.000001+00:00", estadoFicha: "borrador", motivoRechazo: null,
    incompleta: true, camposFaltantes: ["procedencia"],
    campos: { denominacion: "Retablo ayacuchano", autor: "Taller Jiménez", procedencia: null, estado_conservacion_id: "ec-bueno",
      ubicacion_actual_id: "rack", estado_pieza_id: null },
    listas: {}, etiquetas: { estado_conservacion_id: "Bueno", ubicacion_actual_id: "Sede central › Depósito 2 · Rack 3" },
    codigos: [{ id: "c1", tipoCodigo: "I", tipoNombre: "N° de inventario MATP (I)", valor: "I-04381", bloqueado: true }],
    tenenciaVigente: { regimen: "propiedad", regimenNombre: "Propiedad", restringidoPublicacion: false },
    fotoPrincipal: { id: "f1", url: "https://archivos.museo.pe/f1.jpg" }, dadaDeBaja: false,
    creadoPor: { id: "u1", nombre: "Ana" }, creadoEn: "2026-10-20T10:00:00Z", actualizadoPor: { id: "u1", nombre: "Ana" },
    actualizadoEn: "2026-10-20T10:00:00Z",
    codigosDetalle: [{ id: "c1", tipoCodigoId: "tc-i", tipoCodigo: "I", tipoNombre: "N° de inventario MATP (I)", valor: "I-04381",
      valorNormalizado: "I-4381", nota: null, vigente: true, fuente: null, bloqueado: true, creadoEn: "2026-10-20T10:00:00Z" }],
    tenencias: [{ id: "t1", regimen: "propiedad", regimenNombre: "Propiedad", contraparte: null, fechaInicio: null, fechaFin: null,
      vigente: true, condicionesContractuales: null, restringidoPublicacion: false, creadoEn: "2026-10-20T10:00:00Z" }],
    fotografias: [
      { id: "f1", url: "https://archivos.museo.pe/f1.jpg", claveArchivo: null, tipoVistaId: null, orden: 0, esPrincipal: true, restringidoUso: false, creadoEn: "" },
      { id: "f2", url: "https://archivos.museo.pe/f2.jpg", claveArchivo: null, tipoVistaId: null, orden: 1, esPrincipal: false, restringidoUso: false, creadoEn: "" },
    ],
    documentos: [], movimientos: [], estados: [],
    ...cambios,
  };
}
