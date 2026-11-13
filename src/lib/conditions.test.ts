import { describe, it, expect } from 'vitest'
import { CONDITIONS, CONDITION_IDS, conditionTickValue, conditionsByTick } from './conditions'

describe('catálogo de condições', () => {
  it('cada id do índice aponta para a entrada correspondente', () => {
    expect(CONDITION_IDS.length).toBeGreaterThan(0)
    for (const id of CONDITION_IDS) {
      expect(CONDITIONS[id].id).toBe(id)
      expect(CONDITIONS[id].name.length).toBeGreaterThan(0)
    }
  })

  it('dano periódico usa fração do PV máximo do alvo', () => {
    expect(conditionTickValue(CONDITIONS.queimadura, 1000)).toBe(50)
    expect(conditionTickValue(CONDITIONS.veneno, 1000)).toBe(40)
  })

  it('buff/debuff de atributo conta o modificador fixo (em módulo)', () => {
    expect(conditionTickValue(CONDITIONS.corrosao, 1000)).toBe(2)
    expect(conditionTickValue(CONDITIONS.foco, 1000)).toBe(2)
  })

  it('agrupa por momento do turno do alvo', () => {
    const inicio = conditionsByTick('inicio_turno').map((c) => c.id)
    expect(inicio).toContain('queimadura')
    expect(inicio).toContain('regeneracao')
    expect(conditionsByTick('fim_turno').map((c) => c.id)).toContain('veneno')
  })

  it('marca o que beneficia o portador', () => {
    expect(CONDITIONS.foco.beneficial).toBe(true)
    expect(CONDITIONS.queimadura.beneficial).toBe(false)
  })
})
