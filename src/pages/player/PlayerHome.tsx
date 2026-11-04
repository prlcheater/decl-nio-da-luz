import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function PlayerHome() {
  const { isMestre, loading } = useAuth()

  if (loading) return null
  // Mestre: painel com todas as fichas. Player: vai direto pra própria ficha,
  // sem menu intermediário.
  return <Navigate to={isMestre ? '/player/mestre' : '/player/ficha'} replace />
}
