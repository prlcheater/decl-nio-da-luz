import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Skull, UserRound } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import { ENEMY_TIER_CONFIG, calculateEpMax, calculateHpMax, type EnemyTier } from '@/lib/diceEngine'

const inputClass =
  'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-body text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none'
const labelClass = 'mb-1.5 block font-body text-xs uppercase tracking-wide text-neutral-500'

type EnemyRow = {
  id: string
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

type InstanceRow = {
  id: string
  enemy_id: string
  label: string | null
  hp_current: number
  ep_current: number
  status: 'active' | 'defeated'
}

function enemyMaxStats(enemy: EnemyRow) {
  const mult = ENEMY_TIER_CONFIG[enemy.tier].vidaMult
  return {
    hpMax: Math.round(calculateHpMax({ resistance: enemy.resistance, level: enemy.level }) * mult),
    epMax: Math.round(calculateEpMax({ intellect: enemy.intellect, level: enemy.level }) * mult),
  }
}

function EnemyCard({ enemy }: { enemy: EnemyRow }) {
  return (
    <Link to={`/player/mestre/inimigos/${enemy.id}`} className="block">
      <GlowCard contentClassName="flex items-center gap-3 p-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900">
          {enemy.portrait_url ? (
            <img src={enemy.portrait_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserRound size={20} strokeWidth={1.25} className="text-neutral-600" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-title font-semibold text-neutral-100">{enemy.name}</p>
          <p className="font-body text-xs uppercase tracking-wide text-neutral-500">
            {ENEMY_TIER_CONFIG[enemy.tier].label} · Nv. {enemy.level}
          </p>
        </div>
      </GlowCard>
    </Link>
  )
}

function AddEnemyCard({
  elements,
  onAdd,
}: {
  elements: { id: string; name: string }[]
  onAdd: (enemy: { name: string; tier: EnemyTier; level: number; element_id: string | null }) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [tier, setTier] = useState<EnemyTier>('comum')
  const [level, setLevel] = useState(1)
  const [elementId, setElementId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-2 rounded-md bg-white px-4 py-2.5 font-body text-sm font-semibold text-neutral-950 transition-all duration-300 ease-out hover:bg-neutral-200 hover:scale-[1.03]"
      >
        <Plus size={16} strokeWidth={2} />
        Criar inimigo
      </button>
    )
  }

  async function submit() {
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    const errorMessage = await onAdd({ name: name.trim(), tier, level, element_id: elementId || null })
    setSubmitting(false)
    if (errorMessage) {
      setError(errorMessage)
      return
    }
    setName('')
    setTier('comum')
    setLevel(1)
    setElementId('')
    setOpen(false)
  }

  return (
    <GlowCard contentClassName="p-6">
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>Nome do inimigo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Bruxa Necrófoga" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as EnemyTier)} className={inputClass}>
              {Object.entries(ENEMY_TIER_CONFIG).map(([id, meta]) => (
                <option key={id} value={id}>{meta.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Nível</label>
            <input type="number" min={1} value={level} onChange={(e) => setLevel(Number(e.target.value))} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Elemento (opcional)</label>
          <select value={elementId} onChange={(e) => setElementId(e.target.value)} className={inputClass}>
            <option value="">Nenhum</option>
            {elements.map((el) => (
              <option key={el.id} value={el.id}>{el.name}</option>
            ))}
          </select>
        </div>
        <p className="font-body text-xs text-neutral-600">Retrato, traços e habilidades você define na ficha dele, depois de criar.</p>
        {error && <p className="font-body text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="flex-1 rounded bg-white py-2 font-body text-sm font-semibold text-neutral-950 disabled:opacity-50">
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={() => setOpen(false)} className="rounded border border-neutral-700 px-3 py-2 font-body text-sm text-neutral-400">Cancelar</button>
        </div>
      </div>
    </GlowCard>
  )
}

function InstanceCard({
  instance,
  enemy,
  onApplyDamage,
  onToggleDefeated,
  onRemove,
}: {
  instance: InstanceRow
  enemy: EnemyRow
  onApplyDamage: (danoRecebido: number) => void
  onToggleDefeated: () => void
  onRemove: () => void
}) {
  const [dano, setDano] = useState('')
  const { hpMax, epMax } = enemyMaxStats(enemy)

  function applyDamage() {
    const value = Number(dano)
    if (!value || value <= 0) return
    onApplyDamage(value)
    setDano('')
  }

  return (
    <GlowCard contentClassName="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-title font-semibold text-neutral-100">{instance.label?.trim() || enemy.name}</p>
          <p className="text-xs text-neutral-400">ID: {instance.id.slice(0, 8)}</p>
          <p className="font-body text-xs text-neutral-500">{enemy.name} · {ENEMY_TIER_CONFIG[enemy.tier].label} · Nv. {enemy.level}</p>
        </div>
        {instance.status === 'defeated' && (
          <span className="flex items-center gap-1 font-body text-[10px] uppercase tracking-wide text-neutral-600">
            <Skull size={12} strokeWidth={1.75} /> Derrotado
          </span>
        )}
      </div>

      <p className="mt-2 font-body text-sm text-neutral-300">
        PV {instance.hp_current} <span className="text-neutral-600">/ {hpMax}</span>
        <span className="mx-2 text-neutral-700">·</span>
        PE {instance.ep_current} <span className="text-neutral-600">/ {epMax}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          value={dano}
          onChange={(e) => setDano(e.target.value)}
          placeholder="dano recebido"
          className={`${inputClass} w-28 py-1.5 text-xs`}
        />
        <button onClick={applyDamage} className="rounded border border-neutral-700 px-3 py-1.5 font-body text-xs text-neutral-300 hover:text-white">
          Aplicar
        </button>
        <button onClick={onToggleDefeated} className="font-body text-[11px] text-neutral-500 hover:text-white">
          {instance.status === 'defeated' ? 'Reativar' : 'Marcar derrotado'}
        </button>
        <button onClick={onRemove} className="ml-auto flex items-center gap-1 font-body text-[11px] text-neutral-600 hover:text-red-400">
          <Trash2 size={11} strokeWidth={1.75} /> Remover
        </button>
      </div>
    </GlowCard>
  )
}

export default function PainelInimigos() {
  const { isMestre, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [enemies, setEnemies] = useState<EnemyRow[]>([])
  const [instances, setInstances] = useState<InstanceRow[]>([])
  const [instanceError, setInstanceError] = useState<string | null>(null)
  const [instantiating, setInstantiating] = useState(false)
  const [elements, setElements] = useState<{ id: string; name: string }[]>([])

  async function load() {
    const [{ data: enemyRows }, { data: instanceRows }] = await Promise.all([
      supabase.from('enemies').select('id, name, portrait_url, tier, level, attack, resistance, agility, intellect, charisma').order('name'),
      supabase.from('enemy_instances').select('*').order('created_at', { ascending: false }),
    ])
    setEnemies((enemyRows as EnemyRow[]) ?? [])
    setInstances((instanceRows as InstanceRow[]) ?? [])
  }

  useEffect(() => {
    if (!isMestre) return
    load()
    supabase.from('elements').select('id, name').order('name').then(({ data }) => setElements(data ?? []))
  }, [isMestre])

  if (authLoading) return null
  if (!isMestre) return <Navigate to="/player" replace />

  async function addEnemy(enemy: { name: string; tier: EnemyTier; level: number; element_id: string | null }): Promise<string | null> {
    const { data, error } = await supabase.from('enemies').insert(enemy).select('id').single()
    if (error || !data) return error?.message ?? 'Não foi possível criar o inimigo.'
    navigate(`/player/mestre/inimigos/${data.id}`)
    return null
  }

  async function instantiate(enemy: EnemyRow, e: FormEvent) {
    e.preventDefault()
    if (instantiating) return
    setInstantiating(true)
    setInstanceError(null)
    const { hpMax, epMax } = enemyMaxStats(enemy)
    const id = crypto.randomUUID()
    const { error } = await supabase.from('enemy_instances').insert({ id, enemy_id: enemy.id, label: enemy.name + ' · ' + id.slice(0, 8), hp_current: hpMax, ep_current: epMax })
    setInstantiating(false)
    if (error) setInstanceError('Não foi possível instanciar o inimigo. Tente novamente.')
    else await load()
  }

  async function applyDamage(instance: InstanceRow, danoRecebido: number) {
    const next = Math.max(0, instance.hp_current - danoRecebido)
    setInstances((prev) => prev.map((i) => (i.id === instance.id ? { ...i, hp_current: next } : i)))
    await supabase.from('enemy_instances').update({ hp_current: next }).eq('id', instance.id)
  }

  async function toggleDefeated(instance: InstanceRow) {
    const status = instance.status === 'defeated' ? 'active' : 'defeated'
    setInstances((prev) => prev.map((i) => (i.id === instance.id ? { ...i, status } : i)))
    await supabase.from('enemy_instances').update({ status }).eq('id', instance.id)
  }

  async function removeInstance(id: string) {
    await supabase.from('enemy_instances').delete().eq('id', id)
    setInstances((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="combat-page mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <Reveal className="flex items-start justify-between">
        <div>
          <h1 className="font-title font-bold text-3xl">Inimigos</h1>
          <p className="mt-2 font-body text-neutral-400">Fichas de inimigo e instâncias em jogo pra rastrear PV/PE durante o combate.</p>
        </div>
        <Link to="/player/mestre" className="font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white">
          ← Área do Mestre
        </Link>
      </Reveal>

      <Reveal delay={80} className="mt-6">
        <AddEnemyCard elements={elements} onAdd={addEnemy} />
      </Reveal>

      <Reveal delay={100} className="mt-8">
        <h2 className="font-title font-semibold text-xl text-neutral-100">Fichas</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enemies.map((enemy) => (
            <EnemyCard key={enemy.id} enemy={enemy} />
          ))}

        </div>
      </Reveal>

      <Reveal delay={160} className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-title font-semibold text-xl text-neutral-100">Instâncias em jogo</h2>
        </div>
        {instanceError && <p role="alert" className="mt-3 text-red-300">{instanceError}</p>}
        {enemies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {enemies.map((enemy) => (
              <form key={enemy.id} onSubmit={(e) => instantiate(enemy, e)}>
                <button
                  type="submit"
                  disabled={instantiating}
                  className="rounded border border-neutral-700 px-3 py-1.5 font-body text-xs text-neutral-300 transition-colors duration-300 hover:border-neutral-500 hover:text-white"
                >
                  + Instanciar {enemy.name}
                </button>
              </form>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {instances.length === 0 && <p className="font-body text-sm text-neutral-600">Nenhum inimigo instanciado ainda.</p>}
          {instances.map((instance) => {
            const enemy = enemies.find((en) => en.id === instance.enemy_id)
            if (!enemy) return null
            return (
              <InstanceCard
                key={instance.id}
                instance={instance}
                enemy={enemy}
                onApplyDamage={(dano) => applyDamage(instance, dano)}
                onToggleDefeated={() => toggleDefeated(instance)}
                onRemove={() => removeInstance(instance.id)}
              />
            )
          })}
        </div>
      </Reveal>
    </div>
  )
}
