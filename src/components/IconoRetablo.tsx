// Único ícono propio del sistema (spec de diseño §4): máscara CSS sobre el SVG
// final (public/brand/icon_retablo_24.svg) para heredar currentColor sin tocar
// el archivo, igual que el resto de íconos de lucide-react.
export function IconoRetablo({ size = 24, className }: { size?: number; className?: string }) {
  const mask = "url(/brand/icon_retablo_24.svg)";
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
