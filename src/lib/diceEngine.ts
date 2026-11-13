// Motor de dados/dano do sistema Declínio da Luz (regras adaptadas por Paulo).
// Módulo puro (sem React/Supabase) pra ficar fácil de testar isoladamente.

export type DifficultyId = 'favoravel' | 'regular' | 'dificil' | 'severa'

export const DIFFICULTIES: { id: DifficultyId; label: string; poolDelta: number; modifier: number }[] = [
  { id: 'favoravel', label: 'Favorável', poolDelta: 1, modifier: 0 },
  { id: 'regular', label: 'Regular', poolDelta: 0, modifier: 0 },
  { id: 'dificil', label: 'Difícil', poolDelta: -1, modifier: -4 },
  { id: 'severa', label: 'Severa', poolDelta: -2, modifier: -8 },
]

// Fonte de aleatoriedade trocável (RNG injetável). Por padrão usa Math.random;
// testes e simulações podem semear para obter resultados reproduzíveis.
export type RandomSource = () => number
let randomSource: RandomSource = Math.random

export function setRandomSource(source: RandomSource) {
  randomSource = source
}

export function resetRandomSource() {
  randomSource = Math.random
}

// Gerador determinístico (mulberry32): mesma semente ⇒ mesma sequência.
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rollDie(sides: number): number {
  return Math.floor(randomSource() * sides) + 1
}

export function rollPool(count: number, sides: number): number[] {
  return Array.from({ length: Math.max(0, count) }, () => rollDie(sides))
}

// pool(status) = min(6, floor(status/4) + 1)
export function poolSizeForStatus(status: number): number {
  return Math.min(6, Math.floor(Math.max(0, status) / 4) + 1)
}

export type TestResult = {
  rolls: number[]
  kept: number
  modifier: number
  total: number
  critico: boolean
  falhaCritica: boolean
}

// Teste de status: NdX kh1 + modificador, com dificuldade aplicada ao pool e a um modificador fixo.
export function resolveTest({ status, difficulty }: { status: number; difficulty: DifficultyId }): TestResult {
  const diff = DIFFICULTIES.find((d) => d.id === difficulty) ?? DIFFICULTIES[1]
  const pool = Math.max(1, poolSizeForStatus(status) + diff.poolDelta)
  const rolls = rollPool(pool, 20)
  const kept = Math.max(...rolls)
  const modifier = status + diff.modifier
  return {
    rolls,
    kept,
    modifier,
    total: kept + modifier,
    critico: kept === 20,
    falhaCritica: kept === 1,
  }
}

export type ParsedRoll = { count: number; sides: number; keepHighest: number | null; modifier: number }

// Parser de notação livre tipo "2d20kh1+3" (mesma sintaxe de um parser tipo Rollem).
export function parseDiceNotation(input: string): ParsedRoll | null {
  const match = /^(\d+)d(\d+)(?:kh(\d+))?([+-]\d+)?$/i.exec(input.trim())
  if (!match) return null
  const [, count, sides, kh, mod] = match
  return {
    count: Number(count),
    sides: Number(sides),
    keepHighest: kh ? Number(kh) : null,
    modifier: mod ? Number(mod) : 0,
  }
}

export type FreeRollResult = { rolls: number[]; kept: number[]; sum: number; modifier: number; total: number }

export function rollFreeText(input: string): FreeRollResult | null {
  const parsed = parseDiceNotation(input)
  if (!parsed) return null
  const rolls = rollPool(parsed.count, parsed.sides)
  const kept = parsed.keepHighest ? [...rolls].sort((a, b) => b - a).slice(0, parsed.keepHighest) : rolls
  const sum = kept.reduce((a, b) => a + b, 0)
  return { rolls, kept, sum, modifier: parsed.modifier, total: sum + parsed.modifier }
}

export type AbilityTier = 'comum' | 'especial' | 'suprema'
export type TipoEfeito = 'dano' | 'cura' | 'escudo'

export const ABILITY_TIER_CONFIG: Record<AbilityTier, { dado: number; incremento: number; custoEnergiaPct: number }> = {
  comum: { dado: 2, incremento: 3, custoEnergiaPct: 0.1 },
  especial: { dado: 4, incremento: 15, custoEnergiaPct: 0.25 },
  suprema: { dado: 8, incremento: 75, custoEnergiaPct: 0.5 },
}

// Qual traço escala a quantidade de dados de cada tipo de efeito. Carisma não escala habilidades.
export const EFEITO_STATUS_ESCALADOR: Record<TipoEfeito, 'attack' | 'intellect' | 'resistance'> = {
  dano: 'attack',
  cura: 'intellect',
  escudo: 'resistance',
}

export function energyCost(tier: AbilityTier, epMax: number): number {
  return Math.round(ABILITY_TIER_CONFIG[tier].custoEnergiaPct * epMax)
}

export type DamageResult = {
  nDados: number
  danoDados: number
  danoBase: number
  danoTotal: number
  critico: boolean
  danoFinal: number
}

// dano_final = (incremento*nivel + soma de N dados do tier) * (crítico?2:1) * (ponto vital?2:1)
export function calculateDamage({
  tier,
  nivelHabilidade,
  statusEscalador,
  pontoVital = false,
}: {
  tier: AbilityTier
  nivelHabilidade: number
  statusEscalador: number
  pontoVital?: boolean
}): DamageResult {
  const config = ABILITY_TIER_CONFIG[tier]
  const nDados = Math.min(200, Math.max(0, statusEscalador) * 10)
  const danoDados = rollPool(nDados, config.dado).reduce((a, b) => a + b, 0)
  const danoBase = config.incremento * nivelHabilidade
  const danoTotal = danoBase + danoDados
  const critico = rollDie(20) === 20
  return { nDados, danoDados, danoBase, danoTotal, critico, danoFinal: danoTotal * (critico ? 2 : 1) * (pontoVital ? 2 : 1) }
}

export type MitigationResult = { rolls: number[]; mitigacao: number; danoFinal: number }

// Reaproveita o motor de dados em modo "soma tudo" (não mantém só o maior).
export function calculateMitigation({ resistance, danoBruto }: { resistance: number; danoBruto: number }): MitigationResult {
  const rolls = rollPool(poolSizeForStatus(resistance), 10)
  const mitigacao = rolls.reduce((a, b) => a + b, 0) + resistance
  return { rolls, mitigacao, danoFinal: Math.max(0, danoBruto - mitigacao) }
}

// Manual do Jogador, seção 2.3.
export const MAX_LEVEL = 125

export function calculateHpMax({ resistance, level }: { resistance: number; level: number }): number {
  return 500 + resistance * 150 + level * 10
}

export function calculateEpMax({ intellect, level }: { intellect: number; level: number }): number {
  return 300 + intellect * 100 + level * 8
}

export function regenPerTurn(epMax: number): number {
  return Math.round(epMax * 0.15)
}

// floor(nível/5) * 2 — pontos de status acumulados disponíveis pra distribuir.
export function statPointsAvailable(level: number): number {
  return Math.floor(level / 5) * 2
}

export type EnemyTier = 'comum' | 'elite' | 'boss'

export const ENEMY_TIER_CONFIG: Record<EnemyTier, { label: string; danoMult: number; vidaMult: number }> = {
  comum: { label: 'Comum', danoMult: 0.7, vidaMult: 1.0 },
  elite: { label: 'Elite', danoMult: 0.9, vidaMult: 1.5 },
  boss: { label: 'Boss', danoMult: 1.1, vidaMult: 3.0 },
}

export type InitiativeResult = { roll: number; bonus: number; total: number }

// Iniciativa = 1d20 + nível cheio (bônus pesado de propósito: quem tem mais
// nível leva vantagem clara, o d20 só decide de verdade entre níveis próximos).
export function rollInitiative(level: number): InitiativeResult {
  const roll = rollDie(20)
  const bonus = Math.max(0, level)
  return { roll, bonus, total: roll + bonus }
}

// Recarga de habilidade contada em RODADAS completas (não turnos brutos) —
// assim escala sozinha com o tamanho da mesa, já que uma rodada já significa
// "todo mundo agiu uma vez", não importa se são 4 ou 12 participantes.
export const ABILITY_COOLDOWN_ROUNDS: Record<AbilityTier, number> = {
  comum: 0,
  especial: 1,
  suprema: 3,
}

export function isAbilityAvailable({
  tier,
  lastUsedRound,
  currentRound,
}: {
  tier: AbilityTier
  lastUsedRound: number | null
  currentRound: number
}): boolean {
  if (lastUsedRound == null) return true
  return currentRound - lastUsedRound >= ABILITY_COOLDOWN_ROUNDS[tier]
}

export function roundsUntilAvailable({
  tier,
  lastUsedRound,
  currentRound,
}: {
  tier: AbilityTier
  lastUsedRound: number | null
  currentRound: number
}): number {
  if (lastUsedRound == null) return 0
  return Math.max(0, ABILITY_COOLDOWN_ROUNDS[tier] - (currentRound - lastUsedRound))
}

export type DamageSeverity = 'branco' | 'amarelo' | 'laranja' | 'vermelho'

// Cor do número de dano flutuante, pela % do PV máximo do alvo (não pelo valor bruto —
// esse varia demais entre nível 1 e 125 pra servir de critério sozinho).
export function damageSeverity({ amount, hpMax }: { amount: number; hpMax: number }): { tier: DamageSeverity; color: string } {
  const pct = hpMax > 0 ? amount / hpMax : 0
  if (pct > 0.5) return { tier: 'vermelho', color: '#dc2626' }
  if (pct > 0.25) return { tier: 'laranja', color: '#f97316' }
  if (pct > 0.1) return { tier: 'amarelo', color: '#facc15' }
  return { tier: 'branco', color: '#f5f5f5' }
}
