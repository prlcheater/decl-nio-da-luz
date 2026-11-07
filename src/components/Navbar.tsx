import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, BookOpen, BookText, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import GradientText from '@/components/GradientText'
import { GRADIENT_COLORS } from '@/lib/gameData'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-2 font-body text-sm tracking-wide transition-colors duration-300 ${
    isActive ? 'text-white' : 'text-neutral-400 hover:text-white'
  }`

// Entra em fade depois que o título da página já está bem avançado na sua animação (~2.2s).
const MENU_REVEAL_MS = 2200

export default function Navbar() {
  const { session, profile, loading } = useAuth()
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(false)
  const welcomeName = !loading && session && profile ? profile.username : null

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), MENU_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <nav
      className="sticky top-0 z-50 grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-2 md:grid-cols-[1fr_auto_1fr] md:gap-4 sm:px-6 border-b border-neutral-800/60 bg-base/70 backdrop-blur-md"
      style={{ opacity: visible || pathname.startsWith('/player') ? 1 : 0, transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="player-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={GRADIENT_COLORS[0]} />
            <stop offset="50%" stopColor={GRADIENT_COLORS[1]} />
            <stop offset="100%" stopColor={GRADIENT_COLORS[2]} />
          </linearGradient>
        </defs>
      </svg>

      <NavLink
        to="/"
        end
        className="whitespace-nowrap font-title font-semibold tracking-wide text-xs sm:text-sm md:text-base justify-self-start"
      >
        Declínio da Luz
      </NavLink>

      <div className="col-span-2 row-start-2 flex w-full items-center justify-around md:col-span-1 md:row-start-1 md:col-start-2">
        <NavLink to="/" end className={linkClass}>
          <Home size={16} strokeWidth={1.75} />
          <span className="inline">Home</span>
        </NavLink>
        <NavLink to="/codex" className={linkClass}>
          <BookOpen size={16} strokeWidth={1.75} />
          <span className="inline">Codex</span>
        </NavLink>
        <NavLink to="/livro" className={linkClass}>
          <BookText size={16} strokeWidth={1.75} />
          <span className="inline">Livro</span>
        </NavLink>
      </div>

      <div className="col-start-2 row-start-1 flex min-w-0 max-w-full flex-col items-end justify-self-end md:col-start-3">
        <GradientText
          colors={GRADIENT_COLORS}
          animationSpeed={6}
          showBorder={false}
          className="hidden sm:inline-flex font-body text-[10px] font-semibold uppercase tracking-wider"
        >
          Segunda Temporada
        </GradientText>
        <NavLink
          to={session ? '/player' : '/login'}
          className="flex min-h-11 min-w-0 max-w-full items-center gap-1.5 px-1 py-1 font-body text-xs sm:text-sm transition-transform duration-300 ease-out hover:scale-[1.04]"
        >
          <Sparkles
            size={16}
            strokeWidth={1.75}
            className="hidden shrink-0 sm:inline-block"
            style={{ stroke: 'url(#player-icon-gradient)' }}
          />
          <GradientText colors={GRADIENT_COLORS} animationSpeed={6} showBorder={false} className="font-body min-w-0 max-w-full break-words text-right">
            {welcomeName ?? 'Área do Player'}
          </GradientText>
        </NavLink>
      </div>
    </nav>
  )
}
