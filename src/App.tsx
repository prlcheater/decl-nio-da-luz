import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import Navbar from '@/components/Navbar'
import SiteBackground from '@/components/SiteBackground'
import SmoothScroll from '@/components/SmoothScroll'
import ProtectedRoute from '@/components/ProtectedRoute'
import Home from '@/pages/Home'
import Codex from '@/pages/Codex'
import Livro from '@/pages/Livro'
import Login from '@/pages/Login'
import PlayerHome from '@/pages/player/PlayerHome'
import MinhaFicha from '@/pages/player/MinhaFicha'
import CriarFicha from '@/pages/player/CriarFicha'
import PainelMestre from '@/pages/player/PainelMestre'
import PainelElementalistas from '@/pages/player/PainelElementalistas'
import PainelInimigos from '@/pages/player/PainelInimigos'
import FichaInimigo from '@/pages/player/FichaInimigo'
import Combate from '@/pages/player/Combate'

export default function App() {
  return (
    <AuthProvider>
      <SmoothScroll />
      <SiteBackground />
      <Navbar />
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
    </AuthProvider>
  )
}
