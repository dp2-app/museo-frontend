/** Cuenta con singular y plural: contar(1, "fila", "filas") → "1 fila". */
export function contar(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
