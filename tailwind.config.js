/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        // Paleta inspirada en la colección del museo: cerámica y arcilla
        // (clay), textiles teñidos con tierras (sand) y bordados en índigo
        // (indigo) como acento secundario.
        clay: {
          50: "#FBF3EC",
          100: "#F6E4D4",
          200: "#EBC7A8",
          300: "#DDA378",
          400: "#CC7F51",
          500: "#B8622F", // acento primario
          600: "#984D24",
          700: "#7A3D1E",
          800: "#5C2E18",
          900: "#3F2011",
        },
        sand: {
          50: "#FDFBF7",
          100: "#F8F1E6",
          200: "#F0E4D0",
          300: "#E5D2B4",
          400: "#D2B98F",
          500: "#B99966",
        },
        ink: {
          50: "#F5F3F0",
          100: "#E8E3DC",
          400: "#7A7168",
          600: "#4A4239",
          700: "#332C25",
          800: "#241F1A",
          900: "#171310",
        },
        indigo: {
          500: "#3B5169",
          600: "#2E4055",
          700: "#233241",
        },
      },
      backgroundImage: {
        "museo-gradient": "radial-gradient(120% 120% at 10% 0%, #FBF3EC 0%, #F3E4D0 45%, #E9D3B3 100%)",
      },
      boxShadow: {
        glass: "0 8px 32px -8px rgba(63, 32, 17, 0.18), inset 0 1px 0 0 rgba(255,255,255,0.5)",
        "glass-sm": "0 2px 12px -2px rgba(63, 32, 17, 0.12)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
}
