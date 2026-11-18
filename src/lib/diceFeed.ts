import { supabase } from './supabase'
import type { DifficultyId } from './diceEngine'

export type RollKind = 'teste' | 'livre'
export type RollSource = 'player' | 'npc' | 'enemy'

export type RollRecord = {
  id: string
  created_at: string
  user_id: string
  username: string
  character_id: string | null
  character_name: string | null
  enemy_id: string | null
  source: RollSource
  kind: RollKind
  label: string
  difficulty: DifficultyId | null
  rolls: number[]
  kept: number | null
  modifier: number
  total: number
  critico: boolean
  falha_critica: boolean
}

export type NewRoll = Omit<RollRecord, 'id' | 'created_at'>

const TOPIC = 'dice-feed'
type Listener = (roll: RollRecord) => void
const local = new Set<Listener>()

/** Inscricao local (mesma aba): o overlay aparece sem depender da rede. */
export function subscribeLocalRolls(cb: Listener): () => void {
  local.add(cb)
  return () => { local.delete(cb) }
}

/** Salva no banco, avisa a aba atual e transmite para os demais (o mestre confere). */
export async function publishRoll(input: NewRoll): Promise<void> {
  const { data } = await supabase.from('dice_rolls').insert({
    user_id: input.user_id,
    username: input.username,
    character_id: input.character_id,
    character_name: input.character_name,
    enemy_id: input.enemy_id,
    source: input.source,
    kind: input.kind,
    label: input.label,
    difficulty: input.difficulty,
    rolls: input.rolls,
    kept: input.kept,
    modifier: input.modifier,
    total: input.total,
    critico: input.critico,
    falha_critica: input.falha_critica,
  }).select().single()
  const record: RollRecord = (data as RollRecord | null) ?? { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() }
  for (const cb of local) cb(record)
  void broadcast(record)
}

async function broadcast(record: RollRecord) {
  const channel = supabase.channel(TOPIC)
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve()
    })
  })
  await channel.send({ type: 'broadcast', event: 'roll', payload: record })
  supabase.removeChannel(channel)
}

/** Recebe rolagens de outros clientes. */
export function subscribeRemoteRolls(cb: Listener): () => void {
  const channel = supabase.channel(TOPIC)
  channel.on('broadcast', { event: 'roll' }, ({ payload }) => cb(payload as RollRecord)).subscribe()
  return () => { supabase.removeChannel(channel) }
}

/** Pede ao banco para remover o que passou de 2 dias (best-effort). */
export async function purgeOldRolls(): Promise<void> {
  await supabase.rpc('purge_old_dice_rolls')
}