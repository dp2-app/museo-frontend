export interface FotoAlta {
  clave: string;
  url?: string;
  archivo?: File;
  vista: string;
  formato: "jpg" | "png";
}

export interface ProgresoAlta {
  piezaId?: string;
  fotos: Record<string, { url?: string; id?: string }>;
  principalId?: string;
}

export function validarUrlFoto(valor: string): string | null {
  try {
    const url = new URL(valor.trim());
    if (url.protocol !== "https:" || !/\.(jpg|png)$/i.test(url.pathname)) return "Usa una dirección HTTPS de una imagen JPG o PNG.";
  } catch { return "Escribe una dirección HTTPS válida de la fotografía."; }
  return null;
}

interface OperacionesAlta {
  crear: () => Promise<{ id: string }>;
  subir: (archivo: File) => Promise<string>;
  agregarFoto: (piezaId: string, foto: { url: string; formato: string; tamanoBytes?: number }) => Promise<{ id: string }>;
  elegirPrincipal: (piezaId: string, fotoId: string) => Promise<unknown>;
  alAvanzar?: (mensaje: string) => void;
}

/** Conserva cada resultado confirmado. Con un ID recibido, el reintento conserva la pieza y sus fotos confirmadas. */
export async function registrarPiezaConFotos(progreso: ProgresoAlta, fotos: FotoAlta[], principal: string, operaciones: OperacionesAlta): Promise<string> {
  if (!progreso.piezaId) {
    operaciones.alAvanzar?.("Registrando los datos de la pieza…");
    progreso.piezaId = (await operaciones.crear()).id;
  }
  for (const [i, foto] of fotos.entries()) {
    const guardada = progreso.fotos[foto.clave] ??= {};
    if (guardada.id) continue;
    operaciones.alAvanzar?.(`Guardando fotografía ${i + 1} de ${fotos.length}…`);
    if (!guardada.url) {
      if (foto.url) guardada.url = foto.url;
      else if (foto.archivo) guardada.url = await operaciones.subir(foto.archivo);
      else throw new Error("Vuelve a elegir la fotografía pendiente.");
    }
    guardada.id = (await operaciones.agregarFoto(progreso.piezaId, { url: guardada.url, formato: foto.formato, ...(foto.archivo ? { tamanoBytes: foto.archivo.size } : {}) })).id;
  }
  const elegida = fotos.find((f) => f.clave === principal) ?? fotos[0];
  const fotoId = elegida && progreso.fotos[elegida.clave]?.id;
  if (fotoId && progreso.principalId !== fotoId) {
    operaciones.alAvanzar?.("Definiendo la fotografía principal…");
    await operaciones.elegirPrincipal(progreso.piezaId, fotoId);
    progreso.principalId = fotoId;
  }
  return progreso.piezaId;
}
