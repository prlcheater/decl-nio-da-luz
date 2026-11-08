import { Link, Navigate } from 'react-router-dom'
import { LogOut, Sparkles, Skull, Swords, Users, UserRound } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import GradientText from '@/components/GradientText'
import { GRADIENT_COLORS } from '@/lib/gameData'

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
        <Link to="/player/ficha" className="block">
          <GlowCard contentClassName="flex flex-col items-center gap-2 p-8 text-center">
            <svg width="0" height="0" className="absolute" aria-hidden="true">
              <defs>
                <linearGradient id="sheet-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  {GRADIENT_COLORS.slice(0, 3).map((color, index) => (
                    <stop key={color} offset={index * 50 + '%'} stopColor={color} />
                  ))}
                  <animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;180 .5 .5;0 .5 .5" dur="12s" repeatCount="indefinite" />
                </linearGradient>
              </defs>
            </svg>
            <UserRound size={30} strokeWidth={1.5} style={{ stroke: 'url(#sheet-icon-gradient)' }} />
            <GradientText colors={GRADIENT_COLORS} animationSpeed={6} showBorder={false} className="font-title font-semibold text-lg">
              Minha ficha
            </GradientText>
            <GradientText colors={GRADIENT_COLORS} animationSpeed={6} showBorder={false} className="font-body text-xs">
              Vinculada ao acesso de mestre.
            </GradientText>
          </GlowCard>
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
