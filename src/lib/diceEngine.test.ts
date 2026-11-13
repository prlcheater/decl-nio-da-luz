import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ABILITY_TIER_CONFIG,
  MAX_LEVEL,
  calculateDamage,
  calculateEpMax,
  calculateHpMax,
  calculateMitigation,
  createSeededRandom,
  damageSeverity,
  energyCost,
  isAbilityAvailable,
  parseDiceNotation,
  poolSizeForStatus,
  resetRandomSource,
  resolveTest,
  rollDie,
  rollPool,
  roundsUntilAvailable,
  setRandomSource,
  statPointsAvailable,
} from './diceEngine'

// RNG fixo para resultados determinísticos: value ≈ 0 ⇒ menor rolagem (1);
// value ≈ 1 ⇒ maior rolagem (sides).
const alwaysMin = () => 0
const alwaysMax = () => 0.999999

describe('RNG injetável', () => {
  afterEach(() => resetRandomSource())

  it('usa a fonte injetada', () => {
    setRandomSource(alwaysMax)
    expect(rollDie(20)).toBe(20)
    setRandomSource(alwaysMin)
    expect(rollDie(20)).toBe(1)
    expect(rollPool(3, 6)).toEqual([1, 1, 1])
  })

  it('createSeededRandom é reproduzível por semente', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true)
  })
})

describe('tamanho do conjunto de dados', () => {
  it('pool(status) = min(6, floor(status/4) + 1)', () => {
    expect(poolSizeForStatus(0)).toBe(1)
    expect(poolSizeForStatus(3)).toBe(1)
    expect(poolSizeForStatus(4)).toBe(2)
    expect(poolSizeForStatus(8)).toBe(3)
    expect(poolSizeForStatus(20)).toBe(6)
    expect(poolSizeForStatus(1000)).toBe(6)
    expect(poolSizeForStatus(-5)).toBe(1)
  })
})

describe('resolveTest', () => {
  beforeEach(() => setRandomSource(alwaysMax))
  afterEach(() => resetRandomSource())

  it('teste regular usa o pool do traço e soma o modificador', () => {
    const r = resolveTest({ status: 8, difficulty: 'regular' })
    expect(r.rolls).toHaveLength(3)
    expect(r.kept).toBe(20)
    expect(r.modifier).toBe(8)
    expect(r.total).toBe(28)
    expect(r.critico).toBe(true)
  })

  it('dificuldade severa reduz o pool e o modificador', () => {
    const r = resolveTest({ status: 8, difficulty: 'severa' })
    expect(r.rolls).toHaveLength(1)
    expect(r.modifier).toBe(0)
  })

  it('resultado 1 marca falha crítica; nunca fica abaixo de 1 dado', () => {
    setRandomSource(alwaysMin)
    const r = resolveTest({ status: 0, difficulty: 'severa' })
    expect(r.rolls).toHaveLength(1)
    expect(r.kept).toBe(1)
    expect(r.falhaCritica).toBe(true)
    expect(r.modifier).toBe(-8)
    expect(r.total).toBe(-7)
  })
})

describe('notação livre de dados', () => {
  it('interpreta contagem, lados, keep-highest e modificador', () => {
    expect(parseDiceNotation('2d20kh1+3')).toEqual({ count: 2, sides: 20, keepHighest: 1, modifier: 3 })
    expect(parseDiceNotation('1d6')).toEqual({ count: 1, sides: 6, keepHighest: null, modifier: 0 })
    expect(parseDiceNotation('3d8-2')).toEqual({ count: 3, sides: 8, keepHighest: null, modifier: -2 })
  })

  it('rejeita entradas inválidas', () => {
    expect(parseDiceNotation('abc')).toBeNull()
    expect(parseDiceNotation('d20')).toBeNull()
    expect(parseDiceNotation('2x20')).toBeNull()
  })
})

describe('dano de habilidade', () => {
  beforeEach(() => setRandomSource(alwaysMax))
  afterEach(() => resetRandomSource())

  it('nDados = min(200, escalador × 10)', () => {
    expect(calculateDamage({ tier: 'comum', nivelHabilidade: 1, statusEscalador: 4 }).nDados).toBe(40)
    expect(calculateDamage({ tier: 'comum', nivelHabilidade: 1, statusEscalador: 25 }).nDados).toBe(200)
  })

  it('crítico dobra o dano (d20 = 20)', () => {
    const r = calculateDamage({ tier: 'comum', nivelHabilidade: 1, statusEscalador: 4 })
    // 40 dados de d2 no valor máximo (2) = 80, + incremento 3 × nível 1 = 83.
    expect(r.danoDados).toBe(80)
    expect(r.danoBase).toBe(3)
    expect(r.danoTotal).toBe(83)
    expect(r.critico).toBe(true)
    expect(r.danoFinal).toBe(166)
  })

  it('ponto vital dobra junto com o crítico', () => {
    const r = calculateDamage({ tier: 'comum', nivelHabilidade: 1, statusEscalador: 4, pontoVital: true })
    expect(r.danoFinal).toBe(332)
  })
})

describe('mitigação', () => {
  beforeEach(() => setRandomSource(alwaysMax))
  afterEach(() => resetRandomSource())

  it('soma os d10 e o próprio traço e nunca deixa dano negativo', () => {
    const strong = calculateMitigation({ resistance: 4, danoBruto: 200 })
    expect(strong.mitigacao).toBe(24) // 2d10 no máximo (20) + Resistência 4
    expect(strong.danoFinal).toBe(176)
    expect(calculateMitigation({ resistance: 4, danoBruto: 10 }).danoFinal).toBe(0)
  })
})

describe('recursos e progressão', () => {
  it('PV/PE máximos seguem as fórmulas oficiais', () => {
    expect(calculateHpMax({ resistance: 6, level: 10 })).toBe(500 + 6 * 150 + 10 * 10)
    expect(calculateEpMax({ intellect: 5, level: 10 })).toBe(300 + 5 * 100 + 10 * 8)
    expect(MAX_LEVEL).toBe(125)
  })

  it('custo de energia é percentual do PE máximo', () => {
    expect(energyCost('comum', 1000)).toBe(100)
    expect(energyCost('especial', 1000)).toBe(250)
    expect(energyCost('suprema', 1000)).toBe(500)
    expect(ABILITY_TIER_CONFIG.comum.custoEnergiaPct).toBe(0.1)
  })

  it('pontos de status = floor(nível/5) × 2', () => {
    expect(statPointsAvailable(4)).toBe(0)
    expect(statPointsAvailable(5)).toBe(2)
    expect(statPointsAvailable(25)).toBe(10)
  })
})

describe('recarga por rodadas', () => {
  it('comum não tem recarga; especial e suprema contam rodadas', () => {
    expect(isAbilityAvailable({ tier: 'comum', lastUsedRound: 3, currentRound: 3 })).toBe(true)
    expect(isAbilityAvailable({ tier: 'especial', lastUsedRound: 3, currentRound: 3 })).toBe(false)
    expect(isAbilityAvailable({ tier: 'especial', lastUsedRound: 3, currentRound: 4 })).toBe(true)
    expect(roundsUntilAvailable({ tier: 'especial', lastUsedRound: 3, currentRound: 3 })).toBe(1)
    expect(roundsUntilAvailable({ tier: 'suprema', lastUsedRound: null, currentRound: 5 })).toBe(0)
  })
})

describe('severidade do dano flutuante', () => {
  it('classifica pela fração do PV máximo', () => {
    expect(damageSeverity({ amount: 600, hpMax: 1000 }).tier).toBe('vermelho')
    expect(damageSeverity({ amount: 300, hpMax: 1000 }).tier).toBe('laranja')
    expect(damageSeverity({ amount: 150, hpMax: 1000 }).tier).toBe('amarelo')
    expect(damageSeverity({ amount: 50, hpMax: 1000 }).tier).toBe('branco')
  })
})
