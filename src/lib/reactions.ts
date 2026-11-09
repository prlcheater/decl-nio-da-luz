// Catálogo de reações elementais. Espelha combat_reaction / combat_reaction_fits do SQL (patch de 10/11).
// Só as "ativas" acontecem no combate; as demais são o plano do BETA-1.1-COMBATE.md, ainda sem efeito.
import type { EffectKind } from './abilityDefinition'

export type ReactionId = 'vaporizacao' | 'derretimento' | 'congelamento' | 'conducao' | 'alastramento' | 'germinacao'

export const ACTIVE_REACTIONS: Record<ReactionId, { name: string; pair: [string, string]; effect: string; fits: EffectKind[] }> = {
  vaporizacao: { name: 'Vaporização', pair: ['Marine', 'Ignis'], effect: '+50% no dano bruto do golpe', fits: ['dano'] },
  derretimento: { name: 'Derretimento', pair: ['Ignis', 'Glácis'], effect: '+50% no dano bruto do golpe', fits: ['dano'] },
  congelamento: { name: 'Congelamento', pair: ['Marine', 'Glácis'], effect: 'Congelado: Agilidade −3 por 1 turno do alvo', fits: ['dano', 'debuff'] },
  conducao: { name: 'Condução', pair: ['Marine', 'Élix'], effect: 'choque salta para até 2 adversários com marca Marine (50% do dano bruto)', fits: ['dano'] },
  alastramento: { name: 'Alastramento', pair: ['Ignis', 'Galeo'], effect: 'fogo atinge até 2 outros adversários (25% do dano bruto)', fits: ['dano'] },
  germinacao: { name: 'Germinação', pair: ['Marine', 'Gaia'], effect: '+50% na cura do aliado', fits: ['cura'] },
}

export function reactionBetween(a: string, b: string): ReactionId | null {
  for (const [id, r] of Object.entries(ACTIVE_REACTIONS) as [ReactionId, (typeof ACTIVE_REACTIONS)[ReactionId]][]) {
    if ((r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a)) return id
  }
  return null
}

// Reação que um efeito com aplicação elemental disparia num alvo com estas marcas (da mesma equipe).
// Mesma escolha do servidor: a marca mais antiga elegível.
export function predictReaction(
  effect: { kind: EffectKind; element: string | null; appliesElement: boolean },
  marksOldestFirst: string[],
): ReactionId | null {
  if (!effect.appliesElement || !effect.element) return null
  for (const mark of marksOldestFirst) {
    if (mark === effect.element) continue
    const id = reactionBetween(mark, effect.element)
    if (id && ACTIVE_REACTIONS[id].fits.includes(effect.kind)) return id
  }
  return null
}
