// Espejo en TypeScript de app/schemas/*.py en museo-backend (docs/openapi.yaml).
// El wire format de la API es camelCase; estos tipos lo reflejan tal cual.

export interface Pagina<T> {
  items: T[];
  total: number;
}

export interface Coleccion {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Subcoleccion {
  id: string;
  coleccionId: string;
  nombre: string;
  descripcion: string | null;
}

export interface ValorVocabulario {
  id: string;
  tipo: string;
  valor: string;
  orden: number;
  activo: boolean;
}

export interface UbicacionFisica {
  id: string;
  parentId: string | null;
  nivelTipo: "sede" | "espacio" | "mueble" | "nivel" | "contenedor";
  nombre: string;
  hijos: UbicacionFisica[];
}

export interface Movimiento {
  id: string;
  ubicacionAnteriorId: string | null;
  ubicacionNuevaId: string;
  responsableId: string;
  motivo: string | null;
}

export interface CodigoExterno {
  id: string;
  tipoIdentificador: string;
  valor: string;
  valorNormalizado: string | null;
  vigente: boolean;
  bloqueadoEdicion: boolean;
}

export interface Fotografia {
  id: string;
  url: string;
  tipoVista: string | null;
  orden: number;
  restringidoUso: boolean;
}

export interface Pieza {
  id: string;
  coleccionId: string | null;
  subcoleccionId: string | null;
  categoriaId: string | null;
  estadoConservacionId: string | null;
  ubicacionActualId: string | null;
  denominacion: string | null;
  descripcion: string | null;
  procedencia: string | null;
  autor: string | null;
  materiales: string | null;
  tecnica: string | null;
  medidas: string | null;
  fechaIngreso: string | null;
  observaciones: string | null;
  propietario: string;
  epocaTexto: string | null;
  disponibilidad: string;
  informacionCompleta: boolean;
}

export interface PiezaDetalle extends Pieza {
  codigosExternos: CodigoExterno[];
  fotografias: Fotografia[];
}

export interface RegistroAuditoria {
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  accion: "insert" | "update" | "soft_delete";
  usuarioId: string | null;
  fecha?: string;
}

export interface PlantillaMapeo {
  id: string;
  nombre: string;
  fuenteOrigen: string;
  mapeoColumnas: Record<string, string>;
}

export interface CargaExcel {
  id: string;
  archivoNombre: string;
  estado: "en_revision" | "pendiente_aprobacion" | "aprobada" | "rechazada";
  totalFilas: number;
  filasNuevas: number;
  filasActualizacion: number;
  filasDuplicadas: number;
  filasConflicto: number;
  filasRechazadas: number;
  iniciadaEn: string;
  aprobadaEn: string | null;
}

export interface FilaImportacion {
  id: string;
  numeroFila: number;
  datosOriginales: Record<string, unknown>;
  datosNormalizados: Record<string, unknown> | null;
  clasificacion: "nuevo" | "actualizacion" | "duplicado" | "conflicto";
  piezaCoincidenteId: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivoRechazo: string | null;
}

export interface FilaImportacionPagina {
  items: FilaImportacion[];
  total: number;
  resumen: { nuevo: number; actualizacion: number; duplicado: number; conflicto: number };
}

export type TipoSugerencia =
  | "RIA-01-extraccion-observaciones"
  | "RIA-02-duplicados-similitud"
  | "RIA-03-categoria-sugerida"
  | "RIA-04-descripcion-preliminar"
  | "RIA-05-consulta-catalogo";

export interface SugerenciaIA {
  id: string;
  tipo: TipoSugerencia;
  piezaId: string | null;
  piezaRelacionadaId: string | null;
  payloadSugerido: Record<string, unknown>;
  modeloUsado: string;
  confianza: number | null;
  estado: "pendiente" | "aceptado" | "rechazado" | "modificado";
}
