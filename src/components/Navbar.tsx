import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, BookOpen, BookText, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import GradientText from '@/components/GradientText'
import { GRADIENT_COLORS } from '@/lib/gameData'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-2 font-body text-sm tracking-wide transition-colors duration-300 ${
    isActive ? 'text-white' : 'text-neutral-400 hover:text-white'
  }`

// Entra em fade depois que o título da página já está bem avançado na sua animação (~2.2s).
const MENU_REVEAL_MS = 2200

export default function Navbar() {
  const { session, profile, loading } = useAuth()
  const [visible, setVisible] = useState(false)
  const welcomeName = !loading && session && profile ? profile.username : null

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), MENU_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <nav
      className="sticky top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-4 px-2 sm:px-6 py-4 border-b border-neutral-800/60 bg-base/70 backdrop-blur-md"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1)' }}
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

      <div className="flex items-center gap-0.5 sm:gap-1 justify-self-center">
        <NavLink to="/" end className={linkClass}>
          <Home size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Home</span>
        </NavLink>
        <NavLink to="/codex" className={linkClass}>
          <BookOpen size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Codex</span>
        </NavLink>
        <NavLink to="/livro" className={linkClass}>
          <BookText size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Livro</span>
        </NavLink>
      </div>

      <div className="justify-self-end flex flex-col items-end">
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
          className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap px-1 sm:px-3 py-1 font-body text-xs sm:text-sm transition-transform duration-300 ease-out hover:scale-[1.04]"
        >
          <Sparkles
            size={16}
            strokeWidth={1.75}
            className="hidden shrink-0 sm:inline-block"
            style={{ stroke: 'url(#player-icon-gradient)' }}
          />
          <GradientText colors={GRADIENT_COLORS} animationSpeed={6} showBorder={false} className="font-body">
            {welcomeName ?? 'Área do Player'}
          </GradientText>
        </NavLink>
      </div>
    </nav>
  )
}
