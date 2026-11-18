import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { DIFFICULTIES } from '@/lib/diceEngine'
import { purgeOldRolls, type RollRecord } from '@/lib/diceFeed'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'

type CharacterMini = { id: string; name: string; portrait_url: string | null }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return min + ' min'
  const h = Math.floor(min / 60)
  if (h < 24) return h + ' h'
  return Math.floor(h / 24) + ' d'
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900">
      {url
        ? <img src={url} alt="" className="h-full w-full object-cover" />
        : <span className="flex h-full w-full items-center justify-center text-[11px] text-neutral-400">{name.slice(0, 2).toUpperCase()}</span>}
    </div>
  )
}

export default function CentralDados() {
  const { isMestre, loading } = useAuth()
  const [rolls, setRolls] = useState<RollRecord[]>([])
  const [characters, setCharacters] = useState<Record<string, CharacterMini>>({})
  const [filter, setFilter] = useState('todos')
  const [source, setSource] = useState<'todos' | 'player' | 'npc' | 'enemy'>('todos')
  const [busy, setBusy] = useState(false)

  async function load() {
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('dice_rolls').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(200)
    const rows = (data as RollRecord[]) ?? []
    setRolls(rows)
    const ids = [...new Set(rows.map((r) => r.character_id).filter((v): v is string => !!v))]
    if (ids.length) {
      const { data: chars } = await supabase.from('characters').select('id, name, portrait_url').in('id', ids)
      setCharacters(Object.fromEntries(((chars as CharacterMini[]) ?? []).map((c) => [c.id, c] as const)))
    }
  }

  useEffect(() => {
    if (!isMestre) return
    void purgeOldRolls()
    void load()
  }, [isMestre])

  useEffect(() => {
    if (!isMestre) return
    const channel = supabase.channel('central-dados')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dice_rolls' }, () => { void load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isMestre])

  const names = useMemo(() => [...new Set(rolls.map((r) => r.character_name ?? r.username))].sort(), [rolls])
  const shown = rolls.filter((r) => (source === 'todos' || r.source === source) && (filter === 'todos' || (r.character_name ?? r.username) === filter))

  if (loading) return null
  if (!isMestre) return <Navigate to="/player" replace />

  async function limpar() {
    setBusy(true)
    await purgeOldRolls()
    await load()
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Reveal trigger="mount" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-title font-bold text-2xl">Central de Dados</h1>
          <p className="mt-1 font-body text-sm text-neutral-400">Rolagens dos últimos 2 dias, ao vivo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value as 'todos' | 'player' | 'npc' | 'enemy')} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-body text-sm text-neutral-200">
            <option value="todos">Todas as origens</option>
            <option value="player">Jogadores</option>
            <option value="npc">NPCs</option>
            <option value="enemy">Inimigos</option>
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-body text-sm text-neutral-200">
            <option value="todos">Todas as fichas</option>
            {names.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={() => void load()} className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-1.5 font-body text-xs text-neutral-300 hover:text-white"><RefreshCw size={13} /> Atualizar</button>
          <button onClick={() => void limpar()} disabled={busy} className="flex items-center gap-1 rounded border border-red-500/50 px-2 py-1.5 font-body text-xs text-red-300 hover:text-white disabled:opacity-50"><Trash2 size={13} /> Limpar antigas</button>
        </div>
      </Reveal>

      <div className="mt-6 flex flex-col gap-2">
        {shown.length === 0 && <p className="font-body text-sm text-neutral-500">Nenhuma rolagem nas últimas 48h.</p>}
        {shown.map((r) => {
          const ch = r.character_id ? characters[r.character_id] : null
          const diff = r.difficulty ? DIFFICULTIES.find((d) => d.id === r.difficulty) : null
          const color = r.falha_critica ? 'text-red-300' : r.critico ? 'text-amber-300' : 'text-neutral-100'
          return (
            <GlowCard key={r.id} contentClassName="flex items-center gap-3 p-3">
              <Avatar url={ch ? ch.portrait_url : null} name={r.username} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm text-neutral-200">{r.character_name ?? r.username}</p>
                <p className="truncate font-body text-[11px] text-neutral-500">{r.label}{diff ? ' · ' + diff.label : ''} · {r.kind === 'teste' ? 'teste' : 'livre'} · {r.source === 'enemy' ? 'inimigo' : r.source === 'npc' ? 'NPC' : 'jogador'} · {timeAgo(r.created_at)}</p>
                {r.rolls.length > 0 && <p className="truncate font-body text-[11px] text-neutral-600">[{r.rolls.join(', ')}]{r.modifier !== 0 ? ' · mod ' + (r.modifier > 0 ? '+' : '') + r.modifier : ''}</p>}
              </div>
              <p className={'font-title text-xl font-bold ' + color}>{r.total}</p>
            </GlowCard>
          )
        })}
      </div>

      <p className="mt-8"><Link to="/player/mestre" className="font-body text-xs text-neutral-500 hover:text-white">Voltar ao painel</Link></p>
    </div>
  )
}