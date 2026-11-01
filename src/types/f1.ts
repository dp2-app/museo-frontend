// F1 · Identificadores y tenencia: espejo de los esquemas de `museo-backend/app/modulos/identificadores/esquemas.py`
// (contrato en Base-de-conocimiento/flujos/F1.md §3). Archivo propio para no chocar con los tipos de otros flujos.

export interface TipoCodigo {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  patron: string | null;
  esUnico: boolean;
  inmutable: boolean;
  esCorrelativo: boolean;
  esPrincipal: boolean;
  permiteMultiples: boolean;
  orden: number;
  activo: boolean;
  esSistema: boolean;
}

export interface ReglaCodigo { tipoCodigoId: string; clave: string; permitido: boolean; }

export interface Regimen {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  ingresaInventarioPermanente: boolean;
  requiereContraparte: boolean;
  requiereFechas: boolean;
  orden: number;
  activo: boolean;
  esSistema: boolean;
  reglasCodigo: ReglaCodigo[];
}

export type TipoPersona = "juridica" | "natural";

export interface Propietario {
  id: string;
  tipoPersona: TipoPersona;
  nombre: string;
  direccion: string | null;
  documentoIdentidad: string | null;
  esPorDefecto: boolean;
  activo: boolean;
}

export interface Codigo {
  id: string;
  tipoCodigoId: string;
  tipoCodigo: string;
  tipoNombre: string;
  valor: string;
  valorNormalizado: string;
  nota: string | null;
  vigente: boolean;
  fuente: string | null;
  bloqueado: boolean;
  creadoEn: string;
}

export interface Tenencia {
  id: string;
  piezaId: string | null;
  regimen: string;
  regimenNombre: string;
  contraparte: Propietario | null;
  referenciaExterna: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  vigente: boolean;
  condicionesContractuales: string | null;
  restringidoPublicacion: boolean;
  documentoReferencia: string | null;
  creadoEn: string;
}

export interface ProblemaCodigo { codigo: string; mensaje: string; }

export interface CodigoValidado {
  tipoCodigoId: string;
  valor: string;
  valorNormalizado: string | null;
  errores: ProblemaCodigo[];
  advertencias: ProblemaCodigo[];
}

export interface ValidacionCodigos { valido: boolean; codigos: CodigoValidado[]; }

/** Fila de `GET /piezas` (PiezaSchema del v3), solo con lo que usan las pantallas de F1. */
export interface PiezaResumenF1 {
  id: string;
  estadoFicha: string;
  campos: Record<string, unknown>;
  codigos: { id: string; tipoCodigo: string; tipoNombre: string; valor: string; bloqueado: boolean }[];
  tenenciaVigente: { regimen: string; regimenNombre: string; restringidoPublicacion: boolean } | null;
  fotoPrincipal: { id: string; url: string } | null;
  actualizadoEn: string;
}
