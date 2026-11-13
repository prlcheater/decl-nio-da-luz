import { lazy, Suspense } from 'react'
import { useLocation, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import Navbar from '@/components/Navbar'
import VersionBadge from '@/components/VersionBadge'
import SiteBackground from '@/components/SiteBackground'
import SmoothScroll from '@/components/SmoothScroll'
import ProtectedRoute from '@/components/ProtectedRoute'
// Home fica no bundle inicial (primeira dobra); o resto entra por rota.
import Home from '@/pages/Home'

const Codex = lazy(() => import('@/pages/Codex'))
const Livro = lazy(() => import('@/pages/Livro'))
const Login = lazy(() => import('@/pages/Login'))
const PlayerHome = lazy(() => import('@/pages/player/PlayerHome'))
const MinhaFicha = lazy(() => import('@/pages/player/MinhaFicha'))
const CriarFicha = lazy(() => import('@/pages/player/CriarFicha'))
const PainelMestre = lazy(() => import('@/pages/player/PainelMestre'))
const PainelElementalistas = lazy(() => import('@/pages/player/PainelElementalistas'))
const PainelInimigos = lazy(() => import('@/pages/player/PainelInimigos'))
const FichaInimigo = lazy(() => import('@/pages/player/FichaInimigo'))
const Combate = lazy(() => import('@/pages/player/Combate'))

export default function App() {
  const { pathname } = useLocation()
  return (
    <AuthProvider>
      <SmoothScroll />
      <SiteBackground />
      <Navbar />
      {pathname !== '/' && (
        <div className="fixed bottom-4 left-4 z-40">
          <VersionBadge compact />
        </div>
      )}
      <Suspense fallback={<div className="mx-auto max-w-4xl px-6 py-24 text-center font-body text-sm text-neutral-500">Carregando…</div>}>
      <Routes>
         <Route path="/player/minha-ficha/criar" element={<ProtectedRoute><CriarFicha key="self" mode="self" /></ProtectedRoute>} />
         <Route path="/player/mestre/npcs" element={<ProtectedRoute><PainelElementalistas key="npcs" npc /></ProtectedRoute>} />
         <Route path="/player/mestre/npcs/criar" element={<ProtectedRoute><CriarFicha key="npc" mode="npc" /></ProtectedRoute>} />
        <Route path="/" element={<Home />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/livro" element={<Livro />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/player"
          element={
            <ProtectedRoute>
              <PlayerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/ficha"
          element={
            <ProtectedRoute>
              <MinhaFicha />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/ficha/:id"
          element={
            <ProtectedRoute>
              <MinhaFicha />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/ficha/criar"
          element={
            <ProtectedRoute>
              <CriarFicha />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/mestre"
          element={
            <ProtectedRoute>
              <PainelMestre />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/mestre/elementalistas"
          element={
            <ProtectedRoute>
              <PainelElementalistas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/mestre/inimigos"
          element={
            <ProtectedRoute>
              <PainelInimigos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/mestre/inimigos/:id"
          element={
            <ProtectedRoute>
              <FichaInimigo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/combate"
          element={
            <ProtectedRoute>
              <Combate />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
