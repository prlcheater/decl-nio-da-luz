// Tipos compartilhados do combate: linhas de tabela e o resultado das RPCs
// (combat_use_ability / combat_next_turn). Extraídos de Combate.tsx para reuso
// (ex.: futura arena/VTT) sem duplicação.
import type { Attribute, AbilityDefinition } from './abilityDefinition'
import type { ReactionId } from './reactions'
import type { AbilityTier, DamageSeverity, EnemyTier, TipoEfeito } from './diceEngine'

export type BattleRow = {
  id: string
  name: string | null
  status: 'setup' | 'active' | 'ended'
  round_number: number
  current_turn_index: number
  execution_test?: boolean
}

export type EffectRow = {
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

export type ReactionInfo = { name: ReactionId; consumed: string; element: string; secondary: ActionEffect[] }

export type ActionEffect = {
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

export type ActionResult = {
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

export type ActionRow = { id: string; kind: 'ability' | 'turn'; round_number: number; created_at: string; result: ActionResult & { ended?: string; expired?: { kind: string; attribute: string; element?: string | null; label?: string | null }[] } }

export type ParticipantRow = {
  id: string
  battle_session_id: string
  character_id: string | null
  enemy_instance_id: string | null
  name: string
  side: 'aliado' | 'inimigo'
  initiative_total: number
}

export type CharacterData = {
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

export type EnemyDef = {
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

export type EnemyInstanceData = {
  id: string
  enemy_id: string
  status: 'active' | 'defeated'
  hp_current: number
  ep_current: number
  enemies: EnemyDef
}

export type AbilityRow = {
  ability_id: string
  level: number
  abilities: { name: string; description: string | null; type: AbilityTier; tipo_efeito: TipoEfeito; definition?: AbilityDefinition | null; combat_enabled?: boolean | null }
}

export type CooldownRow = { ability_id: string; last_used_round: number }

export type Target = {
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

export type DamageToast = {
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

export type RollToast = {
  id: string
  kind: 'roll'
  actorLabel: string
  traitLabel: string
  total: number
  critico: boolean
  falhaCritica: boolean
}

export type CombatToast = DamageToast | RollToast

// Omit não distribui sobre union por padrão (keyof de um union vira interseção
// das chaves) — sem isso, o literal de RollToast/DamageToast perde a checagem.
export type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never
