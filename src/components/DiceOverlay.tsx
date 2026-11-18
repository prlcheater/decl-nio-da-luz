import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import CountUp from '@/components/CountUp'
import TextType from '@/components/TextType'
import { subscribeLocalRolls, subscribeRemoteRolls, type RollRecord } from '@/lib/diceFeed'
import { DIFFICULTIES } from '@/lib/diceEngine'

// Animacao do numero (CountUp) e tempo que o resultado fica na tela depois dela.
const ANIM_S = 1.3
const HOLD_MS = 3000

// Fica montado no App: mostra o resultado de quem rola na mesa (inclusive o mestre).
export function DiceFeedHost() {
  const [roll, setRoll] = useState<RollRecord | null>(null)
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    function show(r: RollRecord) {
      if (!r || seen.current.has(r.id)) return
      seen.current.add(r.id)
      if (seen.current.size > 80) seen.current = new Set([r.id])
      setRoll(r)
    }
    const offLocal = subscribeLocalRolls(show)
    const offRemote = subscribeRemoteRolls(show)
    return () => { offLocal(); offRemote() }
  }, [])

  useEffect(() => {
    if (!roll) return
    const timer = setTimeout(() => setRoll(null), ANIM_S * 1000 + HOLD_MS)
    return () => clearTimeout(timer)
  }, [roll])

  if (!roll) return null
  const diff = roll.difficulty ? DIFFICULTIES.find((d) => d.id === roll.difficulty) : null
  const color = roll.falha_critica ? '#dc2626' : roll.critico ? '#eab308' : '#f5f5f5'

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="flex flex-col items-center rounded-2xl bg-black/55 px-10 py-6 shadow-2xl ring-1 ring-white/10"
      >
        <p className="font-body text-xs uppercase tracking-[0.25em] text-neutral-300">
          {(roll.character_name ?? roll.username)}{diff ? ' · ' + diff.label : ''}
        </p>
        <div style={{ color }} className="font-title text-[96px] font-bold leading-none drop-shadow-[0_0_24px_rgba(0,0,0,0.85)]">
          <CountUp from={0} to={roll.total} duration={ANIM_S} />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <TextType text={[roll.label]} typingSpeed={22} showCursor={false} loop={false} className="font-body text-sm uppercase tracking-wide text-neutral-300" />
          {roll.critico && <span className="rounded border border-amber-400/70 px-1.5 py-0.5 font-body text-[12px] text-amber-300">Sucesso Crítico!</span>}
          {roll.falha_critica && <span className="rounded border border-red-500/70 px-1.5 py-0.5 font-body text-[12px] text-red-300">Falha Crítica!</span>}
        </div>
        {roll.rolls.length > 0 && (
          <p className="mt-2 font-body text-xs text-neutral-400">
            dados: [{roll.rolls.join(', ')}]{roll.modifier !== 0 ? ' · mod ' + (roll.modifier > 0 ? '+' : '') + roll.modifier : ''}
          </p>
        )}
      </motion.div>
    </div>
  )
}