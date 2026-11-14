import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Circle, Group, Image as KonvaImage, Layer, Ring, Stage, Text as KonvaText } from 'react-konva'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { ENEMY_TIER_CONFIG, calculateEpMax, calculateHpMax, damageSeverity, resolveTest } from '@/lib/diceEngine'
import { clamp01, type BattleMapRow, type TokenRow } from '@/lib/vttTypes'
import VttSetup from '@/components/vtt/VttSetup'
import VttActionPanel from '@/components/vtt/VttActionPanel'
import type { AbilityRow, ActionResult, BattleRow, CharacterData, CooldownRow, EffectRow, EnemyInstanceData, ParticipantRow, Target } from '@/lib/combatTypes'

const SIDE_COLOR: Record<'aliado' | 'inimigo', string> = { aliado: '#38bdf8', inimigo: '#f87171' }
const TRAIT_LABEL: Record<'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma', string> = { attack: 'Ataque', resistance: 'Resistência', agility: 'Agilidade', intellect: 'Intelecto', charisma: 'Carisma' }

// Multiplicador de vida por tier com fallback (tier inesperado não derruba a tela).
function vidaMult(tier: string): number {
  const cfg = (ENEMY_TIER_CONFIG as Record<string, { vidaMult: number }>)[tier]
  return cfg ? cfg.vidaMult : 1
}

type DmgToast = { id: string; targetId: string; amount: number; color: string; label: string }

function useLoadedImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) { setImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    return () => { img.onload = null; img.onerror = null }
  }, [url])
  return image
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize({ width: Math.round(box.width), height: Math.round(box.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}

function HudPortrait({ url, name }: { url: string | null; name: string }) {
  return url
    ? <img src={url} alt="" className="h-full w-full object-cover" />
    : <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">{name.slice(0, 2).toUpperCase()}</span>
}

export default function Vtt() {
  const { session, isMestre, loading: authLoading } = useAuth()
  const [battle, setBattle] = useState<BattleRow | null | undefined>(undefined)
  const [map, setMap] = useState<BattleMapRow | null>(null)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [charactersById, setCharactersById] = useState<Record<string, CharacterData>>({})
  const [instancesById, setInstancesById] = useState<Record<string, EnemyInstanceData>>({})
  const [effects, setEffects] = useState<EffectRow[]>([])
  const [abilities, setAbilities] = useState<AbilityRow[]>([])
  const [cooldowns, setCooldowns] = useState<CooldownRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<DmgToast[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>()
  const mapImage = useLoadedImage(map?.image_url ?? null)
  useEffect(() => {
    let active = true
    async function run() {
      const { data: battleRow } = await supabase
        .from('battle_sessions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (!battleRow) {
        setBattle(null); setMap(null); setTokens([]); setParticipants([])
        setCharactersById({}); setInstancesById({})
        return
      }
      setBattle(battleRow as BattleRow)
      const [{ data: mapRow }, { data: tokenRows }, { data: partRows }] = await Promise.all([
        supabase.from('battle_maps').select('*').eq('battle_session_id', battleRow.id).maybeSingle(),
        supabase.from('battle_tokens').select('*').eq('battle_session_id', battleRow.id).order('z', { ascending: true }),
        supabase.from('battle_participants').select('id, battle_session_id, character_id, enemy_instance_id, name, side, initiative_total').eq('battle_session_id', battleRow.id),
      ])
      if (!active) return
      setMap((mapRow as BattleMapRow | null) ?? null)
      setTokens((tokenRows as TokenRow[]) ?? [])
      const parts = (partRows as ParticipantRow[]) ?? []
      setParticipants(parts)
      const charIds = parts.map((p) => p.character_id).filter((v): v is string => !!v)
      const instIds = parts.map((p) => p.enemy_instance_id).filter((v): v is string => !!v)
      let charRows: CharacterData[] = []
      if (charIds.length) {
        const { data } = await supabase.from('characters').select('id, user_id, name, portrait_url, level, hp_current, ep_current, attack, resistance, agility, intellect, charisma').in('id', charIds)
        charRows = (data as CharacterData[]) ?? []
      }
      let instRows: EnemyInstanceData[] = []
      if (instIds.length) {
        const { data } = await supabase.from('enemy_instances').select('id, enemy_id, status, hp_current, ep_current, enemies(name, portrait_url, tier, level, attack, resistance, agility, intellect, charisma)').in('id', instIds)
        instRows = (data as unknown as EnemyInstanceData[]) ?? []
      }
      if (!active) return
      setCharactersById(Object.fromEntries(charRows.map((c) => [c.id, c] as const)))
      setInstancesById(Object.fromEntries(instRows.map((i) => [i.id, i] as const)))
    }
    run()
    return () => { active = false }
  }, [reloadKey, authLoading])

  const targets = useMemo(() => {
    const out = new Map<string, Target>()
    for (const p of participants) {
      if (p.character_id) {
        const c = charactersById[p.character_id]
        if (!c) continue
        out.set(p.id, { participantId: p.id, label: p.name, side: p.side, kind: 'character', refId: c.id, portraitUrl: c.portrait_url, hpCurrent: c.hp_current, hpMax: calculateHpMax({ resistance: c.resistance, level: c.level }), resistance: c.resistance, marks: [] })
      } else if (p.enemy_instance_id) {
        const i = instancesById[p.enemy_instance_id]
        if (!i) continue
        const mult = vidaMult(i.enemies.tier)
        out.set(p.id, { participantId: p.id, label: p.name, side: p.side, kind: 'enemy', refId: i.id, portraitUrl: i.enemies.portrait_url, hpCurrent: i.hp_current, hpMax: Math.round(calculateHpMax({ resistance: i.enemies.resistance, level: i.enemies.level }) * mult), resistance: i.enemies.resistance, marks: [] })
      }
    }
    return out
  }, [participants, charactersById, instancesById])

  const sorted = useMemo(() => [...participants].sort((a, b) => b.initiative_total - a.initiative_total || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [participants])
  const turnIndex = battle && sorted.length ? battle.current_turn_index % sorted.length : 0
  const currentParticipant = sorted[turnIndex] ?? null

  const myParticipant = participants.find((p) => {
    const c = p.character_id ? charactersById[p.character_id] : null
    return !!c && !!session && c.user_id === session.user.id
  })
  const myChar = myParticipant?.character_id ? charactersById[myParticipant.character_id] : null
  const myTarget = myParticipant ? targets.get(myParticipant.id) ?? null : null
  const myEpMax = myChar ? calculateEpMax({ intellect: myChar.intellect, level: myChar.level }) : 0
  const allies = participants.filter((p) => p.side === 'aliado')
  const enemies = participants.filter((p) => p.side === 'inimigo')
  const canAct = isMestre || (!!currentParticipant && !!myParticipant && currentParticipant.id === myParticipant.id)
  const selectedTarget = selectedId ? targets.get(selectedId) ?? null : null

  const actorChar = currentParticipant?.character_id ? charactersById[currentParticipant.character_id] : null
  const actorEnemy = currentParticipant?.enemy_instance_id ? instancesById[currentParticipant.enemy_instance_id] : null
  const actorEpCurrent = actorChar ? actorChar.ep_current : actorEnemy ? actorEnemy.ep_current : 0
  const actorEpMax = actorChar
    ? calculateEpMax({ intellect: actorChar.intellect, level: actorChar.level })
    : actorEnemy
      ? Math.round(calculateEpMax({ intellect: actorEnemy.enemies.intellect, level: actorEnemy.enemies.level }) * vidaMult(actorEnemy.enemies.tier))
      : 0
  const actorLabel = currentParticipant ? currentParticipant.name : ''

  useEffect(() => {
    if (!battle) { setEffects([]); return }
    let active = true
    supabase.from('battle_effects').select('id, target_participant_id, kind, attribute, amount, remaining_turns, element, label, source_participant_id, updated_at').eq('battle_session_id', battle.id)
      .then(({ data }) => { if (active) setEffects((data as EffectRow[]) ?? []) })
    return () => { active = false }
  }, [battle, reloadKey])

  const currentId = currentParticipant ? currentParticipant.id : null
  const currentEnemyInstanceId = currentParticipant ? currentParticipant.enemy_instance_id : null
  const currentCharacterId = currentParticipant ? currentParticipant.character_id : null
  useEffect(() => {
    if (!currentId) { setAbilities([]); setCooldowns([]); return }
    let active = true
    async function run() {
      let rows: AbilityRow[] = []
      if (currentCharacterId) {
        const { data } = await supabase.from('character_abilities').select('ability_id, level, abilities(name, description, type, tipo_efeito, definition, combat_enabled)').eq('character_id', currentCharacterId)
        rows = (data as unknown as AbilityRow[]) ?? []
      } else if (currentEnemyInstanceId) {
        const inst = instancesById[currentEnemyInstanceId]
        if (inst) {
          const { data } = await supabase.from('enemy_abilities').select('ability_id, level, abilities(name, description, type, tipo_efeito, definition, combat_enabled)').eq('enemy_id', inst.enemy_id)
          rows = (data as unknown as AbilityRow[]) ?? []
        }
      }
      const { data: cd } = await supabase.from('battle_ability_cooldowns').select('ability_id, last_used_round').eq('participant_id', currentId)
      if (!active) return
      setAbilities(rows)
      setCooldowns((cd as CooldownRow[]) ?? [])
    }
    run()
    return () => { active = false }
  }, [currentId, currentCharacterId, currentEnemyInstanceId, instancesById, reloadKey])

  useEffect(() => {
    const channel = supabase.channel('vtt-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_tokens' }, () => setReloadKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_maps' }, () => setReloadKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_sessions' }, () => setReloadKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_effects' }, () => setReloadKey((k) => k + 1))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function canMove(participantId: string): boolean {
    if (isMestre) return true
    const p = participants.find((x) => x.id === participantId)
    const c = p?.character_id ? charactersById[p.character_id] : null
    return !!c && !!session && c.user_id === session.user.id
  }

  async function moveToken(token: TokenRow, nx: number, ny: number) {
    const x = clamp01(nx)
    const y = clamp01(ny)
    setTokens((prev) => prev.map((t) => (t.id === token.id ? { ...t, x, y } : t)))
    await supabase.rpc('vtt_move_token', { p_token_id: token.id, p_x: x, p_y: y })
  }

  function onTokenClick(participantId: string) {
    if (!canAct) { setNotice('Aguarde o seu turno.'); return }
    setNotice(null)
    setSelectedId(participantId)
  }

  function pushToasts(result: ActionResult) {
    const list: DmgToast[] = []
    for (const e of result.effects) {
      if (e.kind === 'dano' && (e.hp_loss ?? 0) > 0) {
        const hpMax = e.hp_max ?? targets.get(e.target)?.hpMax ?? 1
        const sev = damageSeverity({ amount: e.hp_loss ?? 0, hpMax })
        list.push({ id: crypto.randomUUID(), targetId: e.target, amount: e.hp_loss ?? 0, color: sev.color, label: e.target_name })
      }
    }
    if (!list.length) return
    setToasts((prev) => [...prev, ...list])
    const ids = new Set(list.map((l) => l.id))
    setTimeout(() => setToasts((prev) => prev.filter((t) => !ids.has(t.id))), 4200)
  }

  async function useAbility(ability: AbilityRow, pontoVital: boolean) {
    if (!currentParticipant || !selectedId || busy) return
    setBusy(true)
    setNotice(null)
    const actionId = crypto.randomUUID()
    try {
      const { data, error } = await supabase.rpc('combat_use_ability', {
        p_action_id: actionId,
        p_actor_participant_id: currentParticipant.id,
        p_ability_id: ability.ability_id,
        p_target_participant_id: selectedId,
        p_ally_target_participant_id: null,
        p_ponto_vital: pontoVital,
      })
      if (error) { setNotice('Ação nao realizada: ' + error.message); return }
      pushToasts(data as ActionResult)
      setSelectedId(null)
      setReloadKey((k) => k + 1)
    } finally { setBusy(false) }
  }

  async function nextTurn() {
    if (!battle || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('combat_next_turn', { p_battle_id: battle.id, p_expected_index: battle.current_turn_index })
      if (error) setNotice('Nao foi possivel passar o turno: ' + error.message)
      setSelectedId(null)
      setReloadKey((k) => k + 1)
    } finally { setBusy(false) }
  }

  function rollTrait(label: string, status: number) {
    const r = resolveTest({ status, difficulty: 'regular' })
    const flag = r.critico ? ' (crítico)' : r.falhaCritica ? ' (falha crítica)' : ''
    setNotice(label + ': ' + r.total + flag + ' · dados ' + r.rolls.join(', '))
  }
  function actorTrait(key: 'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma'): number {
    if (actorChar) return actorChar[key]
    if (actorEnemy) return actorEnemy.enemies[key]
    return 0
  }

  const onDone = () => setReloadKey((k) => k + 1)

  if (authLoading || battle === undefined) return null

  if (!battle) {
    if (isMestre) return <VttSetup mode="create" onDone={onDone} />
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-title font-bold text-3xl">Mesa de combate</h1>
        <p className="mt-3 font-body text-neutral-400">Nenhum combate ativo no momento. O mestre prepara a mesa.</p>
        <Link to="/player" className="mt-6 inline-flex rounded-md bg-white px-6 py-3 font-body text-sm font-semibold text-neutral-950">Voltar</Link>
      </div>
    )
  }

  if (isMestre && !map) {
    return <VttSetup mode="map" battleId={battle.id} onDone={onDone} />
  }  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-title font-bold text-xl">Mesa de combate</h1>
          <p className="font-body text-xs text-neutral-400">Rodada {battle.round_number} · Turno de {currentParticipant ? currentParticipant.name : '-'}</p>
        </div>
        <div className="flex items-center gap-3">
          {canAct && (
            <button onClick={nextTurn} disabled={busy} className="rounded bg-white px-3 py-1.5 font-body text-xs font-semibold text-neutral-950 disabled:opacity-50">
              {isMestre ? 'Proximo turno' : 'Encerrar meu turno'}
            </button>
          )}
          <Link to="/player" className="font-body text-xs text-neutral-500 hover:text-white">Voltar</Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {sorted.map((p, i) => (
          <span key={p.id} className={'rounded-full border px-2 py-0.5 font-body text-[11px] ' + (i === turnIndex ? 'border-amber-300 text-amber-200' : 'border-neutral-700 text-neutral-400')}>
            {i + 1}. {p.name}
          </span>
        ))}
      </div>

      {canAct && currentParticipant && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-body text-[11px] text-neutral-500">Testar traço:</span>
          {(['attack', 'resistance', 'agility', 'intellect', 'charisma'] as const).map((k) => (
            <button key={k} onClick={() => rollTrait(TRAIT_LABEL[k], actorTrait(k))} className="rounded border border-neutral-700 px-2 py-0.5 font-body text-[11px] text-neutral-300 hover:border-neutral-500">
              {TRAIT_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      {notice && <p role="status" className="mb-2 font-body text-sm text-amber-200">{notice}</p>}

      <div ref={containerRef} className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
        <Stage width={size.width} height={size.height}>
          <Layer>
            {mapImage
              ? <KonvaImage image={mapImage} width={size.width} height={size.height} />
              : <KonvaText text="Sem mapa - o mestre ainda nao enviou uma imagem." x={16} y={16} fill="#737373" fontSize={14} />}
            {tokens.map((t) => {
              const target = targets.get(t.participant_id) ?? null
              const cx = t.x * size.width
              const cy = t.y * size.height
              const w = Math.max(1, size.width)
              const r = Math.max(14, w * (t.size || 0.06))
              const pct = target && target.hpMax > 0 ? Math.max(0, Math.min(1, target.hpCurrent / target.hpMax)) : 0
              const side = target?.side ?? 'inimigo'
              const isCurrent = !!currentParticipant && currentParticipant.id === t.participant_id
              return (
                <Group
                  key={t.id}
                  x={cx}
                  y={cy}
                  draggable={canMove(t.participant_id)}
                  onClick={() => onTokenClick(t.participant_id)}
                  onTap={() => onTokenClick(t.participant_id)}
                  onDragEnd={(e) => moveToken(t, e.target.x() / w, e.target.y() / Math.max(1, size.height))}
                >
                  <Circle radius={r + 6} fill="#0a0a0a" opacity={0.5} />
                  <Circle radius={r} fill={t.color ?? SIDE_COLOR[side]} opacity={0.92} stroke="#0a0a0a" strokeWidth={2} />
                  <Ring innerRadius={r + 2} outerRadius={r + 6} stroke={side === 'aliado' ? '#38bdf8' : '#ef4444'} strokeWidth={3} rotation={-90} angle={pct * 360} opacity={0.95} />
                  {isCurrent && <Ring innerRadius={r + 9} outerRadius={r + 13} stroke="#fde047" strokeWidth={3} opacity={0.95} />}
                  {selectedId === t.participant_id && <Ring innerRadius={r + 9} outerRadius={r + 13} stroke="#ffffff" strokeWidth={3} opacity={0.95} />}
                  <KonvaText text={t.label} x={-r - 24} y={r + 6} width={r * 2 + 48} align="center" fontSize={11} fill="#e5e5e5" />
                  {effects.filter((e) => e.kind === 'marca' && e.target_participant_id === t.participant_id).map((e, mi) => (
                    <Circle key={e.id} x={-r + 4 + mi * 10} y={-r - 8} radius={4} fill="#22d3ee" stroke="#0a0a0a" strokeWidth={1} />
                  ))}
                </Group>
              )
            })}
          </Layer>
        </Stage>

        {toasts.map((t) => {
          const tk = tokens.find((x) => x.participant_id === t.targetId)
          if (!tk) return null
          return (
            <div key={t.id} className="pointer-events-none absolute z-40 font-title text-3xl font-bold" style={{ left: tk.x * size.width, top: tk.y * size.height - 24, color: t.color, transform: 'translate(-50%, -50%)', textShadow: '0 0 10px #000' }}>
              {t.amount}
            </div>
          )
        })}

        {myTarget && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-3 rounded-xl border border-sky-500/40 bg-neutral-950/80 p-2 pr-4 backdrop-blur">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-sky-400/60 bg-neutral-900">
              <HudPortrait url={myTarget.portraitUrl} name={myTarget.label} />
            </div>
            <div className="min-w-[120px]">
              <p className="font-body text-xs text-neutral-200">{myTarget.label}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-red-500" style={{ width: String(myTarget.hpMax > 0 ? (myTarget.hpCurrent / myTarget.hpMax) * 100 : 0) + '%' }} />
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-sky-400" style={{ width: String(myEpMax > 0 && myChar ? (myChar.ep_current / myEpMax) * 100 : 0) + '%' }} />
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute right-3 top-3 z-20 flex max-w-[45%] flex-col items-end gap-1">
          {enemies.map((p) => {
            const t = targets.get(p.id)
            return (
              <div key={p.id} className={'flex items-center gap-2 rounded-lg border bg-neutral-950/75 px-2 py-1 backdrop-blur ' + (currentParticipant && currentParticipant.id === p.id ? 'border-amber-300' : 'border-red-500/30')}>
                <div className="h-7 w-7 overflow-hidden rounded-full border border-red-400/50 bg-neutral-900">
                  <HudPortrait url={t ? t.portraitUrl : null} name={p.name} />
                </div>
                <div className="min-w-[70px] text-right">
                  <p className="font-body text-[11px] text-neutral-200">{p.name}</p>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full bg-red-500" style={{ width: String(t && t.hpMax > 0 ? (t.hpCurrent / t.hpMax) * 100 : 0) + '%' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[60%] flex-wrap gap-1.5">
          {allies.map((p) => {
            const t = targets.get(p.id)
            return (
              <div key={p.id} className={'flex items-center gap-2 rounded-lg border bg-neutral-950/75 px-2 py-1 backdrop-blur ' + (currentParticipant && currentParticipant.id === p.id ? 'border-amber-300' : 'border-neutral-700')}>
                <div className="h-8 w-8 overflow-hidden rounded-full border border-neutral-600 bg-neutral-900">
                  <HudPortrait url={t ? t.portraitUrl : null} name={p.name} />
                </div>
                <div className="min-w-[74px]">
                  <p className="font-body text-[11px] text-neutral-200">{p.name}</p>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full bg-emerald-400" style={{ width: String(t && t.hpMax > 0 ? (t.hpCurrent / t.hpMax) * 100 : 0) + '%' }} />
                  </div>
                  {p.character_id && charactersById[p.character_id] && (
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full bg-sky-400" style={{ width: String((charactersById[p.character_id].ep_current / Math.max(1, calculateEpMax({ intellect: charactersById[p.character_id].intellect, level: charactersById[p.character_id].level }))) * 100) + '%' }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {canAct && selectedTarget && (
          <VttActionPanel
            target={selectedTarget}
            actorLabel={actorLabel}
            abilities={abilities}
            epCurrent={actorEpCurrent}
            epMax={actorEpMax}
            cooldowns={cooldowns}
            currentRound={battle.round_number}
            busy={busy}
            onUse={useAbility}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <p className="mt-3 font-body text-xs text-neutral-500">
        {canAct ? 'Clique no inimigo para atacar ou no aliado para apoiar.' : 'Aguardando o seu turno. Voce pode arrastar o seu personagem.'}
      </p>
    </div>
  )
}