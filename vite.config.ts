import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A versão exibida no app (badge Beta) vem do package.json — uma fonte só.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string }

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
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
