/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Lo que cubren las pruebas de F2 y las utilidades compartidas; cada flujo suma sus archivos al agregar pruebas.
      include: ['src/lib/api.ts', 'src/lib/fichaF0.ts', 'src/lib/ubicaciones.ts', 'src/lib/secciones.ts', 'src/components/f2/**',
        'src/pages/NuevaPiezaPage.tsx', 'src/pages/PiezaDetailPage.tsx', 'src/pages/PiezasPage.tsx'],
      reporter: ['text-summary', 'cobertura'],
      thresholds: { lines: 80 },
    },
  },
})
