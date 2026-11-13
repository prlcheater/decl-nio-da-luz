/// <reference types="vite/client" />

// Injetado pelo Vite (vite.config.ts → define) a partir do package.json.
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
