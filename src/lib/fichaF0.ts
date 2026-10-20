import type { CampoFicha, DatosFichaV3 } from "../types";

export function datosEditables(campos: CampoFicha[], datos: DatosFichaV3): DatosFichaV3 {
  const resultado: DatosFichaV3 = { campos: {}, listas: {} };
  for (const campo of campos.filter((c) => c.activo && !c.soloLectura)) {
    if (campo.almacenamiento === "lista") {
      if (campo.clave in datos.listas) resultado.listas[campo.clave] = datos.listas[campo.clave];
    } else if (campo.clave in datos.campos) resultado.campos[campo.clave] = datos.campos[campo.clave];
  }
  return resultado;
}

