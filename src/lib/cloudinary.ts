/**
 * Subida directa (sin pasar por el backend) usando un "unsigned upload preset"
 * de Cloudinary. Es el patrón recomendado para subir desde el navegador sin
 * exponer el API secret: solo se necesitan el cloud name y el nombre del
 * preset, ambos públicos por diseño (RF-013).
 *
 * Configuración requerida en Cloudinary (una vez, por el administrador del
 * proyecto): Settings → Upload → Add upload preset → Signing mode: Unsigned.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export function cloudinaryConfigurado(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export async function subirImagenACloudinary(archivo: File): Promise<string> {
  if (!cloudinaryConfigurado()) {
    throw new Error(
      "Cloudinary no está configurado (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET ausentes).",
    );
  }

  const form = new FormData();
  form.append("file", archivo);
  form.append("upload_preset", UPLOAD_PRESET!);

  const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.error?.message || "No se pudo subir la imagen a Cloudinary");
  }

  const datos = await respuesta.json();
  return datos.secure_url as string;
}
