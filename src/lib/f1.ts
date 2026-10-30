// F1 · reglas de presentación compartidas por las pantallas de identificadores y tenencia.
// La regla de negocio la aplica el backend; estas funciones solo la reflejan en la interfaz.
import type { Codigo, PiezaResumenF1, Regimen, TipoCodigo } from "../types/f1";

/** Sin fila en reglas-codigo, el régimen admite el tipo (F1.md §2.D). */
export function admite(regimen: Regimen, tipoId: string) {
  return regimen.reglasCodigo.find((r) => r.tipoCodigoId === tipoId)?.permitido ?? true;
}

/** F1-D6 (RF-06): una pieza está pendiente si no tiene código vigente del tipo principal y su régimen vigente
 * lo admite. Es el mismo criterio que el filtro `GET /piezas?sinCodigoPrincipal=true`; las piezas en comodato
 * nunca están pendientes. Recibe los códigos vigentes de la pieza, como los devuelven `GET /piezas` y la ficha. */
export function pendienteDeCodigoI(pieza: Pick<PiezaResumenF1, "codigos" | "tenenciaVigente">, tipos: TipoCodigo[], regimenes: Regimen[]) {
  const principal = tipos.find((t) => t.esPrincipal);
  if (!principal || pieza.codigos.some((c) => c.tipoCodigo === principal.clave)) return false;
  const regimen = regimenes.find((r) => r.clave === pieza.tenenciaVigente?.regimen);
  return regimen ? admite(regimen, principal.id) : true;
}

export const MOTIVO_MINIMO = 10;

/** Permiso para corregir o retirar un código: si está bloqueado (inmutable), solo por excepción (RF-05). */
export function puedeCorregir(codigo: Pick<Codigo, "bloqueado">, puede: (p: string) => boolean) {
  return codigo.bloqueado ? puede("codigos.corregir_inmutable") : puede("codigos.gestionar");
}

export function fecha(valor: string | null) {
  return valor ? new Date(`${valor}T00:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
