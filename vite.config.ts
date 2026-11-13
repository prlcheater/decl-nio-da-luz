import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Separa os fornecedores grandes do bundle principal. As rotas também são
    // carregadas sob demanda (React.lazy em src/App.tsx).
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'postprocessing'],
          gsap: ['gsap', '@gsap/react'],
          motion: ['motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
