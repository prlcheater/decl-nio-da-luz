import { Link, Navigate } from 'react-router-dom'
import { LogOut, Sparkles, Skull, Swords, Users, UserRound } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'

const MENU_ITEMS = [
  { to: '/player/mestre/npcs', label: 'Personagens do Mundo', desc: 'NPCs com ficha completa, sem login próprio.', icon: Users },
  { to: '/player/mestre/elementalistas', label: 'Elementalistas', desc: 'Ver, criar e gerenciar as fichas dos jogadores.', icon: Sparkles },
  { to: '/player/mestre/inimigos', label: 'Inimigos', desc: 'Cadastrar inimigos e instâncias de combate.', icon: Skull },
  { to: '/player/combate', label: 'Combate', desc: 'Montar e controlar o combate ativo.', icon: Swords },
]

export default function PainelMestre() {
  const { isMestre, profile, signOut } = useAuth()

  if (!isMestre) return <Navigate to="/player" replace />

  return (
    <div className="character-sheet mx-auto max-w-3xl px-6 py-16">
      <Reveal trigger="mount" className="flex items-start justify-between">
        <div>
          <h1 className="font-title font-bold text-3xl">Área do Mestre</h1>
          <p className="mt-2 font-body text-neutral-400">Acesso de mestre{profile ? `, ${profile.username}` : ''}.</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-neutral-300"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sair
        </button>
      </Reveal>

      <Reveal trigger="mount" delay={60} className="mt-8">
         <Link to="/player/ficha" className="flex items-center gap-5 rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-950/70 to-neutral-950 p-6 transition-colors hover:border-cyan-300/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
           <UserRound size={36} className="shrink-0 text-cyan-200" />
           <div className="min-w-0">
             <p className="font-title text-2xl font-semibold text-cyan-50">Minha ficha</p>
             <p className="mt-2 font-body text-sm text-cyan-100/70">Seu personagem, suas habilidades e sua jornada. Vinculado ao seu acesso de mestre.</p>
           </div>
         </Link>
       </Reveal>
       <Reveal trigger="mount" delay={100} className="mt-6 grid gap-4 sm:grid-cols-2">
        {MENU_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className="block">
            <GlowCard contentClassName="flex flex-col items-center gap-2 p-8 text-center">
              <item.icon size={30} strokeWidth={1.5} className="text-neutral-300" />
              <p className="font-title font-semibold text-lg text-neutral-100">{item.label}</p>
              <p className="font-body text-xs text-neutral-500">{item.desc}</p>
            </GlowCard>
          </Link>
        ))}
      </Reveal>
    </div>
  )
}
