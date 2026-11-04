import type { ReactNode } from 'react'
import BorderGlow from '@/components/BorderGlow'
import { GRADIENT_COLORS } from '@/lib/gameData'

type GlowCardProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export default function GlowCard({ children, className = '', contentClassName = 'p-4' }: GlowCardProps) {
  return (
    <BorderGlow
      backgroundColor="#121016"
      borderRadius={14}
      glowRadius={26}
      glowColor="271 60 72"
      coneSpread={25}
      edgeSensitivity={30}
      colors={GRADIENT_COLORS}
      className={`h-full transition-transform duration-300 ease-out hover:-translate-y-1 ${className}`}
    >
      <div className={contentClassName}>{children}</div>
    </BorderGlow>
  )
}
