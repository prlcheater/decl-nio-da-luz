import { EFEITO_STATUS_ESCALADOR, type TipoEfeito } from './diceEngine'

export const ATTRIBUTES = { attack: 'Ataque', resistance: 'Resistência', agility: 'Agilidade', intellect: 'Intelecto', charisma: 'Carisma' } as const
export type Attribute = keyof typeof ATTRIBUTES
export const EFFECTS = { dano: 'Dano', cura: 'Cura', escudo: 'Escudo', buff: 'Fortalecimento', debuff: 'Enfraquecimento', controle: 'Controle', purificacao: 'Purificação', preparacao: 'Preparação', movimento: 'Movimentação' } as const
export type EffectKind = keyof typeof EFFECTS
export const STATES = ['medo', 'imobilizacao', 'silencio', 'marca', 'remover_penalidade'] as const
export const ABILITY_ELEMENTS = ['Élix', 'Gaia', 'Galeo', 'Glácis', 'Granite', 'Ignis', 'Marine', 'Umbra', 'Aura'] as const
export type Effect = {
  kind: EffectKind
  scaler: Attribute
  element: string | null
  appliesElement: boolean
  target: 'enemy' | 'ally' | 'self'
  attribute: Attribute | null
  amount: number | null
  duration: number | null
  state: typeof STATES[number] | null
}
export type AbilityDefinition = { version: 1; effects: Effect[] }
export type AbilityConfig = { definition?: AbilityDefinition | null; tipo_efeito: string; combat_enabled?: boolean | null }
export function defaultEffect(kind: EffectKind = 'dano'): Effect {
  return {
    kind, scaler: kind === 'cura' ? 'intellect' : kind === 'escudo' ? 'resistance' : kind === 'movimento' ? 'agility' : 'attack',
    element: null, appliesElement: false,
    target: ['dano', 'debuff', 'controle'].includes(kind) ? 'enemy' : kind === 'movimento' ? 'self' : 'ally',
    attribute: null, amount: null, duration: null, state: null,
  }
}
export function validateDefinition(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Definição ausente.'
  const d = value as AbilityDefinition
  if (d.version !== 1 || !Array.isArray(d.effects) || d.effects.length < 1 || d.effects.length > 8) return 'Informe de 1 a 8 efeitos.'
  for (const e of d.effects) {
    if (!e || !Object.hasOwn(EFFECTS, e.kind) || !Object.hasOwn(ATTRIBUTES, e.scaler)) return 'Efeito ou atributo inválido.'
    if (e.element !== null && !ABILITY_ELEMENTS.includes(e.element as typeof ABILITY_ELEMENTS[number])) return 'Elemento inválido.'
    if (typeof e.appliesElement !== 'boolean' || (e.appliesElement && !e.element)) return 'Aplicação elemental exige elemento.'
    const allowed = ['dano', 'debuff', 'controle'].includes(e.kind) ? ['enemy'] : e.kind === 'movimento' ? ['self'] : ['ally', 'self']
    if (!allowed.includes(e.target)) return 'Alvo incompatível com o efeito.'
    if (e.attribute !== null && !Object.hasOwn(ATTRIBUTES, e.attribute)) return 'Atributo alterado inválido.'
    if (['buff', 'debuff'].includes(e.kind)) {
      if (!e.attribute || !Number.isInteger(e.amount) || e.amount! < 1 || e.amount! > 10) return 'Modificador exige atributo e magnitude de 1 a 10 pontos.'
    } else if (e.attribute !== null || e.amount !== null) return 'Modificador incompatível com o efeito.'
    const timed = e.appliesElement || ['buff', 'debuff', 'controle', 'preparacao'].includes(e.kind)
    if (timed) {
      if (!Number.isInteger(e.duration) || e.duration! < 1 || e.duration! > 20) return 'Informe duração de 1 a 20 turnos do alvo.'
    } else if (e.duration !== null) return 'Este efeito é instantâneo.'
    if (e.kind === 'controle') {
      if (!['medo', 'imobilizacao', 'silencio'].includes(e.state ?? '')) return 'Escolha o controle.'
    } else if (e.kind === 'preparacao') {
      if (e.state !== 'marca') return 'Escolha a marca.'
    } else if (e.kind === 'purificacao') {
      if (e.state !== 'remover_penalidade') return 'Escolha a purificação.'
    } else if (e.state !== null) return 'Condição incompatível.'
  }
  if (d.effects[0].kind === 'movimento' && d.effects.some(e => e.target !== 'self')) return 'Movimentação só permite efeitos pessoais.'
  return null
}
// Efeitos que o motor do servidor resolve (fases 2 e 3). Espelha combat_ability_supported no SQL.
export const COMBAT_SUPPORTED_KINDS: EffectKind[] = ['dano', 'cura', 'escudo', 'buff', 'debuff']
export function isCombatSupported(definition: AbilityDefinition | null | undefined): boolean {
  if (definition == null) return true
  if (validateDefinition(definition)) return false
  // Fase 4: aplicação elemental deixa marca no destinatário e pode reagir (fase 5).
  return definition.effects.every(e => COMBAT_SUPPORTED_KINDS.includes(e.kind))
}
// Utilizável em combate: legada, ou suportada pelo motor E habilitada pelo mestre.
// Rascunhos antigos não viram utilizáveis sozinhos quando o motor ganha suporte.
export function isAbilityReady(ability: AbilityConfig): boolean {
  if (ability.definition == null) return ['dano', 'cura', 'escudo'].includes(ability.tipo_efeito) && ability.combat_enabled !== false
  return isCombatSupported(ability.definition) && ability.combat_enabled === true
}
export function abilityEffects(ability: AbilityConfig): Pick<Effect, 'kind' | 'target' | 'scaler'>[] {
  if (ability.definition) return ability.definition.effects
  const kind = ability.tipo_efeito as EffectKind
  return [{ kind, target: kind === 'dano' ? 'enemy' : 'ally', scaler: abilityScaler(ability) }]
}
// Hostil = tem efeito em adversário; o alvo principal é inimigo e os efeitos de apoio vão a um aliado.
export function abilityTargeting(ability: AbilityConfig): { hostile: boolean; allySupport: boolean } {
  const effects = abilityEffects(ability)
  const hostile = effects.some(e => e.target === 'enemy')
  return { hostile, allySupport: hostile && effects.some(e => e.target === 'ally') }
}
export function abilityScaler(ability: AbilityConfig): Attribute {
  return ability.definition?.effects[0]?.scaler ?? EFEITO_STATUS_ESCALADOR[ability.tipo_efeito as TipoEfeito] ?? 'attack'
}
export function abilitySummary(ability: AbilityConfig): string {
  if (!ability.definition) return 'Escala com ' + ATTRIBUTES[abilityScaler(ability)]
  if (validateDefinition(ability.definition)) return 'Rascunho com definição inválida'
  return ability.definition.effects.map(e => [
    EFFECTS[e.kind], '→ ' + ({ enemy: 'adversário', ally: 'aliado', self: 'usuário' }[e.target]),
    ['dano', 'cura', 'escudo'].includes(e.kind) ? 'potência: ' + ATTRIBUTES[e.scaler] : null,
    e.kind === 'escudo' ? 'barreira separada do PV' : null,
    e.attribute ? (e.kind === 'debuff' ? '−' : '+') + e.amount + ' ' + ATTRIBUTES[e.attribute] : null,
    e.state, e.element, e.appliesElement ? 'aplica marca elemental' : null,
    e.duration ? e.duration + ' turnos do alvo' : null,
  ].filter(Boolean).join(' · ')).join(' / ')
}
