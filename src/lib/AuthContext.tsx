import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type Profile = {
  id: string
  username: string
  avatar_url: string | null
  role: 'player' | 'mestre'
}

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isMestre: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  // Id do usuário cujo perfil já foi consultado, tendo ou não encontrado perfil.
  const [profileCheckedFor, setProfileCheckedFor] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setProfileCheckedFor(null)
      return
    }
    const userId = session.user.id
    supabase
      .from('profiles')
      .select('id, username, avatar_url, role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data)
        setProfileCheckedFor(userId)
      })
  }, [session])

  // Derivado a cada render (em vez de um booleano separado) para não depender
  // da ordem de execução dos efeitos. Espera a consulta do perfil terminar, não o
  // perfil existir: login sem perfil ou banco fora do ar não pode travar a área
  // logada numa tela em branco.
  const loading = sessionLoading || (!!session && profileCheckedFor !== session.user.id)

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, isMestre: profile?.role === 'mestre', signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
