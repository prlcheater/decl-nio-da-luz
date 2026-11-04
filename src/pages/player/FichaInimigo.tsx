import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  UserRound,
  Camera,
  Swords,
  Shield,
  Footprints,
  Brain,
  Handshake,
  ChevronUp,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import ImageCropModal from '@/components/ImageCropModal'
import { ELEMENTS, GRADIENT_COLORS } from '@/lib/gameData'
import { ENEMY_TIER_CONFIG, calculateEpMax, calculateHpMax, type AbilityTier, type EnemyTier, type TipoEfeito } from '@/lib/diceEngine'

const inputClass =
  'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-body text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none'

const TRAITS_META = [
  { key: 'attack' as const, label: 'Ataque', icon: Swords },
  { key: 'resistance' as const, label: 'Resistência', icon: Shield },
  { key: 'agility' as const, label: 'Agilidade', icon: Footprints },
  { key: 'intellect' as const, label: 'Intelecto', icon: Brain },
  { key: 'charisma' as const, label: 'Carisma', icon: Handshake },
]

const ABILITY_TIERS: { id: AbilityTier; label: string; color: string }[] = [
  { id: 'comum', label: 'Comum', color: '#9ca3af' },
  { id: 'especial', label: 'Especial', color: '#818cf8' },
  { id: 'suprema', label: 'Suprema', color: '#f472b6' },
]

const TIPO_EFEITO_META: { id: TipoEfeito; label: string; color: string }[] = [
  { id: 'dano', label: 'Dano', color: '#dc2626' },
  { id: 'cura', label: 'Cura', color: '#22c55e' },
  { id: 'escudo', label: 'Escudo', color: '#5227FF' },
]

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
  element_id: string | null
  elements: { name: string } | null
}

type AbilityRow = {
  ability_id: string
  level: number
  abilities: { name: string; description: string | null; type: AbilityTier; tipo_efeito: TipoEfeito }
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

function AddAbilityCard({ onAdd }: { onAdd: (name: string, desc: string, tier: AbilityTier, level: number, tipoEfeito: TipoEfeito) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tier, setTier] = useState<AbilityTier>('comum')
  const [tipoEfeito, setTipoEfeito] = useState<TipoEfeito>('dano')
  const [level, setLevel] = useState(1)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-800 font-body text-sm text-neutral-500 transition-colors duration-300 hover:border-neutral-600 hover:text-white"
      >
        <Plus size={16} strokeWidth={2} />
        Adicionar habilidade
      </button>
    )
  }

  function submit() {
    if (!name.trim()) return
    onAdd(name.trim(), desc.trim(), tier, level, tipoEfeito)
    setName('')
    setDesc('')
    setTier('comum')
    setTipoEfeito('dano')
    setLevel(1)
    setOpen(false)
  }

  return (
    <GlowCard contentClassName="p-5">
      <div className="flex flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da habilidade" className={inputClass} />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" rows={2} className={inputClass} />
        <div className="flex gap-2">
          <select value={tier} onChange={(e) => setTier(e.target.value as AbilityTier)} className={inputClass}>
            {ABILITY_TIERS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select value={tipoEfeito} onChange={(e) => setTipoEfeito(e.target.value as TipoEfeito)} className={inputClass}>
            {TIPO_EFEITO_META.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
          <input type="number" min={1} max={10} value={level} onChange={(e) => setLevel(Number(e.target.value))} className={`${inputClass} w-20`} />
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="flex-1 rounded bg-white py-1.5 font-body text-xs font-semibold text-neutral-950">Salvar</button>
          <button onClick={() => setOpen(false)} className="rounded border border-neutral-700 px-2.5 py-1.5 font-body text-xs text-neutral-400">Cancelar</button>
        </div>
      </div>
    </GlowCard>
  )
}

export default function FichaInimigo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isMestre, loading: authLoading } = useAuth()

  const [enemy, setEnemy] = useState<EnemyRow | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [abilities, setAbilities] = useState<AbilityRow[]>([])
  const [elements, setElements] = useState<{ id: string; name: string }[]>([])
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [instanceLabel, setInstanceLabel] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const { data, error } = await supabase.from('enemies').select('*, elements(name)').eq('id', id).maybeSingle()
    if (error) {
      setLoadError(error.message)
      setEnemy(null)
      return
    }
    setLoadError(null)
    setEnemy((data as EnemyRow | null) ?? null)
    if (!data) return
    const { data: abilityRows } = await supabase
      .from('enemy_abilities')
      .select('ability_id, level, abilities(name, description, type, tipo_efeito)')
      .eq('enemy_id', data.id)
    setAbilities((abilityRows as unknown as AbilityRow[]) ?? [])
  }

  useEffect(() => {
    if (authLoading || !isMestre) return
    load()
    supabase.from('elements').select('id, name').order('name').then(({ data }) => setElements(data ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, isMestre])

  if (authLoading) return null
  if (!isMestre) return <Navigate to="/player" replace />
  if (enemy === undefined) return null
  if (!enemy) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-title font-semibold text-xl text-neutral-200">
          {loadError ? 'Não deu pra carregar esse inimigo.' : 'Inimigo não encontrado.'}
        </p>
        {loadError && <p className="mt-2 font-body text-sm text-red-400">{loadError}</p>}
        <Link to="/player/mestre/inimigos" className="mt-4 inline-block font-body text-sm text-neutral-400 hover:text-white">
          ← Inimigos
        </Link>
      </div>
    )
  }

  const element = ELEMENTS.find((el) => el.name === enemy.elements?.name)
  const elementGradient = element?.gradient ?? [GRADIENT_COLORS[0], GRADIENT_COLORS[2]]

  async function persist(patch: Partial<EnemyRow>) {
    setEnemy((prev) => (prev ? { ...prev, ...patch } : prev))
    await supabase.from('enemies').update(patch).eq('id', enemy!.id)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setPendingFile(file)
  }

  function adjustTrait(key: 'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma', delta: number) {
    persist({ [key]: Math.max(0, enemy![key] + delta) } as Partial<EnemyRow>)
  }

  async function addAbility(name: string, desc: string, tier: AbilityTier, level: number, tipoEfeito: TipoEfeito) {
    const { data: ability } = await supabase
      .from('abilities')
      .insert({ name, description: desc, type: tier, tipo_efeito: tipoEfeito })
      .select('id')
      .single()
    if (!ability) return
    await supabase.from('enemy_abilities').insert({ enemy_id: enemy!.id, ability_id: ability.id, level })
    load()
  }

  async function removeAbility(abilityId: string) {
    await supabase.from('enemy_abilities').delete().eq('enemy_id', enemy!.id).eq('ability_id', abilityId)
    setAbilities((prev) => prev.filter((a) => a.ability_id !== abilityId))
  }

  async function handleDelete() {
    await supabase.from('enemies').delete().eq('id', enemy!.id)
    navigate('/player/mestre/inimigos')
  }

  async function instantiate() {
    const mult = ENEMY_TIER_CONFIG[enemy!.tier].vidaMult
    const hpMax = Math.round(calculateHpMax({ resistance: enemy!.resistance, level: enemy!.level }) * mult)
    const epMax = Math.round(calculateEpMax({ intellect: enemy!.intellect, level: enemy!.level }) * mult)
    await supabase.from('enemy_instances').insert({
      enemy_id: enemy!.id,
      label: instanceLabel.trim() || null,
      hp_current: hpMax,
      ep_current: epMax,
    })
    setInstanceLabel('')
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={(dataUrl) => {
            persist({ portrait_url: dataUrl })
            setPendingFile(null)
          }}
        />
      )}

      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="inimigo-element-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={elementGradient[0]} />
            <stop offset="100%" stopColor={elementGradient[1]} />
          </linearGradient>
        </defs>
      </svg>

      <Reveal className="flex items-center justify-between gap-4">
        <Link to="/player/mestre/inimigos" className="font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white">
          ← Inimigos
        </Link>
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-neutral-400">Excluir de vez?</span>
            <button onClick={handleDelete} className="rounded bg-red-500/90 px-2.5 py-1 font-body text-xs font-semibold text-white hover:bg-red-500">
              Sim
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="rounded border border-neutral-700 px-2.5 py-1 font-body text-xs text-neutral-400 hover:text-white">
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-red-400"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            Excluir inimigo
          </button>
        )}
      </Reveal>

      <Reveal delay={60} className="mt-4">
        <GlowCard contentClassName="p-6">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-neutral-700 bg-neutral-900">
              {enemy.portrait_url ? (
                <img src={enemy.portrait_url} alt={enemy.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserRound size={44} strokeWidth={1.25} className="text-neutral-600" />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Alterar foto do inimigo"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <Camera size={22} strokeWidth={1.75} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            <div className="flex-1">
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={inputClass} placeholder="Nome" />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        persist({ name: nameDraft.trim() || enemy.name })
                        setEditingName(false)
                      }}
                      className="rounded bg-white px-3 py-1.5 font-body text-xs font-semibold text-neutral-950"
                    >
                      Salvar
                    </button>
                    <button onClick={() => setEditingName(false)} className="rounded border border-neutral-700 px-3 py-1.5 font-body text-xs text-neutral-400">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-title font-bold text-3xl text-neutral-100">{enemy.name}</h1>
                  <button
                    onClick={() => {
                      setNameDraft(enemy.name)
                      setEditingName(true)
                    }}
                    className="mt-2 flex items-center gap-1 font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white"
                  >
                    <Pencil size={11} strokeWidth={1.75} /> Editar
                  </button>
                </>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div>
                  <label className="mb-1 block font-body text-[11px] uppercase tracking-wide text-neutral-600">Tier</label>
                  <select
                    value={enemy.tier}
                    onChange={(e) => persist({ tier: e.target.value as EnemyTier })}
                    className={`${inputClass} w-32 py-1.5 text-xs`}
                  >
                    {Object.entries(ENEMY_TIER_CONFIG).map(([tid, meta]) => (
                      <option key={tid} value={tid}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-body text-[11px] uppercase tracking-wide text-neutral-600">Elemento</label>
                  <select
                    value={enemy.element_id ?? ''}
                    onChange={(e) => persist({ element_id: e.target.value || null })}
                    className={`${inputClass} w-40 py-1.5 text-xs`}
                  >
                    <option value="">Nenhum</option>
                    {elements.map((el) => (
                      <option key={el.id} value={el.id}>{el.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-body text-[11px] uppercase tracking-wide text-neutral-600">Nível</label>
                  <div className="flex items-center gap-1.5">
                    <p className="font-title font-bold text-lg text-neutral-100">{enemy.level}</p>
                    <div className="flex flex-col">
                      <button onClick={() => persist({ level: enemy.level + 1 })} aria-label="Aumentar nível" className="text-neutral-600 hover:text-white">
                        <ChevronUp size={13} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => persist({ level: Math.max(1, enemy.level - 1) })}
                        aria-label="Diminuir nível"
                        className="-mt-1 text-neutral-600 hover:text-white"
                      >
                        <ChevronDown size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {element && (
              <div className="flex shrink-0 flex-col items-center gap-2 sm:ml-auto">
                <span title={`${element.name} — ${element.epithet}`}>
                  <element.icon size={36} strokeWidth={1.5} style={{ stroke: 'url(#inimigo-element-gradient)' }} />
                </span>
              </div>
            )}
          </div>
        </GlowCard>
      </Reveal>

      <Reveal delay={110} className="mt-10">
        <h2 className="font-title font-semibold text-xl text-neutral-100">Traços</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TRAITS_META.map((trait) => (
            <GlowCard key={trait.key} contentClassName="p-4 text-center">
              <trait.icon size={20} strokeWidth={1.5} className="mx-auto text-neutral-400" />
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <p className="font-title font-bold text-xl text-neutral-100">{enemy[trait.key]}</p>
                <div className="flex flex-col">
                  <button
                    onClick={() => adjustTrait(trait.key, 1)}
                    aria-label={`Aumentar ${trait.label}`}
                    className="text-neutral-600 transition-colors duration-300 hover:text-white"
                  >
                    <ChevronUp size={13} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => adjustTrait(trait.key, -1)}
                    aria-label={`Diminuir ${trait.label}`}
                    className="-mt-1 text-neutral-600 transition-colors duration-300 hover:text-white"
                  >
                    <ChevronDown size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <p className="font-body text-[11px] uppercase tracking-wide text-neutral-500">{trait.label}</p>
            </GlowCard>
          ))}
        </div>
      </Reveal>

      <Reveal delay={160} className="mt-10">
        <h2 className="font-title font-semibold text-xl text-neutral-100">Habilidades</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {abilities.map((a) => {
            const tierMeta = ABILITY_TIERS.find((t) => t.id === a.abilities.type) ?? ABILITY_TIERS[0]
            const efeitoMeta = TIPO_EFEITO_META.find((t) => t.id === a.abilities.tipo_efeito) ?? TIPO_EFEITO_META[0]
            return (
              <GlowCard key={a.ability_id} contentClassName="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-title font-semibold text-neutral-100">{a.abilities.name}</p>
                  <span className="font-body text-xs text-neutral-500">Nv. {a.level}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge label={tierMeta.label} color={tierMeta.color} />
                  <Badge label={efeitoMeta.label} color={efeitoMeta.color} />
                </div>
                {a.abilities.description && (
                  <p className="mt-2 font-body text-sm text-neutral-500 leading-relaxed">{a.abilities.description}</p>
                )}
                <button
                  onClick={() => removeAbility(a.ability_id)}
                  className="mt-3 flex items-center gap-1 font-body text-[11px] text-neutral-600 transition-colors duration-300 hover:text-red-400"
                >
                  <Trash2 size={11} strokeWidth={1.75} /> Remover
                </button>
              </GlowCard>
            )
          })}
          <AddAbilityCard onAdd={addAbility} />
        </div>
      </Reveal>

      <Reveal delay={210} className="mb-4 mt-10 border-t border-neutral-900 pt-6">
        <h2 className="font-title font-semibold text-xl text-neutral-100">Instanciar em combate</h2>
        <p className="mt-1 font-body text-sm text-neutral-500">Cria uma cópia rastreável deste inimigo pra usar numa luta.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={instanceLabel}
            onChange={(e) => setInstanceLabel(e.target.value)}
            placeholder="rótulo (opcional, ex: Bruxa Elite #2)"
            className={`${inputClass} max-w-xs`}
          />
          <button onClick={instantiate} className="shrink-0 rounded bg-white px-4 py-2 font-body text-sm font-semibold text-neutral-950">
            Instanciar
          </button>
        </div>
      </Reveal>
    </div>
  )
}
