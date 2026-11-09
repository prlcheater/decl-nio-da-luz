import { ACTIVE_REACTIONS, predictReaction, type ReactionId } from '@/lib/reactions'
import { abilityEffects, abilitySummary, abilityTargeting, isAbilityReady, ATTRIBUTES, type AbilityDefinition, type Attribute } from '@/lib/abilityDefinition'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Square, Swords, UserRound, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import BlurText from '@/components/BlurText'
import TextType from '@/components/TextType'
import CountUp from '@/components/CountUp'
import {
  DIFFICULTIES,
  ENEMY_TIER_CONFIG,
  calculateEpMax,
  calculateHpMax,
  damageSeverity,
  energyCost,
  isAbilityAvailable,
  roundsUntilAvailable,
  resolveTest,
  rollInitiative,
  type AbilityTier,
  type DamageSeverity,
  type DifficultyId,
  type EnemyTier,
  type TestResult,
  type TipoEfeito,
} from '@/lib/diceEngine'

const inputClass =
  'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-body text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none'

const TRAITS: { key: 'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma'; label: string }[] = [
  { key: 'attack', label: 'Ataque' },
  { key: 'resistance', label: 'Resistência' },
  { key: 'agility', label: 'Agilidade' },
  { key: 'intellect', label: 'Intelecto' },
  { key: 'charisma', label: 'Carisma' },
]

const TIER_META: Record<AbilityTier, { label: string; color: string }> = {
  comum: { label: 'Comum', color: '#9ca3af' },
  especial: { label: 'Especial', color: '#818cf8' },
  suprema: { label: 'Suprema', color: '#f472b6' },
}

const FLOAT_KEYFRAMES = ['combat-float-a', 'combat-float-b', 'combat-float-c']

type BattleRow = {
  id: string
  name: string | null
  status: 'setup' | 'active' | 'ended'
  round_number: number
  current_turn_index: number
  execution_test?: boolean
}

type EffectRow = {
  id: string
  target_participant_id: string
  kind: 'buff' | 'debuff' | 'barreira' | 'marca'
  attribute: Attribute | ''
  amount: number
  remaining_turns: number | null
  element: string | null
  label: string | null
  source_participant_id: string | null
  updated_at: string
}

type ReactionInfo = { name: ReactionId; consumed: string; element: string; secondary: ActionEffect[] }

type ActionEffect = {
  kind: 'dano' | 'cura' | 'escudo' | 'buff' | 'debuff'
  target: string
  target_name: string
  raw?: number
  mitigation?: number
  absorbed?: number
  hp_loss?: number
  healed?: number
  barrier?: number
  attribute?: Attribute
  amount?: number
  duration?: number
  hp_max?: number
  mark?: string
  mark_turns?: number
  reaction?: ReactionInfo
}

type ActionResult = {
  action_id: string
  actor: string
  actor_name: string
  ability_name: string
  cost: number
  critico: boolean
  ponto_vital: boolean
  execution: { roll: number; intellect: number; total: number; dc: number; success: boolean } | null
  effects: ActionEffect[]
}

type ActionRow = { id: string; kind: 'ability' | 'turn'; round_number: number; created_at: string; result: ActionResult & { ended?: string; expired?: { kind: string; attribute: string; element?: string | null; label?: string | null }[] } }

type ParticipantRow = {
  id: string
  battle_session_id: string
  character_id: string | null
  enemy_instance_id: string | null
  name: string
  side: 'aliado' | 'inimigo'
  initiative_total: number
}

type CharacterData = {
  id: string
  user_id: string | null
  name: string
  portrait_url: string | null
  level: number
  hp_current: number
  ep_current: number
  attack: number
  resistance: number
  agility: number
  intellect: number
  charisma: number
}

type EnemyDef = {
  name: string
  portrait_url: string | null
  tier: EnemyTier
  level: number
  attack: number
  resistance: number
  agility: number
  intellect: number
  charisma: number
}

type EnemyInstanceData = {
  id: string
  enemy_id: string
  status: 'active' | 'defeated'
  hp_current: number
  ep_current: number
  enemies: EnemyDef
}

type AbilityRow = {
  ability_id: string
  level: number
  abilities: { name: string; description: string | null; type: AbilityTier; tipo_efeito: TipoEfeito; definition?: AbilityDefinition | null; combat_enabled?: boolean | null }
}

type CooldownRow = { ability_id: string; last_used_round: number }

type Target = {
  participantId: string
  label: string
  side: 'aliado' | 'inimigo'
  kind: 'character' | 'enemy'
  refId: string
  portraitUrl: string | null
  hpCurrent: number
  hpMax: number
  resistance: number
  marks: { element: string; sourceSide: 'aliado' | 'inimigo' | null }[]
}

type DamageToast = {
  id: string
  kind: 'damage'
  actorLabel: string
  targetLabel: string
  targetParticipantId: string
  abilityName: string
  amount: number
  severity: DamageSeverity
  color: string
  critico: boolean
  reaction?: string
}

type RollToast = {
  id: string
  kind: 'roll'
  actorLabel: string
  traitLabel: string
  total: number
  critico: boolean
  falhaCritica: boolean
}

type CombatToast = DamageToast | RollToast

// Omit não distribui sobre union por padrão (keyof de um union vira interseção das
// chaves) — sem isso, o literal de RollToast/DamageToast perde a checagem de campo.
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

// Explica o cálculo devolvido pelo servidor: bruto → mitigação → barreira → PV.
function describeEffect(e: ActionEffect): string {
  const base = describeEffectCore(e)
  if (e.reaction) {
    const r = ACTIVE_REACTIONS[e.reaction.name]
    const extra = e.reaction.secondary.length ? ` (${e.reaction.secondary.map(describeEffectCore).join('; ')})` : ''
    return `${base} — ${r.name}! ${e.reaction.consumed} + ${e.reaction.element}: ${r.effect}${extra}`
  }
  if (e.mark) return `${base} · marca ${e.mark} por ${e.mark_turns} turno(s)`
  return base
}

function describeEffectCore(e: ActionEffect): string {
  switch (e.kind) {
    case 'dano':
      return `${e.target_name}: ${e.raw} bruto − ${e.mitigation} mitigação${e.absorbed ? ` − ${e.absorbed} barreira` : ''} = ${e.hp_loss} de PV perdido`
    case 'cura':
      return `${e.target_name}: +${e.healed} PV${e.raw !== e.healed ? ` (rolou ${e.raw}, limitado ao máximo)` : ''}`
    case 'escudo':
      return `${e.target_name}: barreira ${e.barrier}${e.raw !== e.barrier ? ` (rolou ${e.raw}; ficou a maior)` : ''}`
    case 'buff':
    case 'debuff':
      return `${e.target_name}: ${e.kind === 'buff' ? '+' : '−'}${e.amount} ${e.attribute ? ATTRIBUTES[e.attribute] : ''} por ${e.duration} turno(s)`
  }
}

function describeAction(r: ActionResult): string {
  const head = `${r.ability_name} (${r.actor_name}, ${r.cost} PE)`
  if (r.execution && !r.execution.success) {
    return `${head}: falhou no teste de execução — ${r.execution.roll} + ${r.execution.intellect} Intelecto = ${r.execution.total} < ${r.execution.dc}. Nenhum efeito aplicado.`
  }
  const exec = r.execution ? ` Execução ${r.execution.total} ≥ ${r.execution.dc}.` : ''
  const flags = [r.critico && 'Crítico!', r.ponto_vital && 'Ponto vital'].filter(Boolean).join(' · ')
  return `${head}${flags ? ' — ' + flags : ''}.${exec} ${r.effects.map(describeEffect).join(' · ')}`
}

function toastFromAction(r: ActionResult): DistributiveOmit<CombatToast, 'id'> {
  if (r.execution && !r.execution.success) {
    return { kind: 'roll', actorLabel: r.actor_name, traitLabel: `Execução falhou · ${r.ability_name}`, total: r.execution.total, critico: false, falhaCritica: true }
  }
  const main = r.effects[0]
  const reaction = r.effects.find((e) => e.reaction)?.reaction
  const base = { kind: 'damage' as const, actorLabel: r.actor_name, targetLabel: main?.target_name ?? '', targetParticipantId: main?.target ?? '', abilityName: r.ability_name, critico: r.critico, reaction: reaction ? ACTIVE_REACTIONS[reaction.name].name : undefined }
  if (!main) return { ...base, amount: 0, severity: 'branco', color: '#f5f5f5' }
  if (main.kind === 'dano') {
    const sev = damageSeverity({ amount: main.hp_loss ?? 0, hpMax: main.hp_max ?? 0 })
    return { ...base, amount: main.hp_loss ?? 0, severity: sev.tier, color: sev.color }
  }
  const color = main.kind === 'cura' ? '#22c55e' : main.kind === 'escudo' ? '#60a5fa' : main.kind === 'buff' ? '#a78bfa' : '#f97316'
  const amount = main.kind === 'cura' ? main.healed ?? 0 : main.kind === 'escudo' ? main.barrier ?? 0 : main.amount ?? 0
  return { ...base, amount, severity: 'branco', color }
}

// Mesma ordem do servidor (combat_current_participant): iniciativa desc, nome por código e id.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
function sortParticipants(rows: ParticipantRow[]): ParticipantRow[] {
  return [...rows].sort((a, b) => b.initiative_total - a.initiative_total || cmp(a.name, b.name) || cmp(a.id, b.id))
}

function hashUnit(seed: string, salt: number): number {
  let h = salt
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-body text-[10px] uppercase tracking-wide"
      style={{ borderColor: color, color }}
    >
      {label}
    </span>
  )
}

function Portrait({ url, size, fallbackSize }: { url: string | null; size: number; fallbackSize: number }) {
  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex items-center justify-center text-neutral-600" style={{ width: size, height: size }}>
      <UserRound size={fallbackSize} strokeWidth={1.25} />
    </div>
  )
}

function FloatingParticipants({ items }: { items: Target[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {items.map((it) => {
        const top = 8 + hashUnit(it.participantId, 1) * 72
        const left = 4 + hashUnit(it.participantId, 2) * 88
        const duration = 10 + hashUnit(it.participantId, 3) * 10
        const delay = -hashUnit(it.participantId, 4) * duration
        const size = 60 + Math.round(hashUnit(it.participantId, 5) * 26)
        const keyframe = FLOAT_KEYFRAMES[Math.floor(hashUnit(it.participantId, 6) * FLOAT_KEYFRAMES.length)]
        const pct = it.hpMax > 0 ? Math.max(0, Math.min(1, it.hpCurrent / it.hpMax)) : 0
        return (
          <div
            key={it.participantId}
            className="absolute flex flex-col items-center gap-1.5"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              filter: 'blur(5px)',
              animationName: keyframe,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          >
            <div className="overflow-hidden rounded-full border border-neutral-700 bg-neutral-900" style={{ width: size, height: size }}>
              <Portrait url={it.portraitUrl} size={size} fallbackSize={size * 0.5} />
            </div>
            <div className="h-1 w-14 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-red-500" style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FocusPortrait({ label, portraitUrl, hpCurrent, hpMax }: { label: string; portraitUrl: string | null; hpCurrent: number; hpMax: number }) {
  const pct = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0
  return (
    <div className="flex w-24 min-w-0 flex-col items-center gap-2">
      <p className="text-center text-sm text-neutral-200">{label}</p>
      <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-neutral-600 bg-neutral-900" title={label} aria-label={label}>
        <Portrait url={portraitUrl} size={80} fallbackSize={32} />
      </div>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

const SIDE_GLOW: Record<'aliado' | 'inimigo', string> = {
  aliado: '0 0 10px 2px rgba(59,130,246,0.6), 0 0 20px 8px rgba(139,92,246,0.34)',
  inimigo: '0 0 10px 2px rgba(220,38,38,0.6), 0 0 20px 8px rgba(220,38,38,0.3)',
}

// Atributo efetivo = base + buffs − debuffs (mínimo 0). Base nunca é sobrescrita. Espelha combat_effective_attr.
function effectiveTraits(base: Traits, participantId: string | undefined, effects: EffectRow[]): Traits {
  const out = { ...base }
  for (const e of effects) {
    if (e.target_participant_id !== participantId || !e.attribute) continue
    out[e.attribute] = Math.max(0, out[e.attribute] + (e.kind === 'buff' ? e.amount : -e.amount))
  }
  return out
}

function EffectChips({ list }: { list: EffectRow[] }) {
  if (!list.length) return null
  return (
    <ul className="mt-1 flex flex-wrap gap-1" aria-label="Estados ativos">
      {list.map((e) => (
        <li key={e.id} title={e.kind === 'marca' ? `Marca ${e.element} — pode reagir com outro elemento da mesma equipe` : undefined}
          className={'rounded border px-1.5 py-0.5 text-[11px] ' + (e.kind === 'marca' ? 'border-cyan-400/60 text-cyan-200' : e.kind === 'barreira' ? 'border-sky-400/60 text-sky-200' : e.kind === 'buff' ? 'border-violet-400/60 text-violet-200' : 'border-orange-400/60 text-orange-200')}>
          {e.kind === 'marca'
            ? `◎ ${e.element} · ${e.remaining_turns}t`
            : e.kind === 'barreira'
              ? `◆ Barreira ${e.amount}`
              : `${e.kind === 'buff' ? '▲' : '▼'} ${e.label ? e.label + ': ' : ''}${e.attribute ? ATTRIBUTES[e.attribute] : ''} ${e.kind === 'buff' ? '+' : '−'}${e.amount} · ${e.remaining_turns}t`}
        </li>
      ))}
    </ul>
  )
}

function InitiativeSidebar({ sorted, currentIndex, targets, effects }: { sorted: ParticipantRow[]; currentIndex: number; targets: Target[]; effects: EffectRow[] }) {
  return (
    <section aria-label="Ordem de iniciativa" className="relative z-10 my-5">
      <h2 className="mb-3 text-sm uppercase tracking-wide text-neutral-300">Ordem de iniciativa</h2>
      <ol className="grid gap-2 min-[400px]:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p, i) => {
          const target = targets.find((t) => t.participantId === p.id)
          const current = i === currentIndex % sorted.length
          return (
            <li key={p.id} aria-current={current ? "step" : undefined}
              className={"flex min-w-0 items-center gap-3 rounded-xl border p-3 " + (current ? "border-violet-300 bg-violet-950/80" : "border-neutral-700 bg-neutral-950/90")}>
              <span className="shrink-0 text-sm tabular-nums text-neutral-400">{i + 1}</span>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full"><Portrait url={target?.portraitUrl ?? null} size={40} fallbackSize={18} /></div>
              <div className="min-w-0">
                <p className="text-sm text-neutral-100">{p.name}</p>
                <p className="text-xs text-neutral-300">{current ? "Turno atual · " : ""}{p.side === "aliado" ? "Aliado" : "Inimigo"}</p>
                {target && <p className="text-xs tabular-nums text-neutral-300">PV {target.hpCurrent} / {target.hpMax}</p>}
                <EffectChips list={effects.filter((e) => e.target_participant_id === p.id)} />
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
function CombatToastLayer({ toasts }: { toasts: CombatToast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-5 sm:bottom-24">
      {toasts.map((t) =>
        t.kind === 'damage' ? (
          <div key={t.id} className="combat-toast flex flex-col items-center gap-2">
            <span style={{ color: t.color }}>
              <CountUp from={0} to={t.amount} duration={2.5} className="font-title text-[50px] font-bold" />
            </span>
            <TextType
              key={t.id}
              text={[`${t.abilityName} · ${t.actorLabel} → ${t.targetLabel}`]}
              typingSpeed={25}
              showCursor={false}
              loop={false}
              className="font-body text-sm uppercase tracking-wide text-neutral-300"
            />
            {t.critico && <Badge label="Crítico!" color="#eab308" />}
            {t.reaction && <Badge label={t.reaction + '!'} color="#22d3ee" />}
          </div>
        ) : (
          <div key={t.id} className="combat-toast flex flex-col items-center gap-2">
            <span style={{ color: t.critico ? '#eab308' : t.falhaCritica ? '#dc2626' : '#f5f5f5' }}>
              <CountUp from={0} to={t.total} duration={2.5} className="font-title text-[50px] font-bold" />
            </span>
            <TextType
              key={t.id}
              text={[`${t.traitLabel} · ${t.actorLabel}`]}
              typingSpeed={25}
              showCursor={false}
              loop={false}
              className="font-body text-sm uppercase tracking-wide text-neutral-300"
            />
            {t.critico && <Badge label="Sucesso Crítico!" color="#eab308" />}
            {t.falhaCritica && <Badge label="Falha Crítica!" color="#dc2626" />}
          </div>
        )
      )}
    </div>
  )
}

type RosterEntry = { id: string; name: string; level: number; portrait_url: string | null }

function RosterColumn({
  label,
  side,
  entries,
  selected,
  onToggle,
}: {
  label: string
  side: 'aliado' | 'inimigo'
  entries: RosterEntry[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-body text-sm uppercase tracking-wide text-neutral-500">{label}</p>
      {entries.length === 0 && <p className="font-body text-sm text-neutral-700">Nenhum cadastrado ainda.</p>}
      {entries.map((entry) => {
        const isSelected = selected.includes(entry.id)
        return (
          <button key={entry.id} onClick={() => onToggle(entry.id)} className="flex flex-col items-center gap-2">
            <div
              className={`h-12 w-12 overflow-hidden rounded-full border bg-neutral-900 transition-all duration-300 ${
                isSelected ? 'border-white' : 'border-neutral-700 opacity-40'
              }`}
              style={{ boxShadow: isSelected ? SIDE_GLOW[side] : undefined }}
            >
              <Portrait url={entry.portrait_url} size={48} fallbackSize={20} />
            </div>
            <span className="font-body text-sm text-neutral-300">
              {entry.name} <span className="text-neutral-600">Nv. {entry.level}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SetupForm({ onStart, starting }: { onStart: (characterIds: string[], enemyTemplateIds: string[]) => void; starting: boolean }) {
  const [characters, setCharacters] = useState<RosterEntry[]>([])
  const [enemyTemplates, setEnemyTemplates] = useState<RosterEntry[]>([])
  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [enemyCounts, setEnemyCounts] = useState<Record<string, number>>({})
  const selectedEnemies = Object.entries(enemyCounts).flatMap(([id, count]) => Array.from({ length: count }, () => id))

  useEffect(() => {
    supabase
      .from('characters')
      .select('id, name, level, portrait_url')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => setCharacters((data as RosterEntry[]) ?? []))
    supabase
      .from('enemies')
      .select('id, name, level, portrait_url')
      .order('name')
      .then(({ data }) => setEnemyTemplates((data as RosterEntry[]) ?? []))
  }, [])

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  return (
    <GlowCard contentClassName="p-6">
      <p className="font-body text-sm text-neutral-400">Escolha os aliados e a quantidade de cada inimigo. Cada cópia terá seus próprios PV e PE.</p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <RosterColumn
          label="Elementalistas"
          side="aliado"
          entries={characters}
          selected={selectedChars}
          onToggle={(id) => toggle(selectedChars, id, setSelectedChars)}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm uppercase tracking-wide text-neutral-400">Inimigos</p>
          {enemyTemplates.length === 0 && <p className="text-sm text-neutral-400">Nenhum inimigo cadastrado.</p>}
          {enemyTemplates.map((enemy) => (
            <div key={enemy.id} className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full"><Portrait url={enemy.portrait_url} size={48} fallbackSize={20} /></div>
                <p className="min-w-0 text-sm text-neutral-100">{enemy.name}<span className="block text-neutral-400">Nível {enemy.level}</span></p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button aria-label={"Remover uma cópia de " + enemy.name} disabled={starting || !enemyCounts[enemy.id]}
                  onClick={() => setEnemyCounts((prev) => ({ ...prev, [enemy.id]: Math.max(0, (prev[enemy.id] ?? 0) - 1) }))}
                  className="rounded-lg border border-neutral-600 text-xl disabled:opacity-40">−</button>
                <output aria-label={"Quantidade de " + enemy.name} className="min-w-10 text-center text-lg tabular-nums">{enemyCounts[enemy.id] ?? 0}</output>
                <button aria-label={"Adicionar uma cópia de " + enemy.name} disabled={starting || (enemyCounts[enemy.id] ?? 0) >= 20}
                  onClick={() => setEnemyCounts((prev) => ({ ...prev, [enemy.id]: Math.min(20, (prev[enemy.id] ?? 0) + 1) }))}
                  className="rounded-lg border border-neutral-600 text-xl disabled:opacity-40">+</button>
                <span className="text-sm text-neutral-400">Até 20 cópias</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => onStart(selectedChars, selectedEnemies)}
        disabled={starting || selectedChars.length + selectedEnemies.length === 0}
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded bg-white px-4 py-3 font-body text-sm font-semibold text-neutral-950 disabled:opacity-40"
      >
        <Swords size={16} strokeWidth={2} /> {starting ? 'Preparando combate…' : 'Iniciar Combate'}
      </button>
    </GlowCard>
  )
}

type Traits = Record<'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma', number>

function TestPanel({ actor, onRoll }: { actor: Traits; onRoll: (traitLabel: string, result: TestResult) => void }) {
  const [trait, setTrait] = useState<(typeof TRAITS)[number]['key']>('agility')
  const [difficulty, setDifficulty] = useState<DifficultyId>('regular')

  function roll() {
    const result = resolveTest({ status: actor[trait], difficulty })
    const traitLabel = TRAITS.find((t) => t.key === trait)?.label ?? trait
    onRoll(traitLabel, result)
  }

  return (
    <div>
      <p className="font-body text-sm uppercase tracking-wide text-neutral-500">Testar Traço</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select value={trait} onChange={(e) => setTrait(e.target.value as typeof trait)} className={`${inputClass} w-auto py-2 text-sm`}>
          {TRAITS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as DifficultyId)} className={`${inputClass} w-auto py-2 text-sm`}>
          {DIFFICULTIES.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <button onClick={roll} className="rounded bg-white px-4 py-2 font-body text-sm font-semibold text-neutral-950">Rolar</button>
      </div>
    </div>
  )
}

function AbilityUseRow({
  ability,
  epCurrent,
  epMax,
  cooldownRow,
  currentRound,
  allies,
  targetMarks,
  actorId,
  busy,
  onUse,
}: {
  ability: AbilityRow
  epCurrent: number
  epMax: number
  cooldownRow: CooldownRow | null
  currentRound: number
  allies: Target[]
  targetMarks: string[]
  actorId: string
  busy: boolean
  onUse: (pontoVital: boolean, allyId: string | null) => void
}) {
  const tier = ability.abilities.type
  const cost = energyCost(tier, epMax)
  const available = isAbilityAvailable({ tier, lastUsedRound: cooldownRow?.last_used_round ?? null, currentRound })
  const remaining = roundsUntilAvailable({ tier, lastUsedRound: cooldownRow?.last_used_round ?? null, currentRound })
  const [pontoVital, setPontoVital] = useState(false)
  const [allyId, setAllyId] = useState(actorId)
  const { allySupport } = abilityTargeting(ability.abilities)
  const hasDamage = abilityEffects(ability.abilities).some((e) => e.kind === 'dano')
  // Prévia (não é garantia): o servidor reconfere marcas e escolhe a mais antiga elegível.
  const reactionPreview = ability.abilities.definition
    ? [...new Set(ability.abilities.definition.effects.map((e) => predictReaction(e, targetMarks)).filter((x): x is ReactionId => !!x))]
    : []

  const disabled = busy || !available || epCurrent < cost

  return (
    <div className="rounded border border-neutral-800 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body text-base text-neutral-100">{ability.abilities.name}</p>
        <Badge label={TIER_META[tier].label} color={TIER_META[tier].color} />
      </div>
      <p className="mt-1.5 text-sm text-neutral-400">{abilitySummary(ability.abilities)}</p>
      {reactionPreview.map((id) => <p key={id} className="mt-1.5 text-sm text-cyan-200">Reação prevista: {ACTIVE_REACTIONS[id].name} — {ACTIVE_REACTIONS[id].effect}</p>)}
      {!available && <p className="mt-1.5 font-body text-sm text-red-400">Em recarga — faltam {remaining} rodada(s).</p>}
      {available && epCurrent < cost && <p className="mt-1.5 font-body text-sm text-red-400">Energia insuficiente — faltam {cost - epCurrent} PE.</p>}
      {allySupport && (
        <label className="mt-3 block text-sm text-neutral-300">
          Efeitos de apoio em
          <select value={allyId} onChange={(e) => setAllyId(e.target.value)} className={inputClass + ' mt-1'}>
            {allies.map((t) => <option key={t.participantId} value={t.participantId}>{t.participantId === actorId ? t.label + ' (você)' : t.label}</option>)}
          </select>
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {hasDamage && (
          <label className="flex items-center gap-1.5 font-body text-sm text-neutral-500">
            <input type="checkbox" checked={pontoVital} onChange={(e) => setPontoVital(e.target.checked)} /> Ponto vital
          </label>
        )}
        <button
          onClick={() => onUse(hasDamage && pontoVital, allySupport ? allyId : null)}
          disabled={disabled}
          className="rounded bg-white px-4 py-2 font-body text-sm font-semibold text-neutral-950 disabled:opacity-40"
        >
          {busy ? 'Resolvendo…' : `Usar (${cost} PE)`}
        </button>
      </div>
    </div>
  )
}

type ActionMenuStep = 'menu' | 'test' | 'target'

const menuButtonClass =
  'flex-1 rounded border border-neutral-700 px-4 py-4 font-body text-base text-neutral-200 transition-colors duration-300 hover:border-neutral-500 hover:text-white'
const backButtonClass = 'mb-4 font-body text-sm text-neutral-500 transition-colors duration-300 hover:text-white'

function TargetGrid({ targets, onSelect }: { targets: Target[]; onSelect: (t: Target) => void }) {
  const columns: { label: string; side: 'aliado' | 'inimigo'; list: Target[] }[] = [
    { label: 'Elementalistas', side: 'aliado', list: targets.filter((t) => t.side === 'aliado') },
    { label: 'Inimigos', side: 'inimigo', list: targets.filter((t) => t.side === 'inimigo') },
  ]
  return (
    <div className="grid grid-cols-2 gap-6">
      {columns.map((col) => (
        <div key={col.label} className="flex flex-col items-center gap-4">
          <p className="font-body text-sm uppercase tracking-wide text-neutral-500">{col.label}</p>
          {col.list.length === 0 && <p className="font-body text-sm text-neutral-700">—</p>}
          {col.list.map((t) => (
            <button key={t.participantId} onClick={() => onSelect(t)} className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 transition-transform duration-300 hover:scale-110">
                <Portrait url={t.portraitUrl} size={48} fallbackSize={20} />
              </div>
              <span className="font-body text-sm text-neutral-300">{t.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function AbilityPopup({
  target,
  abilities,
  epCurrent,
  epMax,
  cooldowns,
  currentRound,
  mySide,
  allies,
  actorId,
  busy,
  onUse,
  onClose,
}: {
  target: Target
  abilities: AbilityRow[]
  epCurrent: number
  epMax: number
  cooldowns: CooldownRow[]
  currentRound: number
  mySide: 'aliado' | 'inimigo'
  allies: Target[]
  actorId: string
  busy: boolean
  onUse: (ability: AbilityRow, pontoVital: boolean, allyId: string | null) => void
  onClose: () => void
}) {
  // Sem fogo amigo: habilidade com efeito hostil mira adversário; de apoio, aliado. O servidor revalida.
  const usable = abilities.filter((a) => isAbilityReady(a.abilities) && (abilityTargeting(a.abilities).hostile ? target.side !== mySide : target.side === mySide))
  const drafts = abilities.length - abilities.filter((a) => isAbilityReady(a.abilities)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-title font-semibold text-neutral-100">Habilidade em {target.label}</p>
          <button onClick={onClose} aria-label="Fechar" className="text-neutral-500 transition-colors duration-300 hover:text-white">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {usable.length === 0 ? (
          <p className="mt-4 font-body text-sm text-neutral-500">Você não tem habilidades disponíveis pra usar em {target.label}.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {usable.map((a) => (
              <AbilityUseRow
                key={a.ability_id}
                ability={a}
                epCurrent={epCurrent}
                epMax={epMax}
                cooldownRow={cooldowns.find((c) => c.ability_id === a.ability_id) ?? null}
                currentRound={currentRound}
                allies={allies}
                targetMarks={target.marks.filter((m) => m.sourceSide === mySide).map((m) => m.element)}
                actorId={actorId}
                busy={busy}
                onUse={(pontoVital, allyId) => {
                  onUse(a, pontoVital, allyId)
                  onClose()
                }}
              />
            ))}
          </div>
        )}
        {drafts > 0 && <p className="mt-4 text-xs text-neutral-500">{drafts} habilidade(s) em rascunho não aparecem aqui.</p>}
      </div>
    </div>
  )
}

function ActionMenu({
  actorTraits,
  abilities,
  epCurrent,
  epMax,
  cooldowns,
  currentRound,
  targets,
  mySide,
  actorId,
  busy,
  onUseAbility,
  onRoll,
}: {
  actorTraits: Traits
  abilities: AbilityRow[]
  epCurrent: number
  epMax: number
  cooldowns: CooldownRow[]
  currentRound: number
  targets: Target[]
  mySide: 'aliado' | 'inimigo'
  actorId: string
  busy: boolean
  onUseAbility: (ability: AbilityRow, targetId: string, pontoVital: boolean, allyId: string | null) => void
  onRoll: (traitLabel: string, result: TestResult) => void
}) {
  const [step, setStep] = useState<ActionMenuStep>('menu')
  const [popupTarget, setPopupTarget] = useState<Target | null>(null)

  if (step === 'test') {
    return (
      <div>
        <button onClick={() => setStep('menu')} className={backButtonClass}>← Voltar</button>
        <TestPanel actor={actorTraits} onRoll={onRoll} />
      </div>
    )
  }

  if (step === 'target') {
    return (
      <div>
        <button onClick={() => setStep('menu')} className={backButtonClass}>← Voltar</button>
        <TargetGrid targets={targets} onSelect={setPopupTarget} />
        {popupTarget && (
          <AbilityPopup
            target={popupTarget}
            abilities={abilities}
            epCurrent={epCurrent}
            epMax={epMax}
            cooldowns={cooldowns}
            currentRound={currentRound}
            mySide={mySide}
            allies={targets.filter((t) => t.side === mySide)}
            actorId={actorId}
            busy={busy}
            onUse={(ability, pontoVital, allyId) => onUseAbility(ability, popupTarget.participantId, pontoVital, allyId)}
            onClose={() => setPopupTarget(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button onClick={() => setStep('test')} className={menuButtonClass}>Testar Traço</button>
      <button onClick={() => setStep('target')} className={menuButtonClass}>Usar Habilidade</button>
    </div>
  )
}

export default function Combate() {
  const { session: authSession, isMestre, loading: authLoading } = useAuth()

  const [battle, setBattle] = useState<BattleRow | null | undefined>(undefined)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [charactersById, setCharactersById] = useState<Record<string, CharacterData>>({})
  const [instancesById, setInstancesById] = useState<Record<string, EnemyInstanceData>>({})
  const [actorAbilities, setActorAbilities] = useState<AbilityRow[]>([])
  const [actorEnemyAbilities, setActorEnemyAbilities] = useState<AbilityRow[]>([])
  const [actorCooldowns, setActorCooldowns] = useState<CooldownRow[]>([])
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [toasts, setToasts] = useState<CombatToast[]>([])
  const [effects, setEffects] = useState<EffectRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [acting, setActing] = useState(false)
  const actingRef = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  function pushToast(payload: DistributiveOmit<CombatToast, 'id'>) {
    const toast = { ...payload, id: `${Date.now()}-${Math.random()}` } as CombatToast
    setToasts((prev) => [...prev, toast])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 5500)
  }

  function broadcastToast(payload: DistributiveOmit<CombatToast, 'id'>) {
    channelRef.current?.send({ type: 'broadcast', event: 'combat-toast', payload })
  }

  async function load() {
    const { data: battleRow } = await supabase
      .from('battle_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setBattle((battleRow as BattleRow | null) ?? null)
    if (!battleRow) {
      setParticipants([])
      setCharactersById({})
      setInstancesById({})
      setActorAbilities([])
      setActorEnemyAbilities([])
      setActorCooldowns([])
      setEffects([])
      setActions([])
      return
    }

    const [{ data: effectRows }, { data: actionRows }] = await Promise.all([
      supabase.from('battle_effects').select('id, target_participant_id, kind, attribute, amount, remaining_turns, element, label, source_participant_id, updated_at').eq('battle_session_id', battleRow.id),
      supabase.from('battle_actions').select('id, kind, round_number, created_at, result').eq('battle_session_id', battleRow.id).order('created_at', { ascending: false }).limit(12),
    ])
    setEffects((effectRows as EffectRow[]) ?? [])
    setActions((actionRows as ActionRow[]) ?? [])

    const { data: participantRows } = await supabase
      .from('battle_participants')
      .select('id, battle_session_id, character_id, enemy_instance_id, name, side, initiative_total')
      .eq('battle_session_id', battleRow.id)

    const parts = (participantRows as ParticipantRow[]) ?? []
    setParticipants(parts)

    const charIds = parts.map((p) => p.character_id).filter((id): id is string => !!id)
    const instIds = parts.map((p) => p.enemy_instance_id).filter((id): id is string => !!id)

    const [{ data: charRows }, { data: instRows }] = await Promise.all([
      charIds.length
        ? supabase
            .from('characters')
            .select('id, user_id, name, portrait_url, level, hp_current, ep_current, attack, resistance, agility, intellect, charisma')
            .in('id', charIds)
        : Promise.resolve({ data: [] as CharacterData[] }),
      instIds.length
        ? supabase
            .from('enemy_instances')
            .select('id, enemy_id, status, hp_current, ep_current, enemies(name, portrait_url, tier, level, attack, resistance, agility, intellect, charisma)')
            .in('id', instIds)
        : Promise.resolve({ data: [] as EnemyInstanceData[] }),
    ])

    const charMap: Record<string, CharacterData> = {}
    ;((charRows as CharacterData[]) ?? []).forEach((c) => {
      charMap[c.id] = c
    })
    setCharactersById(charMap)

    const instMap: Record<string, EnemyInstanceData> = {}
    ;((instRows as unknown as EnemyInstanceData[]) ?? []).forEach((i) => {
      instMap[i.id] = i
    })
    setInstancesById(instMap)

    const sorted = sortParticipants(parts)
    const current = sorted.length > 0 ? sorted[battleRow.current_turn_index % sorted.length] : null

    if (current?.character_id) {
      const [{ data: abilityRows }, { data: cooldownRows }] = await Promise.all([
        supabase
          .from('character_abilities')
          .select('ability_id, level, abilities(name, description, type, tipo_efeito, definition, combat_enabled)')
          .eq('character_id', current.character_id),
        supabase.from('battle_ability_cooldowns').select('ability_id, last_used_round').eq('participant_id', current.id),
      ])
      setActorAbilities((abilityRows as unknown as AbilityRow[]) ?? [])
      setActorEnemyAbilities([])
      setActorCooldowns((cooldownRows as CooldownRow[]) ?? [])
    } else if (current?.enemy_instance_id && instMap[current.enemy_instance_id]) {
      const [{ data: abilityRows }, { data: cooldownRows }] = await Promise.all([
        supabase
          .from('enemy_abilities')
          .select('ability_id, level, abilities(name, description, type, tipo_efeito, definition, combat_enabled)')
          .eq('enemy_id', instMap[current.enemy_instance_id].enemy_id),
        supabase.from('battle_ability_cooldowns').select('ability_id, last_used_round').eq('participant_id', current.id),
      ])
      setActorAbilities([])
      setActorEnemyAbilities((abilityRows as unknown as AbilityRow[]) ?? [])
      setActorCooldowns((cooldownRows as CooldownRow[]) ?? [])
    } else {
      setActorAbilities([])
      setActorEnemyAbilities([])
      setActorCooldowns([])
    }
  }

  useEffect(() => {
    if (authLoading) return
    load()
    const channel = supabase
      .channel('combate-live', { config: { broadcast: { self: true } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_sessions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enemy_instances' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_ability_cooldowns' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_effects' }, () => load())
      // Números flutuantes só depois da confirmação do servidor (linha gravada no log).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_actions' }, ({ new: row }) => {
        const action = row as ActionRow
        if (action.kind === 'ability') pushToast(toastFromAction(action.result))
        load()
      })
      .on('broadcast', { event: 'combat-toast' }, ({ payload }) => {
        pushToast(payload as DistributiveOmit<CombatToast, 'id'>)
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  if (authLoading || battle === undefined) return null

  async function startBattle(characterIds: string[], enemyTemplateIds: string[]) {
    if (startingRef.current || !isMestre) return
    startingRef.current = true
    setStarting(true)
    setSetupError(null)
    let battleId: string | null = null
    const instanceIds: string[] = []
    try {
      const { data: session, error: sessionError } = await supabase.from('battle_sessions').insert({ status: 'setup' }).select('id').single()
      if (sessionError || !session) throw new Error("Não foi possível preparar o combate.")
      battleId = session.id
      const [charResult, enemyResult] = await Promise.all([
        characterIds.length ? supabase.from('characters').select('id, name, level').in('id', characterIds) : Promise.resolve({ data: [], error: null }),
        enemyTemplateIds.length ? supabase.from('enemies').select('id, name, tier, level, resistance, intellect').in('id', [...new Set(enemyTemplateIds)]) : Promise.resolve({ data: [], error: null }),
      ])
      if (charResult.error || enemyResult.error || charResult.data?.length !== characterIds.length || enemyResult.data?.length !== new Set(enemyTemplateIds).size) throw new Error("Não foi possível carregar todos os participantes. Atualize a página e tente novamente.")
      type ParticipantInsert = { battle_session_id: string; character_id?: string; enemy_instance_id?: string; name: string; side: string; initiative_roll: number; initiative_bonus: number; initiative_total: number }
      const toInsert: ParticipantInsert[] = (charResult.data ?? []).map((c) => {
        const init = rollInitiative(c.level)
        return { battle_session_id: session.id, character_id: c.id, name: c.name, side: 'aliado', initiative_roll: init.roll, initiative_bonus: init.bonus, initiative_total: init.total }
      })
      for (const templateId of enemyTemplateIds) {
        const enemy = enemyResult.data!.find((row) => row.id === templateId)!
        const label = enemy.name
        const instanceId = crypto.randomUUID()
        const mult = ENEMY_TIER_CONFIG[enemy.tier as EnemyTier].vidaMult
        instanceIds.push(instanceId)
        const { error } = await supabase.from('enemy_instances').insert({
          id: instanceId, enemy_id: enemy.id, label,
          hp_current: Math.round(calculateHpMax({ resistance: enemy.resistance, level: enemy.level }) * mult),
          ep_current: Math.round(calculateEpMax({ intellect: enemy.intellect, level: enemy.level }) * mult),
        })
        if (error) throw new Error("Não foi possível criar todas as cópias dos inimigos.")
        const init = rollInitiative(enemy.level)
        toInsert.push({ battle_session_id: session.id, enemy_instance_id: instanceId, name: label, side: 'inimigo', initiative_roll: init.roll, initiative_bonus: init.bonus, initiative_total: init.total })
      }
      if (!toInsert.length) throw new Error("Selecione pelo menos um participante.")
      const { error: participantError } = await supabase.from('battle_participants').insert(toInsert)
      if (participantError) throw new Error("Não foi possível salvar os participantes.")
      const { error: activateError } = await supabase.from('battle_sessions').update({ status: 'active' }).eq('id', session.id)
      if (activateError) throw new Error("Não foi possível ativar o combate.")
      await load()
    } catch (error) {
      let cleanupFailed = false
      if (battleId) { const result = await supabase.from('battle_sessions').delete().eq('id', battleId); cleanupFailed = !!result.error }
      if (instanceIds.length) { const result = await supabase.from('enemy_instances').delete().in('id', instanceIds); cleanupFailed = cleanupFailed || !!result.error }
      setSetupError((error instanceof Error ? error.message : "Falha ao iniciar o combate.") + (cleanupFailed ? " A limpeza ficou incompleta; verifique as instâncias no painel antes de tentar novamente." : " Nenhum combate parcial foi mantido."))
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }
  // Servidor passa o turno e expira efeitos. O índice esperado impede passar dois turnos com dois cliques.
  async function nextTurn() {
    if (!battle || participants.length === 0 || actingRef.current) return
    actingRef.current = true
    setActing(true)
    const { error } = await supabase.rpc('combat_next_turn', { p_battle_id: battle.id, p_expected_index: battle.current_turn_index })
    if (error) setLastResult('Não foi possível passar o turno: ' + error.message)
    else setLastResult(null)
    actingRef.current = false
    setActing(false)
    load()
  }

  async function toggleExecutionTest() {
    if (!battle || !isMestre) return
    const { error } = await supabase.from('battle_sessions').update({ execution_test: !battle.execution_test }).eq('id', battle.id)
    if (error) setLastResult('Não foi possível alterar o teste de execução: ' + error.message)
    load()
  }

  async function endBattle() {
    if (!battle) return
    await supabase.from('battle_sessions').update({ status: 'ended' }).eq('id', battle.id)
  }

  if (!battle) {
    return (
      <div className="combat-page mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <CombatToastLayer toasts={toasts} />
        <Reveal trigger="mount" className="flex items-center justify-between gap-4">
          <BlurText text="Combate" delay={60} animateBy="chars" direction="top" className="font-title font-bold text-3xl" />
          <Link to="/player" className="font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white">
            ← Voltar
          </Link>
        </Reveal>
        {isMestre ? (
          <Reveal trigger="mount" delay={80}>
            <p className="mt-2 font-body text-neutral-400">Escolha quem participa e inicie o combate.</p>
            <div className="mt-6">
              {setupError && <p role="alert" className="mb-4 text-sm text-red-300">{setupError}</p>}
              <SetupForm onStart={startBattle} starting={starting} />
            </div>
          </Reveal>
        ) : (
          <Reveal trigger="mount" delay={80}>
            <p className="mt-2 font-body text-neutral-400">Nenhum combate em andamento no momento.</p>
          </Reveal>
        )}
      </div>
    )
  }

  const sorted = sortParticipants(participants)
  const currentParticipant = sorted.length > 0 ? sorted[battle.current_turn_index % sorted.length] : null
  const actingCharacter = currentParticipant?.character_id ? charactersById[currentParticipant.character_id] : null
  const actingEnemyInstance = currentParticipant?.enemy_instance_id ? instancesById[currentParticipant.enemy_instance_id] : null
  const canAct = isMestre || (!!actingCharacter && actingCharacter.user_id === authSession?.user.id)

  // Marcas no participante, da mais antiga para a mais nova, com a equipe de quem aplicou.
  function marksOf(participantId: string): Target['marks'] {
    return effects
      .filter((e) => e.kind === 'marca' && e.target_participant_id === participantId && e.element)
      .sort((a, b) => cmp(a.updated_at, b.updated_at) || cmp(a.id, b.id))
      .map((e) => ({ element: e.element!, sourceSide: participants.find((p) => p.id === e.source_participant_id)?.side ?? null }))
  }

  const targets: Target[] = sorted
    .map((p): Target | null => {
      if (p.character_id) {
        const c = charactersById[p.character_id]
        if (!c) return null
        return {
          participantId: p.id,
          label: p.name,
          side: p.side,
          kind: 'character',
          refId: c.id,
          portraitUrl: c.portrait_url,
          hpCurrent: c.hp_current,
          hpMax: calculateHpMax({ resistance: c.resistance, level: c.level }),
          resistance: c.resistance,
          marks: marksOf(p.id),
        }
      }
      if (p.enemy_instance_id) {
        const i = instancesById[p.enemy_instance_id]
        if (!i) return null
        const mult = ENEMY_TIER_CONFIG[i.enemies.tier].vidaMult
        return {
          participantId: p.id,
          label: p.name,
          side: p.side,
          kind: 'enemy',
          refId: i.id,
          portraitUrl: i.enemies.portrait_url,
          hpCurrent: i.hp_current,
          hpMax: Math.round(calculateHpMax({ resistance: i.enemies.resistance, level: i.enemies.level }) * mult),
          resistance: i.enemies.resistance,
          marks: marksOf(p.id),
        }
      }
      return null
    })
    .filter((t): t is Target => !!t)

  const characterEpMax = actingCharacter ? calculateEpMax({ intellect: actingCharacter.intellect, level: actingCharacter.level }) : 0
  const enemyEpMax = actingEnemyInstance
    ? Math.round(calculateEpMax({ intellect: actingEnemyInstance.enemies.intellect, level: actingEnemyInstance.enemies.level }) * ENEMY_TIER_CONFIG[actingEnemyInstance.enemies.tier].vidaMult)
    : 0
  const actingHpCurrent = actingCharacter?.hp_current ?? actingEnemyInstance?.hp_current ?? 0
  const actingLabel = currentParticipant?.name ?? ''
  const actingPortraitUrl = actingCharacter?.portrait_url ?? actingEnemyInstance?.enemies.portrait_url ?? null
  const actingHpMax = actingCharacter
    ? calculateHpMax({ resistance: actingCharacter.resistance, level: actingCharacter.level })
    : actingEnemyInstance
      ? Math.round(
          calculateHpMax({ resistance: actingEnemyInstance.enemies.resistance, level: actingEnemyInstance.enemies.level }) *
            ENEMY_TIER_CONFIG[actingEnemyInstance.enemies.tier].vidaMult
        )
      : 0

  const activeDamageToast = [...toasts].reverse().find((t): t is DamageToast => t.kind === 'damage') ?? null
  const activeToastTarget = activeDamageToast ? targets.find((t) => t.participantId === activeDamageToast.targetParticipantId) ?? null : null

  function broadcastRoll(traitLabel: string, result: TestResult) {
    if (!currentParticipant) return
    broadcastToast({
      kind: 'roll',
      actorLabel: currentParticipant.name,
      traitLabel,
      total: result.total,
      critico: result.critico,
      falhaCritica: result.falhaCritica,
    })
  }

  const actorBase: Traits = actingCharacter ?? actingEnemyInstance?.enemies ?? { attack: 0, resistance: 0, agility: 0, intellect: 0, charisma: 0 }
  const actorEffectiveTraits = effectiveTraits(
    { attack: actorBase.attack, resistance: actorBase.resistance, agility: actorBase.agility, intellect: actorBase.intellect, charisma: actorBase.charisma },
    currentParticipant?.id,
    effects,
  )

  // A ação inteira é resolvida no servidor (combat_use_ability): turno, autoria, alvo, custo,
  // recarga, rolagens, efeitos e log numa transação. O identificador torna a repetição inofensiva.
  async function useAbility(ability: AbilityRow, targetParticipantId: string, pontoVital: boolean, allyTargetId: string | null) {
    if (!isAbilityReady(ability.abilities) || !currentParticipant || actingRef.current) return
    actingRef.current = true
    setActing(true)
    setLastResult(null)
    const actionId = crypto.randomUUID()
    const args = {
      p_action_id: actionId,
      p_actor_participant_id: currentParticipant.id,
      p_ability_id: ability.ability_id,
      p_target_participant_id: targetParticipantId,
      p_ally_target_participant_id: allyTargetId,
      p_ponto_vital: pontoVital,
    }
    try {
      let response = await supabase.rpc('combat_use_ability', args)
      // Falha de rede: reenvia com o MESMO id; o servidor não aplica duas vezes.
      if (response.error && !response.error.code) response = await supabase.rpc('combat_use_ability', args)
      if (response.error) setLastResult('Ação não realizada: ' + response.error.message)
      else setLastResult(describeAction(response.data as ActionResult))
    } finally {
      actingRef.current = false
      setActing(false)
      load()
    }
  }

  return (
    <div className="combat-page mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <FloatingParticipants items={targets} />
      <CombatToastLayer toasts={toasts} />

      <Reveal trigger="mount" className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <BlurText text="Combate" delay={60} animateBy="chars" direction="top" className="font-title font-bold text-3xl" />
          <p className="mt-1 font-body text-sm text-neutral-500">Rodada {battle.round_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(isMestre || canAct) && (
            <button
              onClick={nextTurn}
              disabled={acting}
              className="flex min-h-11 items-center gap-1.5 rounded bg-white px-3 py-1.5 font-body text-xs font-semibold text-neutral-950 disabled:opacity-50"
            >
              <Play size={16} strokeWidth={2} /> {isMestre ? 'Próximo turno' : 'Encerrar meu turno'}
            </button>
          )}
          {isMestre && (
            <>
              <label className="flex min-h-11 items-center gap-1.5 text-xs text-neutral-300" title="Teste de execução por Intelecto (regra provisória)">
                <input type="checkbox" checked={!!battle.execution_test} onChange={toggleExecutionTest} /> Teste de Intelecto
              </label>
              <button
                onClick={endBattle}
                className="flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 font-body text-xs text-neutral-400 transition-colors duration-300 hover:text-white"
              >
                <Square size={13} strokeWidth={2} /> Encerrar
              </button>
            </>
          )}
          <Link to="/player" className="font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white">
            ← Voltar
          </Link>
        </div>
      </Reveal>

      <InitiativeSidebar sorted={sorted} currentIndex={battle.current_turn_index} targets={targets} effects={effects} />

      {canAct && (actingCharacter || actingEnemyInstance) && currentParticipant && (
        <>
          <Reveal trigger="mount" delay={80} className="relative z-10 mt-8 text-center">
            <TextType
              key={currentParticipant.id}
              text={[`Vez de ${actingLabel}`]}
              typingSpeed={40}
              showCursor={false}
              loop={false}
              className="font-title text-xl font-semibold text-neutral-100"
            />
          </Reveal>

          <Reveal trigger="mount" delay={110} className="relative z-10 mt-4">
            <GlowCard contentClassName="p-6">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-8">
                <FocusPortrait label={actingLabel} portraitUrl={actingPortraitUrl} hpCurrent={actingHpCurrent} hpMax={actingHpMax} />
                {activeToastTarget && activeToastTarget.participantId !== currentParticipant.id && (
                  <div className="combat-focus-in flex items-center gap-3 sm:gap-8">
                    <span className="font-title text-2xl text-neutral-700">⚔</span>
                    <FocusPortrait
                      label={activeToastTarget.label}
                      portraitUrl={activeToastTarget.portraitUrl}
                      hpCurrent={activeToastTarget.hpCurrent}
                      hpMax={activeToastTarget.hpMax}
                    />
                  </div>
                )}
              </div>

              <div className="mt-6">
                <ActionMenu
                  key={currentParticipant.id}
                  actorTraits={actorEffectiveTraits}
                  abilities={actingCharacter ? actorAbilities : actorEnemyAbilities}
                  epCurrent={actingCharacter?.ep_current ?? actingEnemyInstance?.ep_current ?? 0}
                  epMax={actingCharacter ? characterEpMax : enemyEpMax}
                  cooldowns={actorCooldowns}
                  currentRound={battle.round_number}
                  targets={targets}
                  mySide={currentParticipant.side}
                  actorId={currentParticipant.id}
                  busy={acting}
                  onUseAbility={useAbility}
                  onRoll={broadcastRoll}
                />
              </div>

              {lastResult && <p role="status" className="mt-5 break-words font-body text-sm text-neutral-300">{lastResult}</p>}
            </GlowCard>
          </Reveal>
        </>
      )}

      {!canAct && lastResult && <p role="status" className="relative z-10 mt-4 text-sm text-red-300">{lastResult}</p>}

      <section aria-label="Registro do combate" className="relative z-10 mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-neutral-300">Registro</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma ação registrada neste combate.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {actions.map((a) => (
              <li key={a.id} className="break-words rounded-lg border border-neutral-800 bg-neutral-950/90 p-3 text-sm text-neutral-300">
                <span className="mr-2 text-xs tabular-nums text-neutral-500">R{a.round_number}</span>
                {a.kind === 'ability'
                  ? describeAction(a.result)
                  : `Fim do turno de ${participants.find((p) => p.id === a.result.ended)?.name ?? '—'}${a.result.expired?.length ? ` · expirou: ${a.result.expired.map((x) => (x.element ? 'marca ' + x.element : x.label ?? (x.attribute ? ATTRIBUTES[x.attribute as Attribute] : x.kind))).join(', ')}` : ''}`}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
