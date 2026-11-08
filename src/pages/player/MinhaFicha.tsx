import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  UserRound,
  Camera,
  Swords,
  Shield,
  Footprints,
  Brain,
  Handshake,
  RotateCcw,
  Shirt,
  Sparkle,
  Backpack,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  CreditCard,
  KeyRound,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import ImageCropModal from '@/components/ImageCropModal'
import { ELEMENTS, CLASSES, GRADIENT_COLORS } from '@/lib/gameData'
import {
  DIFFICULTIES,
  EFEITO_STATUS_ESCALADOR,
  MAX_LEVEL,
  calculateEpMax,
  calculateHpMax,
  calculateDamage,
  energyCost,
  resolveTest,
  rollFreeText,
  statPointsAvailable,
  type AbilityTier,
  type DamageResult,
  type DifficultyId,
  type FreeRollResult,
  type TestResult,
  type TipoEfeito,
} from '@/lib/diceEngine'

const TRAITS_META = [
  { key: 'attack' as const, label: 'Ataque', icon: Swords },
  { key: 'resistance' as const, label: 'Resistência', icon: Shield },
  { key: 'agility' as const, label: 'Agilidade', icon: Footprints },
  { key: 'intellect' as const, label: 'Intelecto', icon: Brain },
  { key: 'charisma' as const, label: 'Carisma', icon: Handshake },
]

const ABILITY_TIERS = [
  { id: 'comum', label: 'Comum', color: '#9ca3af' },
  { id: 'especial', label: 'Especial', color: '#818cf8' },
  { id: 'suprema', label: 'Suprema', color: '#f472b6' },
] as const
type TierId = (typeof ABILITY_TIERS)[number]['id']

const ITEM_CATEGORIES = [
  { id: 'comum', label: 'Regular', color: '#9ca3af' },
  { id: 'raro', label: 'Raro', color: '#3b82f6' },
  { id: 'epico', label: 'Lendário', color: '#a855f7' },
  { id: 'lendario', label: 'Exótico', color: '#eab308' },
] as const
type CategoryId = (typeof ITEM_CATEGORIES)[number]['id']

const TABS = [
  { id: 'status', label: 'Status' },
  { id: 'habilidades', label: 'Habilidades' },
  { id: 'dados', label: 'Dados' },
  { id: 'pericias', label: 'Perícias' },
  { id: 'equipamento', label: 'Equipamento' },
] as const
type TabId = (typeof TABS)[number]['id']

const TIPO_EFEITO_META: { id: TipoEfeito; label: string; color: string }[] = [
  { id: 'dano', label: 'Dano', color: '#dc2626' },
  { id: 'cura', label: 'Cura', color: '#22c55e' },
  { id: 'escudo', label: 'Escudo', color: '#5227FF' },
]

const EQUIPMENT_SLOTS = [
  { id: 'armadura' as const, label: 'Armadura', icon: Shirt },
  { id: 'item_classe' as const, label: 'Item de Classe', icon: Sparkle },
  { id: 'arma' as const, label: 'Arma', icon: Swords },
]

type CharacterRow = {
  id: string
  user_id: string | null
  name: string
  title: string | null
  class_id: string | null
  element_id: string | null
  level: number
  xp_progress: number
  portrait_url: string | null
  hp_base: number
  hp_current: number
  ep_base: number
  ep_current: number
  credits: number
  cifras: number
  attack: number
  resistance: number
  agility: number
  intellect: number
  charisma: number
  classes: { name: string } | null
  elements: { name: string } | null
}

type AbilityRow = {
  ability_id: string
  level: number
  abilities: { name: string; description: string | null; type: string; tipo_efeito: string }
}

type SkillRow = {
  skill_id: string
  skills_passive: { name: string; description: string | null }
}

type EquipmentRow = {
  id: string
  item_id: string
  slot: 'armadura' | 'item_classe' | 'arma' | 'bolsa'
  items: { name: string; category: string } | null
}

const inputClass =
  'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-body text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none'

function CategoryTag({ id, label, color }: { id: string; label: string; color: string }) {
  return (
    <span
      key={id}
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-body text-[10px] uppercase tracking-wide"
      style={{ borderColor: color, color }}
    >
      {label}
    </span>
  )
}

function StatSlider({
  label,
  current,
  base,
  accent,
  onChange,
  onCommit,
  onRestore,
}: {
  label: string
  current: number
  base: number
  accent: string
  onChange: (value: number) => void
  onCommit: () => void
  onRestore: () => void
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-body text-xs uppercase tracking-wide text-neutral-500">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-title font-semibold text-neutral-200">
            {current} <span className="text-neutral-600">/ {base}</span>
          </span>
          <button onClick={onRestore} aria-label={`Restaurar ${label}`} className="text-neutral-600 transition-colors duration-300 hover:text-white">
            <RotateCcw size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={base}
        value={Math.min(current, base)}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={onCommit}
        className="h-8 w-full cursor-pointer"
        style={{ accentColor: accent }}
      />
    </div>
  )
}

export default function MinhaFicha() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isMestre, session, loading: authLoading, signOut } = useAuth()

  const [character, setCharacter] = useState<CharacterRow | null | undefined>(undefined)
  const [abilities, setAbilities] = useState<AbilityRow[]>([])
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [equipment, setEquipment] = useState<EquipmentRow[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('status')

  const canEdit = isMestre
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingPortraitFile, setPendingPortraitFile] = useState<File | null>(null)
  const [hasActiveBattle, setHasActiveBattle] = useState(false)
  const [showNoBattleHint, setShowNoBattleHint] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function checkBattle() {
      const { data } = await supabase.from('battle_sessions').select('id').eq('status', 'active').limit(1).maybeSingle()
      setHasActiveBattle(!!data)
    }
    checkBattle()
    const channel = supabase
      .channel('ficha-battle-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_sessions' }, () => checkBattle())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadCharacter() {
    let query = supabase.from('characters').select('*, classes(name), elements(name)')
    if (id) {
      query = query.eq('id', id)
    } else if (session) {
      query = query.eq('user_id', session.user.id).eq('status', 'active')
    } else {
      setCharacter(null)
      return
    }
    const { data } = await query.maybeSingle()
    setCharacter((data as CharacterRow | null) ?? null)
    if (!data) return

    const [{ data: abilityRows }, { data: skillRows }, { data: equipRows }] = await Promise.all([
      supabase.from('character_abilities').select('ability_id, level, abilities(name, description, type, tipo_efeito)').eq('character_id', data.id),
      supabase.from('character_skills_passive').select('skill_id, skills_passive(name, description)').eq('character_id', data.id),
      supabase.from('character_equipment').select('id, item_id, slot, items(name, category)').eq('character_id', data.id),
    ])
    setAbilities((abilityRows as unknown as AbilityRow[]) ?? [])
    setSkills((skillRows as unknown as SkillRow[]) ?? [])
    setEquipment((equipRows as unknown as EquipmentRow[]) ?? [])
  }

  useEffect(() => {
    if (authLoading) return
    loadCharacter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, session?.user.id])

  if (authLoading || character === undefined) return null
  if (!character) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-title font-semibold text-xl text-neutral-200">Nenhuma ficha encontrada.</p>
        {isMestre && !id && (
          <Link to="/player/minha-ficha/criar" className="mt-4 inline-block font-body text-sm text-neutral-400 hover:text-white">
            Criar minha ficha →
          </Link>
        )}
      </div>
    )
  }

  const element = ELEMENTS.find((el) => el.name === character.elements?.name)
  const elementGradient = element?.gradient ?? [GRADIENT_COLORS[0], GRADIENT_COLORS[2]]
  const classEntry = CLASSES.find((c) => c.name === character.classes?.name)

  const canAct = isMestre || session?.user.id === character.user_id
  const hpMax = calculateHpMax({ resistance: character.resistance, level: character.level })
  const epMax = calculateEpMax({ intellect: character.intellect, level: character.level })
  const pontosDisponiveis =
    statPointsAvailable(character.level) -
    (character.attack + character.resistance + character.agility + character.intellect + character.charisma)

  async function persist(patch: Partial<CharacterRow>) {
    setCharacter((prev) => (prev ? { ...prev, ...patch } : prev))
    const { error } = await supabase.from('characters').update(patch).eq('id', character!.id)
    if (error) {
      // A tela já mostrou o valor novo: recarrega para não exibir o que não foi salvo.
      setSaveError('Não foi possível salvar a última alteração.')
      loadCharacter()
    } else {
      setSaveError(null)
    }
  }

  function handlePortraitChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingPortraitFile(file)
  }

  async function adjustTrait(key: 'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma', delta: number) {
    const next = Math.max(0, character![key] + delta)
    persist({ [key]: next } as Partial<CharacterRow>)
  }

  async function handleDeleteFicha() {
    const { error } = await supabase.rpc('delete_character_with_login', { p_character_id: character!.id })
    if (error) { setSaveError('Não foi possível excluir a ficha.'); return }
    navigate(character!.user_id === null ? '/player/mestre/npcs' : '/player/mestre')
  }

  async function addAbility(name: string, desc: string, tier: TierId, level: number, tipoEfeito: TipoEfeito) {
    const { data: ability } = await supabase
      .from('abilities')
      .insert({ name, description: desc, type: tier, tipo_efeito: tipoEfeito })
      .select('id')
      .single()
    if (!ability) return
    await supabase.from('character_abilities').insert({ character_id: character!.id, ability_id: ability.id, level })
    loadCharacter()
  }

  async function spendEnergy(cost: number) {
    persist({ ep_current: Math.max(0, character!.ep_current - cost) })
  }

  async function applyHeal(amount: number, max: number) {
    persist({ hp_current: Math.min(max, character!.hp_current + amount) })
  }

  async function removeAbility(abilityId: string) {
    await supabase.from('character_abilities').delete().eq('character_id', character!.id).eq('ability_id', abilityId)
    setAbilities((prev) => prev.filter((a) => a.ability_id !== abilityId))
  }

  async function addSkill(name: string, desc: string) {
    const { data: skill } = await supabase.from('skills_passive').insert({ name, description: desc }).select('id').single()
    if (!skill) return
    await supabase.from('character_skills_passive').insert({ character_id: character!.id, skill_id: skill.id })
    loadCharacter()
  }

  async function removeSkill(skillId: string) {
    await supabase.from('character_skills_passive').delete().eq('character_id', character!.id).eq('skill_id', skillId)
    setSkills((prev) => prev.filter((s) => s.skill_id !== skillId))
  }

  async function addEquipment(slot: EquipmentRow['slot'], name: string, category: CategoryId) {
    const { data: item } = await supabase.from('items').insert({ name, category, slot }).select('id').single()
    if (!item) return
    await supabase.from('character_equipment').insert({ character_id: character!.id, item_id: item.id, slot, quantity: 1 })
    loadCharacter()
  }

  async function removeEquipment(rowId: string) {
    await supabase.from('character_equipment').delete().eq('id', rowId)
    setEquipment((prev) => prev.filter((e) => e.id !== rowId))
  }

  return (
    <div className="character-sheet mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {pendingPortraitFile && (
        <ImageCropModal
          file={pendingPortraitFile}
          onCancel={() => setPendingPortraitFile(null)}
          onConfirm={(dataUrl) => {
            persist({ portrait_url: dataUrl })
            setPendingPortraitFile(null)
          }}
        />
      )}

      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="ficha-element-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={elementGradient[0]} />
            <stop offset="100%" stopColor={elementGradient[1]} />
          </linearGradient>
        </defs>
      </svg>

      <Reveal trigger="mount" className="flex flex-wrap items-center justify-between gap-2">
        {canEdit ? (
          <Link to={character.user_id === null ? '/player/mestre/npcs' : '/player/mestre/elementalistas'} className="font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white">
            ← {character.user_id === null ? 'Personagens do Mundo' : 'Todas as fichas'}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          <div className="relative">
            {hasActiveBattle ? (
              <Link
                to="/player/combate"
                className="flex items-center gap-1.5 font-body text-xs font-semibold text-white transition-transform duration-300 hover:scale-105"
              >
                <Swords size={14} strokeWidth={1.75} style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.65))' }} />
                Combate
              </Link>
            ) : (
              <button
                onClick={() => {
                  setShowNoBattleHint(true)
                  setTimeout(() => setShowNoBattleHint(false), 2200)
                }}
                className="flex cursor-not-allowed items-center gap-1.5 font-body text-xs text-neutral-700"
              >
                <Swords size={14} strokeWidth={1.75} />
                Combate
              </button>
            )}
            {showNoBattleHint && (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-body text-[11px] text-neutral-300 shadow-lg">
                Nenhum combate acontecendo no momento.
              </div>
            )}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </Reveal>

      {saveError && <p role="alert" className="mt-3 font-body text-sm text-red-400">{saveError}</p>}

      <HeaderCard
        character={character}
        canEdit={canEdit}
        onSave={persist}
        fileInputRef={fileInputRef}
        onPortraitChange={handlePortraitChange}
        element={element}
        classEntry={classEntry}
      />

      <Reveal trigger="mount" delay={120} className="mt-4">
        <GlowCard contentClassName="grid gap-3 p-4 sm:grid-cols-2 sm:gap-6 sm:p-5">
          <StatSlider
            label="Pontos de Vida"
            current={character.hp_current}
            base={hpMax}
            accent="#dc2626"
            onChange={(v) => setCharacter((c) => (c ? { ...c, hp_current: v } : c))}
            onCommit={() => persist({ hp_current: character.hp_current })}
            onRestore={() => persist({ hp_current: hpMax })}
          />
          <StatSlider
            label="Pontos de Energia"
            current={character.ep_current}
            base={epMax}
            accent="#5227FF"
            onChange={(v) => setCharacter((c) => (c ? { ...c, ep_current: v } : c))}
            onCommit={() => persist({ ep_current: character.ep_current })}
            onRestore={() => persist({ ep_current: epMax })}
          />
        </GlowCard>
      </Reveal>

      <Reveal trigger="mount" delay={30} className="mt-3 grid grid-cols-2 gap-3">
        <CurrencyEditor icon={CreditCard} color="#3b82f6" label="Créditos" value={character.credits} canEdit={canEdit} onSave={(v) => persist({ credits: v })} />
        <CurrencyEditor icon={KeyRound} color="#d4af37" label="Cifras" value={character.cifras} canEdit={canEdit} onSave={(v) => persist({ cifras: v })} />
      </Reveal>

      <Reveal trigger="mount" delay={130} className="mt-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full min-w-0">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-neutral-700 bg-neutral-900/80 p-1 sm:grid-cols-5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)} aria-pressed={activeTab === t.id}
                  className={`min-h-11 rounded-lg px-2 py-2 font-body text-sm font-semibold transition-colors duration-300 ${
                    activeTab === t.id ? 'bg-white text-neutral-950' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {canEdit && activeTab === 'status' && (
            <span className="shrink-0 font-body text-xs text-neutral-500">
              Pontos disponíveis: <span className={pontosDisponiveis < 0 ? 'text-red-400' : 'text-neutral-300'}>{pontosDisponiveis}</span>
            </span>
          )}
        </div>

        {activeTab === 'status' && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {TRAITS_META.map((trait) => (
              <GlowCard key={trait.key} contentClassName="p-4 text-center">
                <trait.icon size={20} strokeWidth={1.5} className="mx-auto text-neutral-400" />
                <div className="mt-2 flex flex-col items-center justify-center gap-2">
                  <p className="font-title font-bold text-xl text-neutral-100">{character[trait.key]}</p>
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        onClick={() => adjustTrait(trait.key, 1)}
                        aria-label={`Aumentar ${trait.label}`}
                        className="text-neutral-600 transition-colors duration-300 hover:text-white"
                      >
                        <ChevronUp size={20} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => adjustTrait(trait.key, -1)}
                        aria-label={`Diminuir ${trait.label}`}
                        className="text-neutral-400 transition-colors duration-300 hover:text-white"
                      >
                        <ChevronDown size={20} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 break-words font-body text-sm text-neutral-300">{trait.label}</p>
              </GlowCard>
            ))}
          </div>
        )}

        {activeTab === 'habilidades' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {abilities.map((a) => (
              <AbilityCard
                key={a.ability_id}
                row={a}
                character={character}
                epMax={epMax}
                canEdit={canEdit}
                canAct={canAct}
                onRemove={() => removeAbility(a.ability_id)}
                onSpendEnergy={spendEnergy}
                onApplyHeal={(amount) => applyHeal(amount, hpMax)}
              />
            ))}
            {canEdit && <AddAbilityCard onAdd={addAbility} />}
            {!canEdit && abilities.length === 0 && (
              <p className="font-body text-sm text-neutral-600">Nenhuma habilidade registrada ainda.</p>
            )}
          </div>
        )}

        {activeTab === 'dados' && (
          <div className="mt-4 flex flex-col gap-8">
            {canAct ? (
              <RollPanel character={character} />
            ) : (
              <p className="font-body text-sm text-neutral-600">Você não tem permissão pra rolar dados nessa ficha.</p>
            )}
          </div>
        )}

        {activeTab === 'pericias' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (
              <GlowCard key={s.skill_id} contentClassName="p-5">
                <p className="font-title font-semibold text-neutral-100">{s.skills_passive.name}</p>
                <p className="mt-1.5 font-body text-sm text-neutral-500 leading-relaxed">{s.skills_passive.description}</p>
                {canEdit && (
                  <button
                    onClick={() => removeSkill(s.skill_id)}
                    className="mt-3 flex items-center gap-1 font-body text-[11px] text-neutral-600 transition-colors duration-300 hover:text-red-400"
                  >
                    <Trash2 size={11} strokeWidth={1.75} /> Remover
                  </button>
                )}
              </GlowCard>
            ))}
            {canEdit && <AddSkillCard onAdd={addSkill} />}
            {!canEdit && skills.length === 0 && <p className="font-body text-sm text-neutral-600">Nenhuma perícia registrada ainda.</p>}
          </div>
        )}

        {activeTab === 'equipamento' && (
          <div className="mt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {EQUIPMENT_SLOTS.map((slotMeta) => {
                const row = equipment.find((e) => e.slot === slotMeta.id)
                return (
                  <EquipmentSlotCard
                    key={slotMeta.id}
                    label={slotMeta.label}
                    icon={slotMeta.icon}
                    item={row?.items ?? null}
                    canEdit={canEdit}
                    onAdd={(name, category) => addEquipment(slotMeta.id, name, category)}
                    onRemove={() => row && removeEquipment(row.id)}
                  />
                )
              })}
            </div>

            <div className="mt-8 border-t border-neutral-800 pt-6">
              <InventorySection
                items={equipment.filter((e) => e.slot === 'bolsa')}
                canEdit={canEdit}
                onAdd={(name, category) => addEquipment('bolsa', name, category)}
                onRemove={removeEquipment}
              />
            </div>
          </div>
        )}
      </Reveal>

      {canEdit && (
        <Reveal trigger="mount" delay={170} className="mt-16 border-t border-neutral-900 pt-6">
          <DeleteFichaButton onDelete={handleDeleteFicha} />
        </Reveal>
      )}
    </div>
  )
}

function CurrencyEditor({
  icon: Icon,
  color,
  label,
  value,
  canEdit,
  onSave,
}: {
  icon: typeof CreditCard
  color: string
  label: string
  value: number
  canEdit: boolean
  onSave: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  return (
    <div className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-neutral-400"><Icon size={18} className="shrink-0" style={{ color }} /><span>{label}</span></div>
      {editing ? <div className="mt-1 flex flex-wrap gap-2">
        <input type="number" aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass} autoFocus />
        <button onClick={() => { onSave(Number(draft) || 0); setEditing(false) }} className="rounded border border-neutral-600 px-2 text-sm">Salvar</button>
        <button onClick={() => setEditing(false)} className="text-sm text-neutral-400">Cancelar</button>
      </div> : canEdit ? <button onClick={() => { setDraft(String(value)); setEditing(true) }} aria-label={"Editar " + label} className="mt-1 flex w-full min-w-0 items-center justify-between gap-2 text-left">
        <span className="break-all font-title text-lg tabular-nums">{value.toLocaleString("pt-BR")}</span><Pencil size={16} className="shrink-0 text-neutral-400" />
      </button> : <p className="mt-1 break-all font-title text-lg tabular-nums">{value.toLocaleString("pt-BR")}</p>}
    </div>
  )
}

function RollResultRow({ label, result }: { label: string; result: TestResult | FreeRollResult }) {
  const isTest = 'critico' in result
  const test = isTest ? (result as TestResult) : null
  const free = !isTest ? (result as FreeRollResult) : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <div>
        <p className="font-body text-xs text-neutral-400">{label}</p>
        <p className="font-body text-[11px] text-neutral-600">
          [{result.rolls.join(', ')}] {test ? `mantém ${test.kept}` : `soma ${free!.sum}`}
          {result.modifier !== 0 && ` ${result.modifier > 0 ? '+' : ''}${result.modifier}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-title text-lg font-bold text-neutral-100">{result.total}</p>
        {test?.critico && <CategoryTag id="crit" label="Sucesso Crítico!" color="#eab308" />}
        {test?.falhaCritica && <CategoryTag id="fail" label="Falha Crítica!" color="#dc2626" />}
      </div>
    </div>
  )
}

function RollPanel({ character }: { character: CharacterRow }) {
  const [difficulty, setDifficulty] = useState<DifficultyId>('regular')
  const [freeText, setFreeText] = useState('')
  const [history, setHistory] = useState<{ label: string; result: TestResult | FreeRollResult }[]>([])

  function rollTrait(trait: (typeof TRAITS_META)[number]) {
    const result = resolveTest({ status: character[trait.key], difficulty })
    setHistory((prev) => [{ label: trait.label, result }, ...prev].slice(0, 3))
  }

  function rollFree() {
    const result = rollFreeText(freeText)
    if (!result) return
    setHistory((prev) => [{ label: freeText, result }, ...prev].slice(0, 3))
    setFreeText('')
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-title font-semibold text-neutral-100">Teste de Status</h3>
        <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-neutral-800 bg-neutral-900/60 p-1 sm:w-auto sm:grid-cols-4">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-300 ${
                difficulty === d.id ? 'bg-white text-neutral-950' : 'text-neutral-400 hover:text-white'
              }`}
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
          className={inputClass}
        />
        <button onClick={rollFree} className="rounded bg-white px-4 py-2 font-body text-xs font-semibold text-neutral-950 sm:shrink-0">
          Rolar
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="font-body text-xs uppercase tracking-wide text-neutral-500">Histórico</p>
          {history.map((h, i) => (
            <RollResultRow key={i} label={h.label} result={h.result} />
          ))}
        </div>
      )}
    </div>
  )
}

function AbilityCard({
  row,
  character,
  epMax,
  canEdit,
  canAct,
  onRemove,
  onSpendEnergy,
  onApplyHeal,
}: {
  row: AbilityRow
  character: CharacterRow
  epMax: number
  canEdit: boolean
  canAct: boolean
  onRemove: () => void
  onSpendEnergy: (cost: number) => void
  onApplyHeal: (amount: number) => void
}) {
  const tier = ABILITY_TIERS.find((t) => t.id === row.abilities.type) ?? ABILITY_TIERS[0]
  const tipoEfeito = (row.abilities.tipo_efeito ?? 'dano') as TipoEfeito
  const efeitoMeta = TIPO_EFEITO_META.find((e) => e.id === tipoEfeito) ?? TIPO_EFEITO_META[0]
  const tierId = row.abilities.type as AbilityTier
  const cost = energyCost(tierId, epMax)
  const insufficientEnergy = character.ep_current < cost

  const [pontoVital, setPontoVital] = useState(false)
  const [result, setResult] = useState<DamageResult | null>(null)
  const [applied, setApplied] = useState(false)

  function use() {
    if (insufficientEnergy) return
    const statusKey = EFEITO_STATUS_ESCALADOR[tipoEfeito]
    const r = calculateDamage({
      tier: tierId,
      nivelHabilidade: row.level,
      statusEscalador: character[statusKey],
      pontoVital,
    })
    setResult(r)
    setApplied(false)
    onSpendEnergy(cost)
  }

  function apply() {
    if (!result) return
    onApplyHeal(result.danoFinal)
    setApplied(true)
  }

  return (
    <GlowCard contentClassName="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-title font-semibold text-neutral-100">{row.abilities.name}</p>
        <span className="font-body text-xs text-neutral-500">Nv. {row.level}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <CategoryTag id={tier.id} label={tier.label} color={tier.color} />
        <CategoryTag id={efeitoMeta.id} label={efeitoMeta.label} color={efeitoMeta.color} />
      </div>
      <p className="mt-2 font-body text-sm text-neutral-500 leading-relaxed">{row.abilities.description}</p>

      {canAct && (
        <div className="mt-3 border-t border-neutral-800 pt-3">
          <label className="flex items-center gap-1.5 font-body text-[11px] text-neutral-500">
            <input type="checkbox" checked={pontoVital} onChange={(e) => setPontoVital(e.target.checked)} />
            Ponto vital identificado?
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={use}
              disabled={insufficientEnergy}
              className="rounded bg-white px-3 py-1.5 font-body text-xs font-semibold text-neutral-950 disabled:opacity-40"
            >
              Usar ({cost} PE)
            </button>
            {insufficientEnergy && <span className="font-body text-[11px] text-red-400">Energia insuficiente</span>}
          </div>
          {result && (
            <div className="mt-3 rounded border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="flex items-center gap-2">
                <p className="font-title text-lg font-bold text-neutral-100">{result.danoFinal}</p>
                <span className="font-body text-[11px] uppercase tracking-wide text-neutral-500">{efeitoMeta.label}</span>
                {result.critico && <CategoryTag id="crit" label="Crítico!" color="#eab308" />}
              </div>
              {tipoEfeito !== 'dano' ? (
                <button
                  onClick={apply}
                  disabled={applied}
                  className="mt-2 font-body text-[11px] text-neutral-400 transition-colors duration-300 hover:text-white disabled:opacity-40"
                >
                  {applied ? 'Aplicado em mim' : 'Aplicar em mim'}
                </button>
              ) : (
                <p className="mt-1 font-body text-[11px] text-neutral-600">Aplique manualmente no alvo.</p>
              )}
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <button
          onClick={onRemove}
          className="mt-3 flex items-center gap-1 font-body text-[11px] text-neutral-600 transition-colors duration-300 hover:text-red-400"
        >
          <Trash2 size={11} strokeWidth={1.75} /> Remover
        </button>
      )}
    </GlowCard>
  )
}

function HeaderCard({
  character,
  canEdit,
  onSave,
  fileInputRef,
  onPortraitChange,
  element,
  classEntry,
}: {
  character: CharacterRow
  canEdit: boolean
  onSave: (patch: Partial<CharacterRow>) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  onPortraitChange: (e: ChangeEvent<HTMLInputElement>) => void
  element: (typeof ELEMENTS)[number] | undefined
  classEntry: (typeof CLASSES)[number] | undefined
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(character.name)
  const [title, setTitle] = useState(character.title ?? '')
  const [xpDraft, setXpDraft] = useState(character.xp_progress)

  useEffect(() => {
    setXpDraft(character.xp_progress)
  }, [character.xp_progress])

  function save() {
    onSave({ name: name.trim() || character.name, title: title.trim() || null })
    setEditing(false)
  }

  return (
    <Reveal trigger="mount" delay={60} className="mt-3">
      <GlowCard contentClassName="p-4 sm:p-6">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
          <div className="relative h-16 w-16 sm:h-24 sm:w-24">
            <div className="h-full w-full overflow-hidden rounded-2xl border border-neutral-600 bg-neutral-900">
              {character.portrait_url ? <img src={character.portrait_url} alt={character.name} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center"><UserRound size={32} className="text-neutral-400" /></div>}
            </div>
            {canEdit && <>
              <button onClick={() => fileInputRef.current?.click()} aria-label="Alterar foto do personagem" className="absolute -bottom-3 -right-2 flex items-center justify-center rounded-full border border-neutral-600 bg-neutral-900 text-white"><Camera size={18} /></button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onPortraitChange} className="hidden" />
            </>}
          </div>
          <div className="min-w-0">
            {editing ? <div className="flex flex-col gap-2">
              <input aria-label="Nome do personagem" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              <input aria-label="Título do personagem" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              <div className="flex flex-wrap gap-2">
                <button onClick={save} className="rounded bg-white px-3 text-neutral-950">Salvar</button>
                <button onClick={() => setEditing(false)} className="rounded border border-neutral-600 px-3">Cancelar</button>
              </div>
            </div> : <>
              <h1 className="break-words font-title text-2xl font-bold leading-tight text-neutral-100 sm:text-3xl">{character.name}</h1>
              {character.title && <p className="mt-2 break-words text-sm leading-relaxed text-neutral-300">{character.title}</p>}
              {canEdit && <button onClick={() => setEditing(true)} className="mt-1 inline-flex items-center gap-2 text-sm text-neutral-300"><Pencil size={16} /> Editar</button>}
            </>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {element && <span className="inline-flex items-center gap-2"><element.icon size={22} style={{ stroke: "url(#ficha-element-gradient)" }} />{element.name}</span>}
          {classEntry && <span className="inline-flex items-center gap-2"><classEntry.icon size={20} className="text-neutral-300" />{classEntry.name}</span>}
        </div>
        <div className="mt-3 border-t border-neutral-800 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="character-xp" className="text-sm text-neutral-300">Nível {character.level} · XP {xpDraft}%</label>
            {canEdit && <div className="flex items-center gap-2">
              <button onClick={() => onSave({ level: Math.max(1, character.level - 1) })} aria-label="Diminuir nível" className="flex items-center justify-center rounded border border-neutral-700"><ChevronDown size={20} /></button>
              <button onClick={() => onSave({ level: Math.min(MAX_LEVEL, character.level + 1) })} aria-label="Aumentar nível" className="flex items-center justify-center rounded border border-neutral-700"><ChevronUp size={20} /></button>
            </div>}
          </div>
          {canEdit ? <input id="character-xp" type="range" min={0} max={100} value={xpDraft}
            onChange={(e) => setXpDraft(Number(e.target.value))}
            onMouseUp={() => onSave({ xp_progress: xpDraft })}
            onTouchEnd={() => onSave({ xp_progress: xpDraft })}
            onKeyUp={() => onSave({ xp_progress: xpDraft })}
            className="h-8 w-full accent-violet-400" />
          : <progress id="character-xp" max={100} value={xpDraft} className="mt-2 h-2 w-full accent-violet-400" />}
        </div>
      </GlowCard>
    </Reveal>
  )
}

function AddAbilityCard({
  onAdd,
}: {
  onAdd: (name: string, desc: string, tier: TierId, level: number, tipoEfeito: TipoEfeito) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tier, setTier] = useState<TierId>('comum')
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
          <select value={tier} onChange={(e) => setTier(e.target.value as TierId)} className={inputClass}>
            {ABILITY_TIERS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select value={tipoEfeito} onChange={(e) => setTipoEfeito(e.target.value as TipoEfeito)} className={inputClass}>
            {TIPO_EFEITO_META.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={10}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className={`${inputClass} w-20`}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="flex-1 rounded bg-white py-1.5 font-body text-xs font-semibold text-neutral-950">Salvar</button>
          <button onClick={() => setOpen(false)} className="rounded border border-neutral-700 px-2.5 py-1.5 font-body text-xs text-neutral-400">Cancelar</button>
        </div>
      </div>
    </GlowCard>
  )
}

function AddSkillCard({ onAdd }: { onAdd: (name: string, desc: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-800 font-body text-sm text-neutral-500 transition-colors duration-300 hover:border-neutral-600 hover:text-white"
      >
        <Plus size={16} strokeWidth={2} />
        Adicionar perícia
      </button>
    )
  }

  function submit() {
    if (!name.trim()) return
    onAdd(name.trim(), desc.trim())
    setName('')
    setDesc('')
    setOpen(false)
  }

  return (
    <GlowCard contentClassName="p-5">
      <div className="flex flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da perícia" className={inputClass} />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" rows={2} className={inputClass} />
        <div className="flex gap-2">
          <button onClick={submit} className="flex-1 rounded bg-white py-1.5 font-body text-xs font-semibold text-neutral-950">Salvar</button>
          <button onClick={() => setOpen(false)} className="rounded border border-neutral-700 px-2.5 py-1.5 font-body text-xs text-neutral-400">Cancelar</button>
        </div>
      </div>
    </GlowCard>
  )
}

function EquipmentSlotCard({
  label,
  icon: Icon,
  item,
  canEdit,
  onAdd,
  onRemove,
}: {
  label: string
  icon: typeof Shirt
  item: { name: string; category: string } | null
  canEdit: boolean
  onAdd: (name: string, category: CategoryId) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CategoryId>('comum')

  function confirm() {
    if (!name.trim()) return
    onAdd(name.trim(), category)
    setName('')
    setCategory('comum')
    setEditing(false)
  }

  const categoryMeta = item ? ITEM_CATEGORIES.find((c) => c.id === item.category) : null

  return (
    <GlowCard contentClassName="p-5 text-center">
      <Icon size={22} strokeWidth={1.5} className="mx-auto text-neutral-400" />
      <p className="mt-2 font-body text-xs uppercase tracking-wide text-neutral-500">{label}</p>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2 text-left">
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className={`${inputClass} py-1.5 text-xs`}>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do item" className={`${inputClass} py-1.5 text-xs`} />
          <div className="flex gap-2">
            <button onClick={confirm} className="flex-1 rounded bg-white py-1.5 font-body text-xs font-semibold text-neutral-950">Salvar</button>
            <button onClick={() => setEditing(false)} className="rounded border border-neutral-700 px-2.5 py-1.5 font-body text-xs text-neutral-400">Cancelar</button>
          </div>
        </div>
      ) : item ? (
        <div className="mt-2">
          {categoryMeta && <CategoryTag id={categoryMeta.id} label={categoryMeta.label} color={categoryMeta.color} />}
          <p className="mt-1.5 font-title font-semibold text-neutral-100">{item.name}</p>
          {canEdit && (
            <div className="mt-2 flex justify-center gap-3">
              <button onClick={() => setEditing(true)} className="font-body text-[11px] text-neutral-500 hover:text-white">Trocar</button>
              <button onClick={onRemove} className="font-body text-[11px] text-neutral-500 hover:text-red-400">Remover</button>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <button onClick={() => setEditing(true)} className="mx-auto mt-2 flex items-center gap-1 font-body text-sm text-neutral-500 hover:text-white">
          <Plus size={14} strokeWidth={2} /> Adicionar item
        </button>
      ) : (
        <p className="mt-1 font-body text-sm text-neutral-600">Vazio</p>
      )}
    </GlowCard>
  )
}

function InventorySection({
  items,
  canEdit,
  onAdd,
  onRemove,
}: {
  items: EquipmentRow[]
  canEdit: boolean
  onAdd: (name: string, category: CategoryId) => void
  onRemove: (rowId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CategoryId>('comum')

  function submit() {
    if (!name.trim()) return
    onAdd(name.trim(), category)
    setName('')
    setCategory('comum')
    setAdding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-title font-semibold text-xl text-neutral-100">Inventário</h2>
        {canEdit && (
          <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 font-body text-xs text-neutral-400 hover:text-white">
            <Plus size={14} strokeWidth={2} /> Adicionar item
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 sm:flex-row sm:items-center">
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className={`${inputClass} sm:w-40`}>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do item" className={`${inputClass} flex-1`} />
          <button onClick={submit} className="rounded bg-white px-3 py-2 font-body text-xs font-semibold text-neutral-950">Adicionar</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-neutral-800 p-5">
          <Backpack size={20} strokeWidth={1.5} className="text-neutral-600" />
          <p className="font-body text-sm text-neutral-600">Bolsa vazia.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 min-[380px]:grid-cols-2 sm:grid-cols-4">
          {items.map((row) => {
            const meta = ITEM_CATEGORIES.find((c) => c.id === row.items?.category)
            return (
              <div key={row.id} className="group relative rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-center">
                {canEdit && (
                  <button
                    onClick={() => onRemove(row.id)}
                    aria-label={`Remover ${row.items?.name}`}
                    className="mb-2 ml-auto flex items-center justify-center rounded border border-neutral-700 text-neutral-400 hover:text-red-400"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
                {meta && <CategoryTag id={meta.id} label={meta.label} color={meta.color} />}
                <p className="mt-1.5 font-body text-xs text-neutral-300">{row.items?.name}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DeleteFichaButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 font-body text-xs text-neutral-600 transition-colors duration-300 hover:text-red-400">
        <Trash2 size={13} strokeWidth={1.75} /> Excluir ficha
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-body text-xs text-neutral-400">Excluir essa ficha de vez?</span>
      <button onClick={onDelete} className="rounded bg-red-500/90 px-3 py-1.5 font-body text-xs font-semibold text-white hover:bg-red-500">Sim, excluir</button>
      <button onClick={() => setConfirming(false)} className="rounded border border-neutral-700 px-3 py-1.5 font-body text-xs text-neutral-400 hover:text-white">Cancelar</button>
    </div>
  )
}
