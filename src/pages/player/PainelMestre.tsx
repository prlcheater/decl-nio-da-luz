import { Link, Navigate } from 'react-router-dom'
import { LogOut, Sparkles, Skull, Swords } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'

const MENU_ITEMS = [
  { to: '/player/mestre/elementalistas', label: 'Elementalistas', desc: 'Ver, criar e gerenciar as fichas dos jogadores.', icon: Sparkles },
  { to: '/player/mestre/inimigos', label: 'Inimigos', desc: 'Cadastrar inimigos e instâncias de combate.', icon: Skull },
  { to: '/player/combate', label: 'Combate', desc: 'Montar e controlar o combate ativo.', icon: Swords },
]

export default function PainelMestre() {
  const { isMestre, profile, signOut } = useAuth()

  if (!isMestre) return <Navigate to="/player" replace />

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Reveal className="flex items-start justify-between">
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

      <Reveal delay={100} className="mt-10 grid gap-4 sm:grid-cols-3">
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
