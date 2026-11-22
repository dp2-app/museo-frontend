/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Montserrat es la tipografía de interfaz oficial (spec §3, "--font-ui").
        sans: ["Montserrat", "system-ui", "sans-serif"],
        display: ["Montserrat", "system-ui", "sans-serif"],
        // Source Serif 4 itálica: SOLO para el nombre de la pieza (spec §3, "--font-acento").
        accent: ['"Source Serif 4"', "Georgia", "serif"],
      },
      colors: {
        // Propuesta de interfaz §27: los alias históricos no recolorean los SVG institucionales.
        azul: "#183F43",
        rojo: "#B15C42",
        "rojo-oscuro": "#A24732",
        "gris-1": "#BDC3C9",
        "gris-2": "#5D6C69", // Texto secundario accesible (§26); los SVG institucionales se conservan.
        arcilla: "#FF6E26",
        paja: "#F0AE19",
        verde: "#009A73",
        texto: "#273C3D",
        arena: "#DEC69B",
        "fondo-coleccion": "#ECE9E0",
        "cobre-profundo": "#843724",
        control: "#7A8883", // Límite del campo distinguible sobre blanco.
        "estado-verde": "#006B50",
        "estado-ambar": "#795100",
        "fondo-suave": "#F5F3ED",
        linea: "#DDDCD3",
        foco: "#A24732",

        // --- Alias de compatibilidad ---
        // El código anterior a este rediseño usa las escalas clay/sand/ink/indigo
        // en decenas de lugares (text-ink-800, bg-clay-100, etc). En vez de reescribir
        // cada archivo, se remapean esas mismas claves a los tokens oficiales de
        // arriba: todo el código existente hereda la paleta correcta sin tocarlo.
        clay: {
          50: "#F9EEE8",
          100: "#F1D9CA",
          200: "#E7BC9D",
          300: "#D89774",
          400: "#C97756",
          500: "#B15C42", // = rojo
          600: "#A24732", // = rojo-oscuro
          700: "#843724",
          800: "#663126",
          900: "#49261F",
        },
        sand: {
          50: "#FFFFFF",
          100: "#F8FAFC",
          200: "#F5F3ED", // = fondo-suave
          300: "#DDDCD3", // = linea
          400: "#BDC3C9", // = gris-1
          500: "#5D6C69", // = gris-2
        },
        ink: {
          50: "#F5F3ED", // = fondo-suave
          100: "#E9EDE7",
          400: "#5D6C69", // = gris-2
          600: "#5D6C69",
          700: "#314D4B",
          800: "#273C3D", // = texto
          900: "#183F43", // = azul
        },
        indigo: {
          500: "#183F43", // = azul
          600: "#123337",
          700: "#0D292D",
        },
      },
      borderRadius: {
        btn: "10px",
        card: "16px",
        modal: "20px",
        pill: "9999px",
      },
      boxShadow: {
        sombra: "0 2px 12px rgba(24, 63, 67, 0.07)",
        // alias de compatibilidad (glass-panel/glass-panel-sm ya usaban estos nombres)
        glass: "0 2px 12px rgba(24, 63, 67, 0.07)",
        "glass-sm": "0 2px 12px rgba(24, 63, 67, 0.07)",
      },
      // Espaciado (spec §3, múltiplos de 8px + 4px interior): la escala nativa de
      // Tailwind (base 4px) ya lo cubre exactamente (space-1..5 del spec = p-1/2/4/6/10
      // de Tailwind = 4/8/16/24/40px) — sobreescribirla rompería cada p-3/gap-3/etc.
      // ya usado en el código existente, así que se deja intacta a propósito.
      maxWidth: {
        contenido: "1360px",
      },
    },
  },
  plugins: [],
}
