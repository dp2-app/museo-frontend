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
        // Paleta institucional MATP/PUCP — spec §3. Fija, no negociable sin
        // tocar FRONTEND_DESIGN_SPEC.md del prototipo hermano (sgdcm-frontend).
        azul: "#042354",
        rojo: "#EB3156",
        "rojo-oscuro": "#C3094A",
        "gris-1": "#BDC3C9",
        "gris-2": "#959EA9",
        arcilla: "#FF6E26",
        paja: "#F0AE19",
        verde: "#009A73",
        texto: "#1B2B4B",
        "fondo-suave": "#F3F5F8",
        linea: "#E3E7EC",
        foco: "#5366FF",

        // --- Alias de compatibilidad ---
        // El código anterior a este rediseño usa las escalas clay/sand/ink/indigo
        // en decenas de lugares (text-ink-800, bg-clay-100, etc). En vez de reescribir
        // cada archivo, se remapean esas mismas claves a los tokens oficiales de
        // arriba: todo el código existente hereda la paleta correcta sin tocarlo.
        clay: {
          50: "#FDEEF1",
          100: "#FBD9E0",
          200: "#F5AEBE",
          300: "#F0839C",
          400: "#EB577A",
          500: "#EB3156", // = rojo
          600: "#C3094A", // = rojo-oscuro
          700: "#9E0740",
          800: "#7A0533",
          900: "#560325",
        },
        sand: {
          50: "#FFFFFF",
          100: "#F8FAFC",
          200: "#F3F5F8", // = fondo-suave
          300: "#E3E7EC", // = linea
          400: "#BDC3C9", // = gris-1
          500: "#959EA9", // = gris-2
        },
        ink: {
          50: "#F3F5F8", // = fondo-suave
          100: "#E7EAF0",
          400: "#959EA9", // = gris-2
          600: "#3D4A63",
          700: "#223458",
          800: "#1B2B4B", // = texto
          900: "#042354", // = azul
        },
        indigo: {
          500: "#042354", // = azul
          600: "#031B40",
          700: "#02132D",
        },
      },
      borderRadius: {
        btn: "6px",
        card: "8px",
        modal: "12px",
        pill: "9999px",
      },
      boxShadow: {
        sombra: "0 2px 12px rgba(4, 35, 84, 0.08)",
        // alias de compatibilidad (glass-panel/glass-panel-sm ya usaban estos nombres)
        glass: "0 2px 12px rgba(4, 35, 84, 0.08)",
        "glass-sm": "0 2px 12px rgba(4, 35, 84, 0.08)",
      },
      // Espaciado (spec §3, múltiplos de 8px + 4px interior): la escala nativa de
      // Tailwind (base 4px) ya lo cubre exactamente (space-1..5 del spec = p-1/2/4/6/10
      // de Tailwind = 4/8/16/24/40px) — sobreescribirla rompería cada p-3/gap-3/etc.
      // ya usado en el código existente, así que se deja intacta a propósito.
      maxWidth: {
        contenido: "1200px",
      },
    },
  },
  plugins: [],
}
