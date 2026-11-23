/**
 * Prepara una foto tomada con el celular para subirla (F2, completar fichas sin fricción): respeta la orientación
 * que guardó la cámara (EXIF), la reduce a un lado máximo y la convierte a JPEG. Así una foto de 8–12 MB sale en
 * ~0,5 MB, sube rápido con datos móviles y siempre cumple «JPG o PNG de hasta 15 MB» de la ficha.
 */
export const LADO_MAXIMO_FOTO = 2400;
const CALIDAD_JPEG = 0.86;

export const MENSAJE_FOTO_ILEGIBLE =
  "No se pudo leer la foto. Si tu celular guarda en formato HEIC, cambia la cámara a «Más compatible» (JPG) o elige otra imagen.";

/** Lado mayor de la imagen reducida: nunca agranda y mantiene la proporción. */
export function dimensionesReducidas(ancho: number, alto: number, maximo = LADO_MAXIMO_FOTO): { ancho: number; alto: number } {
  const escala = Math.min(1, maximo / Math.max(ancho, alto, 1));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

export async function prepararFoto(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo elegido no es una imagen.");
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(MENSAJE_FOTO_ILEGIBLE);
  }
  const { ancho, alto } = dimensionesReducidas(imagen.width, imagen.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) { imagen.close(); throw new Error(MENSAJE_FOTO_ILEGIBLE); }
  contexto.fillStyle = "#fff"; // un PNG con transparencia no debe quedar negro al pasar a JPEG
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();
  const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", CALIDAD_JPEG));
  if (!blob) throw new Error(MENSAJE_FOTO_ILEGIBLE);
  return new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
}
