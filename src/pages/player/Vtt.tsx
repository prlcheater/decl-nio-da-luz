import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Circle, Group, Image as KonvaImage, Layer, Ring, Stage, Text as KonvaText } from 'react-konva'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { ENEMY_TIER_CONFIG, calculateEpMax, calculateHpMax } from '@/lib/diceEngine'
import { clamp01, type BattleMapRow, type TokenRow } from '@/lib/vttTypes'
import type { BattleRow, CharacterData, EnemyInstanceData, ParticipantRow, Target } from '@/lib/combatTypes'

const SIDE_COLOR: Record<'aliado' | 'inimigo', string> = { aliado: '#38bdf8', inimigo: '#f87171' }

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

  useEffect(() => {
    const channel = supabase.channel('vtt-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_tokens' }, () => setReloadKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_maps' }, () => setReloadKey((k) => k + 1))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

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
        const mult = ENEMY_TIER_CONFIG[i.enemies.tier].vidaMult
        out.set(p.id, { participantId: p.id, label: p.name, side: p.side, kind: 'enemy', refId: i.id, portraitUrl: i.enemies.portrait_url, hpCurrent: i.hp_current, hpMax: Math.round(calculateHpMax({ resistance: i.enemies.resistance, level: i.enemies.level }) * mult), resistance: i.enemies.resistance, marks: [] })
      }
    }
    return out
  }, [participants, charactersById, instancesById])

  const myParticipant = participants.find((p) => {
    const c = p.character_id ? charactersById[p.character_id] : null
    return !!c && !!session && c.user_id === session.user.id
  })
  const myChar = myParticipant?.character_id ? charactersById[myParticipant.character_id] : null
  const myTarget = myParticipant ? targets.get(myParticipant.id) ?? null : null
  const myEpMax = myChar ? calculateEpMax({ intellect: myChar.intellect, level: myChar.level }) : 0
  const allies = participants.filter((p) => p.side === 'aliado')
  const enemies = participants.filter((p) => p.side === 'inimigo')

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
  }  if (authLoading || battle === undefined) return null

  if (!battle) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-title font-bold text-3xl">Mesa de combate</h1>
        <p className="mt-3 font-body text-neutral-400">
          Nenhum combate ativo no momento. O mestre monta a mesa e escolhe o mapa e os participantes.
        </p>
        <Link to="/player/combate" className="mt-6 inline-flex rounded-md bg-white px-6 py-3 font-body text-sm font-semibold text-neutral-950">
          Configurar combate
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-title font-bold text-xl">Mesa de combate</h1>
        <div className="flex items-center gap-3 font-body text-xs text-neutral-400">
          <span>Rodada {battle.round_number}</span>
          <Link to="/player" className="hover:text-white">Voltar</Link>
        </div>
      </div>

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
              const r = Math.max(14, size.width * t.size)
              const pct = target && target.hpMax > 0 ? Math.max(0, Math.min(1, target.hpCurrent / target.hpMax)) : 0
              const side = target?.side ?? 'inimigo'
              return (
                <Group
                  key={t.id}
                  x={cx}
                  y={cy}
                  draggable={canMove(t.participant_id)}
                  onDragEnd={(e) => moveToken(t, e.target.x() / size.width, e.target.y() / size.height)}
                >
                  <Circle radius={r + 6} fill="#0a0a0a" opacity={0.5} />
                  <Circle radius={r} fill={t.color ?? SIDE_COLOR[side]} opacity={0.92} stroke="#0a0a0a" strokeWidth={2} />
                  <Ring innerRadius={r + 2} outerRadius={r + 6} stroke={side === 'aliado' ? '#38bdf8' : '#ef4444'} strokeWidth={3} rotation={-90} angle={pct * 360} opacity={0.95} />
                  <KonvaText text={t.label} x={-r - 20} y={r + 6} width={r * 2 + 40} align="center" fontSize={11} fill="#e5e5e5" />
                </Group>
              )
            })}
          </Layer>
        </Stage>

        {myTarget && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-3 rounded-xl border border-sky-500/40 bg-neutral-950/80 p-2 pr-4 backdrop-blur">
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

        <div className="pointer-events-none absolute right-3 top-3 flex max-w-[45%] flex-col items-end gap-1">
          {enemies.map((p) => {
            const t = targets.get(p.id)
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-neutral-950/75 px-2 py-1 backdrop-blur">
                <div className="h-7 w-7 overflow-hidden rounded-full border border-red-400/50 bg-neutral-900">
                  <HudPortrait url={t?.portraitUrl ?? null} name={p.name} />
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

        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[60%] flex-wrap gap-1.5">
          {allies.map((p) => {
            const t = targets.get(p.id)
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950/75 px-2 py-1 backdrop-blur">
                <div className="h-8 w-8 overflow-hidden rounded-full border border-neutral-600 bg-neutral-900">
                  <HudPortrait url={t?.portraitUrl ?? null} name={p.name} />
                </div>
                <div className="min-w-[74px]">
                  <p className="font-body text-[11px] text-neutral-200">{p.name}</p>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full bg-emerald-400" style={{ width: String(t && t.hpMax > 0 ? (t.hpCurrent / t.hpMax) * 100 : 0) + '%' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-3 font-body text-xs text-neutral-500">
        Arraste seu personagem para posiciona-lo. No turno, clique no alvo para abrir as habilidades (proxima etapa).
      </p>
    </div>
  )
}