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
  EFEITO_STATUS_ESCALADOR,
  ENEMY_TIER_CONFIG,
  calculateDamage,
  calculateEpMax,
  calculateHpMax,
  calculateMitigation,
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
}

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
  user_id: string
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
  abilities: { name: string; description: string | null; type: AbilityTier; tipo_efeito: TipoEfeito }
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
}

type DamageToast = {
  id: string
  kind: 'damage'
  actorLabel: string
  targetLabel: string
  targetParticipantId: string
  abilityName: string
  tipoEfeito: TipoEfeito
  amount: number
  severity: DamageSeverity
  color: string
  critico: boolean
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

function sortParticipants(rows: ParticipantRow[]): ParticipantRow[] {
  return [...rows].sort((a, b) => b.initiative_total - a.initiative_total || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))
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

function InitiativeSidebar({ sorted, currentIndex, targets }: { sorted: ParticipantRow[]; currentIndex: number; targets: Target[] }) {
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
  onUse,
}: {
  ability: AbilityRow
  epCurrent: number
  epMax: number
  cooldownRow: CooldownRow | null
  currentRound: number
  onUse: (pontoVital: boolean) => void
}) {
  const tier = ability.abilities.type
  const cost = energyCost(tier, epMax)
  const available = isAbilityAvailable({ tier, lastUsedRound: cooldownRow?.last_used_round ?? null, currentRound })
  const remaining = roundsUntilAvailable({ tier, lastUsedRound: cooldownRow?.last_used_round ?? null, currentRound })
  const [pontoVital, setPontoVital] = useState(false)

  const disabled = !available || epCurrent < cost

  return (
    <div className="rounded border border-neutral-800 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body text-base text-neutral-100">{ability.abilities.name}</p>
        <Badge label={TIER_META[tier].label} color={TIER_META[tier].color} />
      </div>
      {!available && <p className="mt-1.5 font-body text-sm text-red-400">Em recarga — faltam {remaining} rodada(s).</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 font-body text-sm text-neutral-500">
          <input type="checkbox" checked={pontoVital} onChange={(e) => setPontoVital(e.target.checked)} /> Ponto vital
        </label>
        <button
          onClick={() => onUse(pontoVital)}
          disabled={disabled}
          className="rounded bg-white px-4 py-2 font-body text-sm font-semibold text-neutral-950 disabled:opacity-40"
        >
          Usar ({cost} PE)
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
  onUse: (ability: AbilityRow, pontoVital: boolean) => void
  onClose: () => void
}) {
  const usable = abilities.filter((a) => (a.abilities.tipo_efeito === 'dano' ? target.side !== mySide : target.side === mySide))

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
                onUse={(pontoVital) => {
                  onUse(a, pontoVital)
                  onClose()
                }}
              />
            ))}
          </div>
        )}
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
  onUseAbility: (ability: AbilityRow, targetId: string, pontoVital: boolean) => void
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
            onUse={(ability, pontoVital) => onUseAbility(ability, popupTarget.participantId, pontoVital)}
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

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
      return
    }

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
          .select('ability_id, level, abilities(name, description, type, tipo_efeito)')
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
          .select('ability_id, level, abilities(name, description, type, tipo_efeito)')
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
      .on('broadcast', { event: 'combat-toast' }, ({ payload }) => {
        const toast = { ...(payload as DistributiveOmit<CombatToast, 'id'>), id: `${Date.now()}-${Math.random()}` } as CombatToast
        setToasts((prev) => [...prev, toast])
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 5500)
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
  async function nextTurn() {
    if (!battle || participants.length === 0) return
    const nextIndex = (battle.current_turn_index + 1) % participants.length
    const wrapped = nextIndex === 0
    await supabase
      .from('battle_sessions')
      .update({ current_turn_index: nextIndex, round_number: wrapped ? battle.round_number + 1 : battle.round_number })
      .eq('id', battle.id)
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

  // Passa pelo banco porque o jogador não tem permissão de gravar o PV de outros
  // participantes direto. Se falhar, a ação para antes de gastar energia ou recarga.
  async function applyHpChange(target: Target, delta: number): Promise<boolean> {
    const { error } = await supabase.rpc('combat_apply_hp', {
      p_actor_participant_id: currentParticipant!.id,
      p_target_participant_id: target.participantId,
      p_delta: delta,
      p_hp_max: target.hpMax,
    })
    if (error) setLastResult(`Não foi possível aplicar o efeito em ${target.label}.`)
    return !error
  }

  async function useAbility(ability: AbilityRow, targetParticipantId: string, pontoVital: boolean) {
    if (!actingCharacter || !currentParticipant || !battle) return
    const tier = ability.abilities.type
    const tipoEfeito = ability.abilities.tipo_efeito
    const cost = energyCost(tier, characterEpMax)
    if (actingCharacter.ep_current < cost) return

    const statusKey = EFEITO_STATUS_ESCALADOR[tipoEfeito]
    const result = calculateDamage({
      tier,
      nivelHabilidade: ability.level,
      statusEscalador: actingCharacter[statusKey],
      pontoVital,
    })

    const target = targets.find((t) => t.participantId === targetParticipantId)
    if (!target) return

    let resumo = ''
    if (tipoEfeito === 'dano') {
      const mitigation = calculateMitigation({ resistance: target.resistance, danoBruto: result.danoFinal })
      if (!(await applyHpChange(target, -mitigation.danoFinal))) return
      resumo = `${ability.abilities.name} em ${target.label}: ${result.danoFinal} bruto → mitigação ${mitigation.mitigacao} → ${mitigation.danoFinal} de dano final${result.critico ? ' (Crítico!)' : ''}.`
      const sev = damageSeverity({ amount: mitigation.danoFinal, hpMax: target.hpMax })
      broadcastToast({
        kind: 'damage',
        actorLabel: currentParticipant.name,
        targetLabel: target.label,
        targetParticipantId: target.participantId,
        abilityName: ability.abilities.name,
        tipoEfeito,
        amount: mitigation.danoFinal,
        severity: sev.tier,
        color: sev.color,
        critico: result.critico,
      })
    } else {
      if (!(await applyHpChange(target, result.danoFinal))) return
      resumo = `${ability.abilities.name} em ${target.label}: +${result.danoFinal} de ${tipoEfeito === 'cura' ? 'cura' : 'escudo'}${result.critico ? ' (Crítico!)' : ''}.`
      broadcastToast({
        kind: 'damage',
        actorLabel: currentParticipant.name,
        targetLabel: target.label,
        targetParticipantId: target.participantId,
        abilityName: ability.abilities.name,
        tipoEfeito,
        amount: result.danoFinal,
        severity: 'branco',
        color: tipoEfeito === 'cura' ? '#22c55e' : '#5227FF',
        critico: result.critico,
      })
    }

    await supabase.from('characters').update({ ep_current: actingCharacter.ep_current - cost }).eq('id', actingCharacter.id)
    await supabase.from('battle_ability_cooldowns').upsert(
      { battle_session_id: battle.id, participant_id: currentParticipant.id, ability_id: ability.ability_id, last_used_round: battle.round_number },
      { onConflict: 'participant_id,ability_id' }
    )

    setLastResult(resumo)
    load()
  }

  async function useEnemyAbility(ability: AbilityRow, targetParticipantId: string, pontoVital: boolean) {
    if (!actingEnemyInstance || !currentParticipant || !battle) return
    const enemyDef = actingEnemyInstance.enemies
    const tier = ability.abilities.type
    const tipoEfeito = ability.abilities.tipo_efeito
    const cost = energyCost(tier, enemyEpMax)
    if (actingEnemyInstance.ep_current < cost) return

    const statusKey = EFEITO_STATUS_ESCALADOR[tipoEfeito]
    const result = calculateDamage({
      tier,
      nivelHabilidade: ability.level,
      statusEscalador: enemyDef[statusKey],
      pontoVital,
    })

    const target = targets.find((t) => t.participantId === targetParticipantId)
    if (!target) return

    let resumo = ''
    if (tipoEfeito === 'dano') {
      const danoAjustado = Math.round(result.danoFinal * ENEMY_TIER_CONFIG[enemyDef.tier].danoMult)
      const mitigation = calculateMitigation({ resistance: target.resistance, danoBruto: danoAjustado })
      if (!(await applyHpChange(target, -mitigation.danoFinal))) return
      resumo = `${ability.abilities.name} (${currentParticipant.name}) em ${target.label}: ${danoAjustado} bruto → mitigação ${mitigation.mitigacao} → ${mitigation.danoFinal} de dano final${result.critico ? ' (Crítico!)' : ''}.`
      const sev = damageSeverity({ amount: mitigation.danoFinal, hpMax: target.hpMax })
      broadcastToast({
        kind: 'damage',
        actorLabel: currentParticipant.name,
        targetLabel: target.label,
        targetParticipantId: target.participantId,
        abilityName: ability.abilities.name,
        tipoEfeito,
        amount: mitigation.danoFinal,
        severity: sev.tier,
        color: sev.color,
        critico: result.critico,
      })
    } else {
      if (!(await applyHpChange(target, result.danoFinal))) return
      resumo = `${ability.abilities.name} (${currentParticipant.name}) em ${target.label}: +${result.danoFinal} de ${tipoEfeito === 'cura' ? 'cura' : 'escudo'}${result.critico ? ' (Crítico!)' : ''}.`
      broadcastToast({
        kind: 'damage',
        actorLabel: currentParticipant.name,
        targetLabel: target.label,
        targetParticipantId: target.participantId,
        abilityName: ability.abilities.name,
        tipoEfeito,
        amount: result.danoFinal,
        severity: 'branco',
        color: tipoEfeito === 'cura' ? '#22c55e' : '#5227FF',
        critico: result.critico,
      })
    }

    await supabase.from('enemy_instances').update({ ep_current: actingEnemyInstance.ep_current - cost }).eq('id', actingEnemyInstance.id)
    await supabase.from('battle_ability_cooldowns').upsert(
      { battle_session_id: battle.id, participant_id: currentParticipant.id, ability_id: ability.ability_id, last_used_round: battle.round_number },
      { onConflict: 'participant_id,ability_id' }
    )

    setLastResult(resumo)
    load()
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
          {isMestre && (
            <>
              <button
                onClick={nextTurn}
                className="flex items-center gap-1.5 rounded bg-white px-3 py-1.5 font-body text-xs font-semibold text-neutral-950"
              >
                <Play size={16} strokeWidth={2} /> Próximo turno
              </button>
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

      <InitiativeSidebar sorted={sorted} currentIndex={battle.current_turn_index} targets={targets} />

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
                  actorTraits={actingCharacter ?? actingEnemyInstance?.enemies ?? { attack: 0, resistance: 0, agility: 0, intellect: 0, charisma: 0 }}
                  abilities={actingCharacter ? actorAbilities : actorEnemyAbilities}
                  epCurrent={actingCharacter?.ep_current ?? actingEnemyInstance?.ep_current ?? 0}
                  epMax={actingCharacter ? characterEpMax : enemyEpMax}
                  cooldowns={actorCooldowns}
                  currentRound={battle.round_number}
                  targets={targets}
                  mySide={currentParticipant.side}
                  onUseAbility={(ability, targetId, pontoVital) =>
                    actingCharacter ? useAbility(ability, targetId, pontoVital) : useEnemyAbility(ability, targetId, pontoVital)
                  }
                  onRoll={broadcastRoll}
                />
              </div>

              {lastResult && (
                <TextType
                  key={lastResult}
                  text={[lastResult]}
                  typingSpeed={20}
                  showCursor={false}
                  loop={false}
                  className="mt-5 block font-body text-sm text-neutral-400"
                />
              )}
            </GlowCard>
          </Reveal>
        </>
      )}
    </div>
  )
}
