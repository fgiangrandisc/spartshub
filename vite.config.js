import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Separar las dependencias de la app. React y Supabase casi no cambian,
    // así que el navegador los cachea entre despliegues en vez de volver a
    // bajar 600 kB cada vez que tocamos App.jsx. Mejora la carga repetida,
    // que es lo que Google mide en Core Web Vitals.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
