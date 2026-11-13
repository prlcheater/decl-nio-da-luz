import { useId } from 'react'
import { Sparkles } from 'lucide-react'
import BorderGlow from '@/components/BorderGlow'
import GradientText from '@/components/GradientText'
import { APP_LABEL } from '@/lib/appVersion'

// Card azul animado que informa a versão do app web (Beta). Gradiente do azul
// profundo ao azul claro, no mesmo estilo animado do resto do site.
const BLUE_GRADIENT = ['#1e3a8a', '#2563eb', '#38bdf8', '#7dd3fc']

export default function VersionBadge({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  // Id único por instância (o badge aparece em mais de um lugar).
  const gradientId = `version-badge-gradient-${useId().replace(/:/g, '')}`

  return (
    <BorderGlow
      backgroundColor="#0b1220"
      borderRadius={14}
      glowRadius={compact ? 18 : 26}
      glowColor="212 85 62"
      coneSpread={25}
      edgeSensitivity={30}
      colors={BLUE_GRADIENT}
      className={className}
    >
      <div className={compact ? 'flex items-center gap-1.5 px-3 py-1.5' : 'flex flex-col items-center gap-1 px-5 py-4 text-center'}>
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={BLUE_GRADIENT[0]} />
              <stop offset="55%" stopColor={BLUE_GRADIENT[2]} />
              <stop offset="100%" stopColor={BLUE_GRADIENT[3]} />
            </linearGradient>
          </defs>
        </svg>
        <span className="flex items-center gap-1.5">
          <Sparkles size={compact ? 13 : 16} strokeWidth={1.75} style={{ stroke: `url(#${gradientId})` }} />
          <GradientText
            colors={BLUE_GRADIENT}
            animationSpeed={5}
            showBorder={false}
            className="font-title text-xs font-semibold uppercase tracking-wider"
          >
            {APP_LABEL}
          </GradientText>
        </span>
        {!compact && <p className="font-body text-xs text-sky-200/80">Versão do app web</p>}
      </div>
    </BorderGlow>
  )
}
