// Catálogo de condições de combate (Beta 1.3). Módulo puro (sem React/Supabase).
// Diferente de `abilityDefinition.STATES` (tipos de controle: medo, imobilização,
// silêncio): aqui ficam os efeitos ao longo do tempo ligados ao turno do alvo.
//
// ATENÇÃO: os números abaixo são PROVISÓRIOS e ainda dependem da calibração do
// Paulo (ver ROADMAP/MEMORIA). Centralizados aqui para o motor e o Codex lerem a
// mesma fonte quando a Beta 1.3 for ligada ao combate.

export type ConditionId = 'queimadura' | 'veneno' | 'corrosao' | 'lentidao' | 'foco' | 'regeneracao'

export type ConditionTick = 'inicio_turno' | 'fim_turno' | 'nenhum'

export type ConditionEntry = {
  id: ConditionId
  name: string
  /** Como o efeito se manifesta por turno. */
  kind: 'dano_periodico' | 'debuff' | 'buff'
  /** Atributo afetado, quando for buff/debuff de atributo. */
  attribute: 'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma' | null
  /** Dano periódico como fração do PV máximo do alvo (ex.: 0.05 = 5%). */
  perTurnPctHp: number | null
  /** Modificador fixo por turno, quando aplicável. */
  perTurnAmount: number | null
  /** Quando o efeito "paga" no turno do alvo. */
  tick: ConditionTick
  /** Quantas cópias somam no máximo (renovação acima disso só estende a duração). */
  maxStacks: number
  /** Se o efeito beneficia o portador (aplicável a aliados) ou o prejudica. */
  beneficial: boolean
  description: string
}

export const CONDITIONS: Record<ConditionId, ConditionEntry> = {
  queimadura: {
    id: 'queimadura', name: 'Queimadura', kind: 'dano_periodico', attribute: null,
    perTurnPctHp: 0.05, perTurnAmount: null, tick: 'inicio_turno', maxStacks: 3, beneficial: false,
    description: 'Fogo persistente: sofre dano no início de cada turno.',
  },
  veneno: {
    id: 'veneno', name: 'Veneno', kind: 'dano_periodico', attribute: null,
    perTurnPctHp: 0.04, perTurnAmount: null, tick: 'fim_turno', maxStacks: 4, beneficial: false,
    description: 'Toxina acumulada: sofre dano no fim de cada turno.',
  },
  corrosao: {
    id: 'corrosao', name: 'Corrosão', kind: 'debuff', attribute: 'resistance',
    perTurnPctHp: null, perTurnAmount: -2, tick: 'nenhum', maxStacks: 3, beneficial: false,
    description: 'Reduz Resistência enquanto durar.',
  },
  lentidao: {
    id: 'lentidao', name: 'Lentidão', kind: 'debuff', attribute: 'agility',
    perTurnPctHp: null, perTurnAmount: -2, tick: 'nenhum', maxStacks: 3, beneficial: false,
    description: 'Reduz Agilidade enquanto durar.',
  },
  foco: {
    id: 'foco', name: 'Foco', kind: 'buff', attribute: 'intellect',
    perTurnPctHp: null, perTurnAmount: 2, tick: 'nenhum', maxStacks: 2, beneficial: true,
    description: 'Aumenta Intelecto enquanto durar.',
  },
  regeneracao: {
    id: 'regeneracao', name: 'Regeneração', kind: 'buff', attribute: null,
    perTurnPctHp: 0.05, perTurnAmount: null, tick: 'inicio_turno', maxStacks: 2, beneficial: true,
    description: 'Recupera PV no início de cada turno.',
  },
}

export const CONDITION_IDS = Object.keys(CONDITIONS) as ConditionId[]

/** Dano/cura efetivos de uma condição num turno, dado o PV máximo do alvo. */
export function conditionTickValue(condition: ConditionEntry, hpMax: number): number {
  const pct = condition.perTurnPctHp ? Math.round(condition.perTurnPctHp * hpMax) : 0
  const flat = condition.perTurnAmount ? Math.abs(condition.perTurnAmount) : 0
  return pct + flat
}

/** Agrupa condições por momento de aplicação (início/fim do turno do alvo). */
export function conditionsByTick(tick: ConditionTick): ConditionEntry[] {
  return CONDITION_IDS.map((id) => CONDITIONS[id]).filter((c) => c.tick === tick)
}
