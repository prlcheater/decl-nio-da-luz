import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Sessão persistente: uma vez logado num dispositivo, continua logado —
    // sem expiração forçada por inatividade.
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Client separado, sem persistência, usado só para criar logins novos
// (supabaseAuthless.auth.signUp) a partir da tela de "Criar Ficha" do mestre.
// Como não persiste sessão, o signUp do jogador novo nunca sobrescreve a
// sessão do mestre que está logado no client principal acima.
export const supabaseAuthless = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'declinio-authless',
  },
})
