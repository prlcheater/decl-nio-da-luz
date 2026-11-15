import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Info, Maximize, Minimize } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Circle, Group, Image as KonvaImage, Layer, Ring, Stage, Text as KonvaText } from 'react-konva'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { ENEMY_TIER_CONFIG, calculateEpMax, calculateHpMax, damageSeverity, resolveTest } from '@/lib/diceEngine'
import { clamp01, type BattleMapRow, type TokenRow } from '@/lib/vttTypes'
import VttSetup from '@/components/vtt/VttSetup'
import VttActionPanel from '@/components/vtt/VttActionPanel'
import type { AbilityRow, ActionResult, BattleRow, CharacterData, CooldownRow, EffectRow, EnemyInstanceData, ParticipantRow, Target } from '@/lib/combatTypes'

const ALLY_RING = { color: '#38bdf8', glow: '#0ea5e9' }
const ENEMY_RING: Record<string, { color: string; glow: string }> = {
  comum: { color: '#fca5a5', glow: '#f87171' },
  elite: { color: '#ef4444', glow: '#dc2626' },
  boss: { color: '#ff2d2d', glow: '#ff0000' },
}
const TRAIT_LABEL: Record<'attack' | 'resistance' | 'agility' | 'intellect' | 'charisma', string> = { attack: 'Ataque', resistance: 'Resistência', agility: 'Agilidade', intellect: 'Intelecto', charisma: 'Carisma' }

// Multiplicador de vida por tier com fallback (tier inesperado não derruba a tela).
const BASE_TOKEN_RADIUS = 0.022
const TIER_TOKEN_MULT: Record<string, number> = { comum: 1, elite: 1.25, boss: 1.5625 }

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
    // sem crossOrigin: a imagem publica carrega mesmo sem cabecalho CORS
    img.src = url
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    return () => { img.onload = null; img.onerror = null }
  }, [url])
  return image
}

function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)
  // Callback ref: mede assim que o elemento entra no DOM (funciona com render tardio).
  const ref = useCallback((node: T | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
    if (!node) return
    const measure = () => {
      const rect = node.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setSize({ width: Math.round(rect.width), height: Math.round(rect.height) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    observerRef.current = observer
  }, [])
  useEffect(() => () => { if (observerRef.current) observerRef.current.disconnect() }, [])
  return { ref, size }
}

function HudPortrait({ url, name }: { url: string | null; name: string }) {
  return url
    ? <img src={url} alt="" className="h-full w-full object-cover" />
    : <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">{name.slice(0, 2).toUpperCase()}</span>
}

function VttToken({ x, y, r, imageUrl, ringColor, glow, hpPct, isCurrent, isSelected, markCount, draggable, onSelect, onMove }: {
  x: number
  y: number
  r: number
  imageUrl: string | null
  ringColor: string
  glow: string
  hpPct: number
  isCurrent: boolean
  isSelected: boolean
  markCount: number
  draggable: boolean
  onSelect: () => void
  onMove: (x: number, y: number) => void
}) {
  const image = useLoadedImage(imageUrl)
  const ok = !!image && image.width > 0 && image.height > 0
  const sq = ok ? Math.min(image.width, image.height) : 0
  return (
    <Group x={x} y={y} draggable={draggable} perfectDrawEnabled={false} onClick={onSelect} onTap={onSelect} onDragEnd={(e) => onMove(e.target.x(), e.target.y())}>
      <Circle radius={r + 2} fill="#000000" opacity={0.55} />
      {ok ? (
        <Group clipFunc={(ctx) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath() }}>
          <KonvaImage image={image} crop={{ x: (image.width - sq) / 2, y: (image.height - sq) / 2, width: sq, height: sq }} x={-r} y={-r} width={r * 2} height={r * 2} />
        </Group>
      ) : (
        <Circle radius={r} fill={ringColor} opacity={0.85} />
      )}
      <Circle radius={r} stroke={ringColor} strokeWidth={2} shadowColor={glow} shadowBlur={10} shadowOpacity={0.9} shadowForStrokeEnabled />
      <Ring innerRadius={r + 3} outerRadius={r + 4.5} stroke={ringColor} strokeWidth={2} rotation={-90} angle={hpPct * 360} opacity={0.9} />
      {isCurrent && <Ring innerRadius={r + 6} outerRadius={r + 7.5} stroke="#fde047" strokeWidth={2} opacity={0.95} />}
      {isSelected && <Ring innerRadius={r + 6} outerRadius={r + 7.5} stroke="#ffffff" strokeWidth={2} opacity={0.95} />}
      {Array.from({ length: markCount }).map((_v, mi) => (
        <Circle key={mi} x={-r + 3 + mi * 9} y={-r - 7} radius={3.5} fill="#22d3ee" stroke="#0a0a0a" strokeWidth={1} />
      ))}
    </Group>
  )
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
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => setReloadKey((k) => k + 1), 200)
  }, [])
  const [preview, setPreview] = useState(false)
  const [isFull, setIsFull] = useState(false)
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>()
  // Fallback garante que o Stage nunca nasce 0x0 (evita o erro de drawImage).
  const stageW = size.width > 0 ? size.width : 1280
  const stageH = size.height > 0 ? size.height : 720
  const mapImage = useLoadedImage(map?.image_url ?? null)
  const masterView = isMestre && !preview
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }
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
  // PE maximo do proprio (usado via panelEpMax)
  const allies = participants.filter((p) => p.side === 'aliado')
  const enemies = participants.filter((p) => p.side === 'inimigo')
  const canAct = masterView || (!!currentParticipant && !!myParticipant && currentParticipant.id === myParticipant.id)
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

  // Painel superior esquerdo: apenas a propria ficha (quando houver).

  const panelTarget = myTarget
  const panelChar = myChar
  const panelEpMax = myChar ? calculateEpMax({ intellect: myChar.intellect, level: myChar.level }) : 0

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_tokens' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_maps' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_sessions' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_effects' }, () => scheduleReload())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [scheduleReload])

  function canMove(participantId: string): boolean {
    if (masterView) return true
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

  async function endBattle() {
    if (!battle || busy) return
    if (!window.confirm('Encerrar o combate ativo? O mapa e os efeitos serao removidos.')) return
    setBusy(true)
    setNotice(null)
    try {
      const { data: parts } = await supabase.from('battle_participants').select('enemy_instance_id').eq('battle_session_id', battle.id)
      const instIds = ((parts as { enemy_instance_id: string | null }[]) ?? []).map((x) => x.enemy_instance_id).filter((v): v is string => !!v)
      if (map && map.image_url) {
        const marker = '/battle-maps/'
        const idx = map.image_url.indexOf(marker)
        if (idx >= 0) await supabase.storage.from('battle-maps').remove([decodeURIComponent(map.image_url.slice(idx + marker.length))])
      }
      await supabase.from('battle_effects').delete().eq('battle_session_id', battle.id)
      await supabase.from('battle_maps').delete().eq('battle_session_id', battle.id)
      const { error } = await supabase.from('battle_sessions').update({ status: 'ended' }).eq('id', battle.id)
      if (error) { setNotice('Nao foi possivel encerrar: ' + error.message); return }
      if (instIds.length) await supabase.from('enemy_instances').delete().in('id', instIds)
      setSelectedId(null)
      setReloadKey((k) => k + 1)
    } finally { setBusy(false) }
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
    <div className={(isMestre ? 'mx-auto max-w-7xl' : 'w-full') + ' px-2 py-3 sm:px-4'}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className={'font-title font-bold text-xl ' + (isFull ? 'hidden' : '')}>Mesa de combate</h1>
          <p className="font-body text-xs text-neutral-400">Rodada {battle.round_number} · Turno de {currentParticipant ? currentParticipant.name : '-'}</p>
        </div>
        <div className="flex items-center gap-3">
          {canAct && (
            <button onClick={nextTurn} disabled={busy} className="rounded bg-white px-3 py-1.5 font-body text-xs font-semibold text-neutral-950 disabled:opacity-50">
              {masterView ? 'Proximo turno' : 'Encerrar meu turno'}
            </button>
          )}
          {masterView && (
            <button onClick={endBattle} disabled={busy} className="rounded border border-red-500/60 px-3 py-1.5 font-body text-xs text-red-300 transition-colors hover:text-white disabled:opacity-50">Encerrar combate</button>
          )}
          {isMestre && (
            <button onClick={() => setPreview((v) => !v)} className="rounded border border-sky-500/60 px-3 py-1.5 font-body text-xs text-sky-300 transition-colors hover:text-white">
              {preview ? 'Sair da visualizacao' : 'Testar visualizacao'}
            </button>
          )}
          <button onClick={toggleFullscreen} title="Voce pode jogar em tela cheia" className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-1.5 font-body text-xs text-neutral-300 hover:text-white">
            {isFull ? <Minimize size={14} /> : <Maximize size={14} />}
            <Info size={13} className="text-neutral-500" />
          </button>
          <Link to="/player" className="font-body text-xs text-neutral-500 hover:text-white">Voltar</Link>
        </div>
      </div>

      <div className={'mb-3 flex flex-wrap items-center gap-2 ' + (isFull ? 'hidden' : '')}>
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
                <Stage width={stageW} height={stageH}>
          <Layer>
            {mapImage
              ? <KonvaImage image={mapImage} width={stageW} height={stageH} />
              : <KonvaText text="Sem mapa - o mestre ainda nao enviou uma imagem." x={16} y={16} fill="#737373" fontSize={14} />}
                                    {tokens.map((t) => {
              const target = targets.get(t.participant_id) ?? null
              const participant = participants.find((x) => x.id === t.participant_id) ?? null
              const inst = participant && participant.enemy_instance_id ? instancesById[participant.enemy_instance_id] : null
              const tierMult = inst ? (TIER_TOKEN_MULT[inst.enemies.tier] || 1) : 1
              const ring = inst ? (ENEMY_RING[inst.enemies.tier] || ENEMY_RING.comum) : ALLY_RING
              const r = Math.max(12, stageW * BASE_TOKEN_RADIUS * tierMult)
              const hpPct = target && target.hpMax > 0 ? Math.max(0, Math.min(1, target.hpCurrent / target.hpMax)) : 0
              const markCount = effects.filter((e) => e.kind === 'marca' && e.target_participant_id === t.participant_id).length
              return (
                <VttToken
                  key={t.id}
                  x={t.x * stageW}
                  y={t.y * stageH}
                  r={r}
                  imageUrl={target ? target.portraitUrl : null}
                  ringColor={ring.color}
                  glow={ring.glow}
                  hpPct={hpPct}
                  isCurrent={!!currentParticipant && currentParticipant.id === t.participant_id}
                  isSelected={selectedId === t.participant_id}
                  markCount={markCount}
                  draggable={canMove(t.participant_id)}
                  onSelect={() => onTokenClick(t.participant_id)}
                  onMove={(nx, ny) => moveToken(t, nx / Math.max(1, stageW), ny / Math.max(1, stageH))}
                />
              )
            })}
          </Layer>
        </Stage>

        {toasts.map((t) => {
          const tk = tokens.find((x) => x.participant_id === t.targetId)
          if (!tk) return null
          return (
            <div key={t.id} className="pointer-events-none absolute z-40 font-title text-3xl font-bold" style={{ left: tk.x * stageW, top: tk.y * stageH - 24, color: t.color, transform: 'translate(-50%, -50%)', textShadow: '0 0 10px #000' }}>
              {t.amount}
            </div>
          )
        })}

        {panelTarget && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-3 rounded-xl border border-sky-500/40 bg-neutral-950/80 p-2 pr-4 backdrop-blur">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-sky-400/60 bg-neutral-900">
              <HudPortrait url={panelTarget.portraitUrl} name={panelTarget.label} />
            </div>
            <div className="min-w-[120px]">
              <p className="font-body text-xs text-neutral-200">{panelTarget.label}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-red-500" style={{ width: String(panelTarget.hpMax > 0 ? (panelTarget.hpCurrent / panelTarget.hpMax) * 100 : 0) + '%' }} />
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-sky-400" style={{ width: String(panelEpMax > 0 && panelChar ? (panelChar.ep_current / panelEpMax) * 100 : 0) + '%' }} />
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

      <p className={'mt-3 font-body text-xs text-neutral-500 ' + (isFull ? 'hidden' : '')}>
        {canAct ? 'Clique no inimigo para atacar ou no aliado para apoiar.' : 'Aguardando o seu turno. Voce pode arrastar o seu personagem.'}
      </p>
    </div>
  )
}