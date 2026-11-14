// Tipos do VTT (Beta 1.4): mapa, tokens e a ligacao com o combate.
import type { Target } from './combatTypes'

export type BattleMapRow = {
  id: string
  battle_session_id: string
  name: string | null
  image_url: string | null
  grid_cols: number
  grid_rows: number
}

export type TokenRow = {
  id: string
  battle_session_id: string
  map_id: string
  participant_id: string
  label: string
  x: number
  y: number
  color: string | null
  size: number
  z: number
}

/** Slot de renderizacao: token + alvo de combate correspondente. */
export type VttSlot = { token: TokenRow; target: Target }

export const VTT_DEFAULT_TOKEN_SIZE = 0.06

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
