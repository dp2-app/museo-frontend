export interface MetadatosFoto {
  tipoVistaId?: string | null;
  fotografoId?: string | null;
  fechaFotografia?: string | null;
  restringidoUso: boolean;
}

/** Omitir metadatos que no cambiaron conserva referencias históricas/inactivas. */
export function cambiosMetadatosFoto(actual: MetadatosFoto, nuevo: MetadatosFoto): Partial<MetadatosFoto> {
  const cambios: Partial<MetadatosFoto> = {};
  for (const clave of ["tipoVistaId", "fotografoId", "fechaFotografia"] as const) {
    if ((actual[clave] ?? null) !== (nuevo[clave] ?? null)) cambios[clave] = nuevo[clave] ?? null;
  }
  if (actual.restringidoUso !== nuevo.restringidoUso) cambios.restringidoUso = nuevo.restringidoUso;
  return cambios;
}
