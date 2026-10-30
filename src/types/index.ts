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
  fecha: string;
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

export type EstadoFicha = "borrador" | "en_revision" | "aprobada" | "rechazada";
export type AccionEstadoFicha = "enviar_revision" | "aprobar" | "rechazar";

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
  estadoFicha: EstadoFicha;
  motivoRechazo: string | null;
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
  accion: "insert" | "update" | "soft_delete" | "restore";
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
  hojaNombre: string | null;
  usuarioId: string;
  plantillaMapeoId: string | null;
  estado: "en_revision" | "pendiente_aprobacion" | "aprobada" | "rechazada" | "cancelada";
  totalFilas: number;
  filasNuevas: number;
  filasActualizacion: number;
  filasDuplicadas: number;
  filasConflicto: number;
  filasRechazadas: number;
  filasConError: number;
  iniciadaEn: string;
  aprobadaEn: string | null;
  motivoRechazo: string | null;
  puedeAprobar?: boolean | null;
  /** Reglas de duplicado con que se concilió la carga (RF-58, RF-39). */
  reglasAplicadas?: { activas?: string[]; similitudMinima?: number };
}

export interface ReglaDuplicado {
  clave: string;
  etiqueta: string;
  activa: boolean;
  /** false para la regla del mismo código (RF-32), que siempre rige. */
  configurable: boolean;
}

export interface ReglasImportacion {
  reglas: ReglaDuplicado[];
  similitudMinima: number;
  requiereAprobacion: boolean;
  permisoAprobador: string;
}

export interface CuracionImportacion {
  id: string;
  estado: "pendiente" | "validado";
  piezaId: string;
  piezaDenominacion: string | null;
  cargaId: string;
  archivoNombre: string;
  filaNumero: number;
  motivos: { codigo: string; mensaje: string }[];
  creadoEn: string;
  validadoPor: string | null;
  validadoEn: string | null;
  nota: string | null;
}

export interface IncidenciaFila {
  campo: string | null;
  codigo?: string;
  mensaje: string;
  columna?: string | null;
  valorOriginal?: unknown;
}

export interface FilaImportacion {
  id: string;
  numeroFila: number;
  datosOriginales: Record<string, unknown>;
  datosNormalizados: {
    mapeados?: Record<string, unknown>;
    columnas?: Record<string, string>;
    advertencias?: IncidenciaFila[];
  } | null;
  clasificacion: "nuevo" | "actualizacion" | "duplicado" | "conflicto";
  piezaCoincidenteId: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivoRechazo: string | null;
  errores: IncidenciaFila[];
  camposNoMapeados: Record<string, unknown>;
  identificadores: { tipo: string; valor: string }[];
  candidatos: {
    regla: string; explicacion: string; piezaId?: string; piezaDenominacion?: string; filaNumero?: number;
  }[];
  curacionPendiente: boolean;
  piezaResultanteId: string | null;
  cambios: { campo: string; etiqueta: string; valorActual: unknown; valorNuevo: unknown }[];
}

export interface DeteccionExcel {
  hoja: string;
  hojas: string[];
  columnas: { columna: string; destinoSugerido: string | null; muestra: unknown[]; vacias: number; total: number }[];
}

export interface DestinoImportacion { clave: string; etiqueta: string; }

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

export interface ReporteCalidadDatos {
  totalPiezas: number;
  piezasCompletas: number;
  piezasIncompletas: number;
  porcentajeCompleto: number;
  sugerenciasPendientes: { ria01: number; ria02: number };
  piezasElegiblesParaRia01: number;
  ria01Configurado: boolean;
}

// --- F10 · RIA-05: armado de salas (POST /ia/salas/sugerir) ---

export interface AlertaSala {
  codigo: "ficha_no_aprobada" | "conservacion" | "en_prestamo";
  mensaje: string;
}

export interface PiezaSala {
  posicion: number;
  piezaId: string;
  puntaje: number;
  codigo: string | null;
  denominacion: string | null;
  tipoBien: string | null;
  materiales: string | null;
  procedencia: string | null;
  autor: string | null;
  ubicacion: string | null;
  estadoFicha: string;
  alertas: AlertaSala[];
}

export interface SalaSugerida {
  sugerenciaId: string;
  pedido: string;
  cantidad: number;
  mensaje: string;
  fueraDeTema: boolean;
  pocasPiezas: boolean;
  busqueda: "hibrida" | "texto";
  modeloUsado: string;
  estado: "pendiente" | "aceptado" | "rechazado" | "modificado";
  piezas: PiezaSala[];
}

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

// --- HU-22: usuarios y roles ---

export interface Rol {
  id: string;
  nombre: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  rol: Rol;
  proveedorAuth?: string;
  ultimoAcceso?: string | null;
  creadoEn?: string;
}

export interface UsuarioInput {
  nombre: string;
  email: string;
  password: string;
  rolId: string;
}

export interface UsuarioUpdate {
  nombre?: string;
  rolId?: string;
  activo?: boolean;
  password?: string;
}

// --- HU-22: bitácora global ---

export interface RegistroAuditoriaGlobal extends RegistroAuditoria {
  id: string;
  tabla: string;
  registroId: string;
  motivo?: string | null;
  usuarioNombre?: string | null;
}

// --- HU-17: panel principal ---

export interface AlertaPanel {
  piezaId: string;
  denominacion: string | null;
  camposFaltantes: string[];
}

// Contrato v3 de GET /reportes/panel-principal. `piezasSinUbicacion` es null si el rol no ve el campo de ubicación (F9, RF-57).
// `alertas` ya no viene en v3: la lista de piezas incompletas está en /reportes/informacion-incompleta.
export interface ReportePanelPrincipal {
  totalPiezas: number;
  porcentajeCompleto: number;
  piezasSinUbicacion: number | null;
  piezasSinFoto: number;
  piezasRequierenAtencion: number;
  distribucionPorColeccion: { coleccion: string; total: number }[];
  alertas?: AlertaPanel[];
}

// --- RF-034: piezas por ubicación ---

export interface ReportePorUbicacion {
  porUbicacion: { ubicacionId: string; ubicacion: string; total: number }[];
  sinUbicacion: number;
}

// F0 · Contrato v3, aditivo: conserva los tipos de los otros flujos.
export interface ErrorApi { campo: string | null; codigo: string; mensaje: string; }
export interface TipoLista { id: string; clave: string; nombre: string; descripcion: string | null; esSistema: boolean; activo: boolean; }
export interface ValorLista { id: string; etiqueta: string; codigo: string | null; orden: number; activo: boolean; esSistema: boolean; }
export interface Equivalencia { id: string; textoOrigen: string; textoNormalizado: string; valorId: string; valorEtiqueta: string; fuente: string | null; validado: boolean; }
export interface Parametro { clave: string; valor: unknown; descripcion: string | null; }
export interface CampoFicha {
  id: string; clave: string; etiqueta: string; tipo: "texto" | "numero" | "fecha" | "lista" | "referencia";
  lista: Pick<TipoLista, "id" | "clave" | "nombre"> | null;
  multivalor: boolean; obligatorio: boolean; orden: number; grupo: string; ayuda: string | null;
  activo: boolean; esBase: boolean; almacenamiento: "columna" | "adicional" | "lista"; soloLectura: boolean;
}
export interface SesionV3 { usuario: Usuario; permisos: string[]; camposOcultos: string[]; }
export interface DatosFichaV3 { campos: Record<string, unknown>; listas: Record<string, string[]>; }

// --- F9: permisos por funcionalidad y acción (RF-52) ---

export type AccionPermiso = "ver" | "crear" | "editar" | "aprobar" | "exportar" | "otra";

/** Una celda de la matriz: `recurso` es la fila y `accion` la columna. `requiere` es el permiso previo (editar exige ver). */
export interface Permiso {
  clave: string;
  modulo: string;
  recurso: string;
  accion: AccionPermiso;
  requiere: string | null;
  orden: number;
  descripcion: string | null;
}

export interface RolDetalle extends Rol {
  descripcion: string | null;
  activo: boolean;
  esSistema: boolean;
  permisos: string[];
}

export interface VisibilidadCampo {
  campoId: string;
  clave: string;
  etiqueta: string | null;
  grupo: string | null;
  rolId: string;
  rol: string;
  visible: boolean;
}

// --- F10 · RIA-05: estado del índice de salas (GET /ia/salas/indice) ---

export interface EjecucionIndice {
  origen: "programada" | "manual";
  iniciadaEn: string;
  terminadaEn: string | null;
  piezasRevisadas: number | null;
  indexadas: number | null;
  conEmbedding: number | null;
  corte: "cuota_diaria" | "cupo_diario" | "error" | null;
  detalle: string | null;
}

export interface EstadoIndiceSalas {
  proveedor: string;
  proveedorDisponible: boolean;
  piezasElegibles: number;
  conTexto: number;
  conEmbeddingAlDia: number;
  conEmbeddingDesactualizado: number;
  sinDescripcion: number;
  sinEmbedding: number;
  enCurso: boolean;
  ultimaEjecucion: EjecucionIndice | null;
  cuotaDiaria: number | null;
  cupoDiarioIndexado: number | null;
  indexadoHoy: number;
  reservaConsultas: number;
  automatico: boolean;
  horaProgramada: string;
  zonaHoraria: string;
  proximaEjecucion: string;
  atrasada: boolean;
}
