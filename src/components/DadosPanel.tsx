import { useState } from 'react'
import { Brain, Footprints, Handshake, Shield, Swords } from 'lucide-react'
import GlowCard from '@/components/GlowCard'
import { useAuth } from '@/lib/AuthContext'
import { DIFFICULTIES, FREE_ROLL_MAX_DICE, resolveTest, rollFreeText, type DifficultyId, type FreeRollResult, type TestResult } from '@/lib/diceEngine'
import { publishRoll, type RollSource } from '@/lib/diceFeed'

const TRAITS_META = [
  { key: 'attack' as const, label: 'Ataque', icon: Swords },
  { key: 'resistance' as const, label: 'Resistência', icon: Shield },
  { key: 'agility' as const, label: 'Agilidade', icon: Footprints },
  { key: 'intellect' as const, label: 'Intelecto', icon: Brain },
  { key: 'charisma' as const, label: 'Carisma', icon: Handshake },
]
type Traits = Record<(typeof TRAITS_META)[number]['key'], number>
type HistoryItem = { label: string; result: TestResult | FreeRollResult }

function ResultTag({ label, color }: { label: string; color: string }) {
  return <span className="shrink-0 rounded border px-1.5 py-0.5 font-body text-[12px]" style={{ borderColor: color, color }}>{label}</span>
}

function ResultRow({ label, result }: { label: string; result: TestResult | FreeRollResult }) {
  const isTest = 'critico' in result
  const test = isTest ? (result as TestResult) : null
  const free = isTest ? null : (result as FreeRollResult)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <div>
        <p className="font-body text-sm text-neutral-300">{label}</p>
        <p className="font-body text-xs text-neutral-500">
          [{result.rolls.join(', ')}] {test ? `mantém ${test.kept}` : `soma ${free ? free.sum : 0}`}
          {result.modifier !== 0 && ` ${result.modifier > 0 ? '+' : ''}${result.modifier}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-title text-lg font-bold text-neutral-100">{result.total}</p>
        {test?.critico && <ResultTag label="Sucesso Crítico!" color="#eab308" />}
        {test?.falhaCritica && <ResultTag label="Falha Crítica!" color="#dc2626" />}
      </div>
    </div>
  )
}

export default function DadosPanel({ traits, actorName, source, characterId = null, enemyId = null }: {
  traits: Traits
  actorName: string
  source: RollSource
  characterId?: string | null
  enemyId?: string | null
}) {
  const { profile, session } = useAuth()
  const [difficulty, setDifficulty] = useState<DifficultyId>('regular')
  const [freeText, setFreeText] = useState('')
  const [freeError, setFreeError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  function publish(kind: 'teste' | 'livre', label: string, difficultyId: DifficultyId | null, r: { rolls: number[]; kept: number | null; modifier: number; total: number; critico: boolean; falhaCritica: boolean }) {
    if (!session) return
    void publishRoll({
      user_id: session.user.id,
      username: profile ? profile.username : actorName,
      character_id: characterId,
      character_name: actorName,
      source,
      enemy_id: enemyId,
      kind,
      label,
      difficulty: difficultyId,
      rolls: r.rolls,
      kept: r.kept,
      modifier: r.modifier,
      total: r.total,
      critico: r.critico,
      falha_critica: r.falhaCritica,
    })
  }

  function rollTrait(trait: (typeof TRAITS_META)[number]) {
    const result = resolveTest({ status: traits[trait.key], difficulty })
    setHistory((prev) => [{ label: trait.label, result }, ...prev].slice(0, 3))
    publish('teste', trait.label, difficulty, result)
  }

  function rollFree() {
    const result = rollFreeText(freeText)
    if (!result) {
      setFreeError(`Notação inválida ou acima do limite (até ${FREE_ROLL_MAX_DICE} dados).`)
      return
    }
    setFreeError(null)
    const label = freeText
    setHistory((prev) => [{ label, result }, ...prev].slice(0, 3))
    publish('livre', label, null, { rolls: result.rolls, kept: null, modifier: result.modifier, total: result.total, critico: false, falhaCritica: false })
    setFreeText('')
  }  return (
    <div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-title font-semibold text-neutral-100">Teste de Status</h3>
        <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-neutral-800 bg-neutral-900/60 p-1 sm:w-auto sm:grid-cols-4">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`rounded-full px-3 py-1.5 font-body text-xs font-semibold transition-colors duration-300 ${difficulty === d.id ? 'bg-white text-neutral-950' : 'text-neutral-400 hover:text-white'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TRAITS_META.map((trait) => (
          <button key={trait.key} type="button" onClick={() => rollTrait(trait)} className="w-full text-left">
            <GlowCard contentClassName="flex flex-col items-center gap-1.5 p-4">
              <trait.icon size={18} strokeWidth={1.5} className="text-neutral-400" />
              <span className="font-body text-xs text-neutral-400">{trait.label}</span>
            </GlowCard>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && rollFree()}
          placeholder="Rolagem livre: 2d20kh1+3"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-body text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <button onClick={rollFree} className="rounded bg-white px-4 py-2 font-body text-xs font-semibold text-neutral-950 sm:shrink-0">Rolar</button>
      </div>

      {freeError && <p role="alert" className="mt-2 font-body text-xs text-red-300">{freeError}</p>}

      {history.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="font-body text-xs uppercase tracking-wide text-neutral-500">Histórico</p>
          {history.map((h, i) => <ResultRow key={i} label={h.label} result={h.result} />)}
        </div>
      )}
    </div>
  )
}