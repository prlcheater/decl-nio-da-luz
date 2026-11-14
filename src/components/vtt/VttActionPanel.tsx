import { useState } from 'react'
import { abilityEffects, isAbilityReady } from '@/lib/abilityDefinition'
import { energyCost, isAbilityAvailable, type AbilityTier } from '@/lib/diceEngine'
import type { AbilityRow, CooldownRow, Target } from '@/lib/combatTypes'

function AbilityRowButton({ ability, cost, busy, onUse }: { ability: AbilityRow; cost: number; busy: boolean; onUse: (ability: AbilityRow, pontoVital: boolean) => void }) {
  const [pv, setPv] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <button disabled={busy} onClick={() => onUse(ability, pv)} className="flex min-h-11 flex-1 items-center justify-between gap-3 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-left font-body text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50">
        <span>{ability.abilities.name}</span>
        <span className="text-xs text-neutral-500">{cost} PE</span>
      </button>
      <label title="Ponto vital" className="flex items-center gap-1 font-body text-[11px] text-neutral-500">
        <input type="checkbox" checked={pv} onChange={(e) => setPv(e.target.checked)} /> PV
      </label>
    </div>
  )
}

export default function VttActionPanel({ target, actorLabel, abilities, epCurrent, epMax, cooldowns, currentRound, busy, onUse, onClose }: {
  target: Target
  actorLabel: string
  abilities: AbilityRow[]
  epCurrent: number
  epMax: number
  cooldowns: CooldownRow[]
  currentRound: number
  busy: boolean
  onUse: (ability: AbilityRow, pontoVital: boolean) => void
  onClose: () => void
}) {
  const hostileTarget = target.side === 'inimigo'
  const ready = abilities.filter((a) => isAbilityReady(a.abilities))
  const usable = ready.filter((a) => {
    const tier = a.abilities.type as AbilityTier
    if (energyCost(tier, epMax) > epCurrent) return false
    const cd = cooldowns.find((c) => c.ability_id === a.ability_id)
    if (!isAbilityAvailable({ tier, lastUsedRound: cd ? cd.last_used_round : null, currentRound })) return false
    const effects = abilityEffects(a.abilities)
    return hostileTarget ? effects.some((e) => e.target === 'enemy') : effects.some((e) => e.target === 'ally' || e.target === 'self')
  })

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[62%] overflow-y-auto rounded-t-xl border-t border-neutral-700 bg-neutral-950/95 p-3 backdrop-blur sm:inset-x-auto sm:bottom-3 sm:right-3 sm:w-80 sm:rounded-xl sm:border">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wide text-neutral-400">{hostileTarget ? 'Atacar' : 'Apoiar'} {target.label}</p>
        <button onClick={onClose} className="font-body text-xs text-neutral-500 hover:text-white">Fechar</button>
      </div>
      {usable.length === 0 ? (
        <p className="mt-3 font-body text-sm text-neutral-500">Nenhuma habilidade disponivel para {target.label}.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {usable.map((a) => (
            <AbilityRowButton key={a.ability_id} ability={a} cost={energyCost(a.abilities.type as AbilityTier, epMax)} busy={busy} onUse={onUse} />
          ))}
        </div>
      )}
      <p className="mt-2 font-body text-xs text-neutral-600">{usable.length} de {ready.length} prontas · {actorLabel}</p>
    </div>
  )
}