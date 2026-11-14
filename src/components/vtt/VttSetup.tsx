import { useEffect, useState } from 'react'
import { ENEMY_TIER_CONFIG, calculateEpMax, calculateHpMax, rollInitiative, type EnemyTier } from '@/lib/diceEngine'
import { supabase } from '@/lib/supabase'
import { uploadBattleMap } from '@/lib/mapUpload'

type RosterEntry = { id: string; name: string; level: number; portrait_url: string | null }
type EnemyTemplate = { id: string; name: string; tier: EnemyTier; level: number; resistance: number; intellect: number }
type Participante = { id: string; name: string; side: 'aliado' | 'inimigo' }

const TOKEN_SIZE = 0.06

function tokenPosition(side: 'aliado' | 'inimigo', index: number, total: number) {
  const x = side === 'aliado' ? 0.2 : 0.8
  const y = total <= 1 ? 0.5 : 0.18 + (0.64 * index) / (total - 1)
  return { x, y }
}

async function createTokens(battle: string, mapId: string, parts: Participante[]) {
  const allies = parts.filter((p) => p.side === 'aliado')
  const foes = parts.filter((p) => p.side === 'inimigo')
  const rows = [
    ...allies.map((p, i) => ({ p, ...tokenPosition('aliado', i, allies.length), z: 1 })),
    ...foes.map((p, i) => ({ p, ...tokenPosition('inimigo', i, foes.length), z: 2 })),
  ]
  const { error } = await supabase.from('battle_tokens').insert(rows.map((r) => ({
    battle_session_id: battle, map_id: mapId, participant_id: r.p.id, label: r.p.name, x: r.x, y: r.y, size: TOKEN_SIZE, z: r.z,
  })))
  if (error) throw new Error('Falha ao distribuir os tokens: ' + error.message)
}

export default function VttSetup({ mode, battleId, onDone }: { mode: 'create' | 'map'; battleId?: string; onDone: () => void }) {
  const [characters, setCharacters] = useState<RosterEntry[]>([])
  const [enemyTemplates, setEnemyTemplates] = useState<EnemyTemplate[]>([])
  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [enemyCounts, setEnemyCounts] = useState<Record<string, number>>({})
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [gridCols, setGridCols] = useState(20)
  const [gridRows, setGridRows] = useState(12)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'create') return
    supabase.from('characters').select('id, name, level, portrait_url').eq('status', 'active').order('name').then(({ data }) => setCharacters((data as RosterEntry[]) ?? []))
    supabase.from('enemies').select('id, name, tier, level, resistance, intellect').order('name').then(({ data }) => setEnemyTemplates((data as EnemyTemplate[]) ?? []))
  }, [mode])

  function pickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }
  function toggleChar(id: string) {
    setSelectedChars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function setCount(id: string, n: number) {
    setEnemyCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.min(20, Number.isFinite(n) ? Math.trunc(n) : 0)) }))
  }  const totalEnemies = Object.values(enemyCounts).reduce((a, b) => a + b, 0)
  const inputClass = 'mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-body text-sm text-neutral-100'

  async function defineMap() {
    if (!battleId || !file || busy) return
    setBusy(true); setError(null)
    try {
      const imageUrl = await uploadBattleMap(file)
      const { data: mapRow, error: mapError } = await supabase.from('battle_maps')
        .upsert({ battle_session_id: battleId, image_url: imageUrl, grid_cols: gridCols, grid_rows: gridRows }, { onConflict: 'battle_session_id' })
        .select('id').single()
      if (mapError || !mapRow) throw new Error('Falha ao salvar o mapa.')
      const { data: parts } = await supabase.from('battle_participants').select('id, name, side').eq('battle_session_id', battleId)
      const list = (parts as Participante[]) ?? []
      const { count } = await supabase.from('battle_tokens').select('id', { count: 'exact', head: true }).eq('battle_session_id', battleId)
      if (!count) await createTokens(battleId, mapRow.id, list)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao definir o mapa.')
    } finally { setBusy(false) }
  }

  async function startBattle() {
    if (busy) return
    if (!file) { setError('Envie a imagem do mapa (16:9).'); return }
    setBusy(true); setError(null)
    let createdBattleId: string | null = null
    const instanceIds: string[] = []
    try {
      const imageUrl = await uploadBattleMap(file)
      const { data: session, error: sErr } = await supabase.from('battle_sessions').insert({ status: 'setup' }).select('id').single()
      if (sErr || !session) throw new Error('Nao foi possivel preparar o combate.')
      createdBattleId = session.id
      const enemyPlan = Object.entries(enemyCounts).flatMap(([id, c]) => Array.from({ length: c }, () => id))
      let charRows: { id: string; name: string; level: number }[] = []
      if (selectedChars.length) {
        const { data } = await supabase.from('characters').select('id, name, level').in('id', selectedChars)
        charRows = (data as typeof charRows) ?? []
      }
      let enemyRows: EnemyTemplate[] = []
      if (enemyPlan.length) {
        const { data } = await supabase.from('enemies').select('id, name, tier, level, resistance, intellect').in('id', [...new Set(enemyPlan)])
        enemyRows = (data as EnemyTemplate[]) ?? []
      }
      type Insert = { battle_session_id: string; character_id?: string; enemy_instance_id?: string; name: string; side: string; initiative_roll: number; initiative_bonus: number; initiative_total: number }
      const toInsert: Insert[] = charRows.map((c) => {
        const init = rollInitiative(c.level)
        return { battle_session_id: session.id, character_id: c.id, name: c.name, side: 'aliado', initiative_roll: init.roll, initiative_bonus: init.bonus, initiative_total: init.total }
      })
      for (const templateId of enemyPlan) {
        const enemy = enemyRows.find((row) => row.id === templateId)
        if (!enemy) continue
        const mult = ENEMY_TIER_CONFIG[enemy.tier].vidaMult
        const instanceId = crypto.randomUUID()
        instanceIds.push(instanceId)
        const { error } = await supabase.from('enemy_instances').insert({
          id: instanceId, enemy_id: enemy.id, label: enemy.name,
          hp_current: Math.round(calculateHpMax({ resistance: enemy.resistance, level: enemy.level }) * mult),
          ep_current: Math.round(calculateEpMax({ intellect: enemy.intellect, level: enemy.level }) * mult),
        })
        if (error) throw new Error('Nao foi possivel criar todas as copias dos inimigos.')
        const init = rollInitiative(enemy.level)
        toInsert.push({ battle_session_id: session.id, enemy_instance_id: instanceId, name: enemy.name, side: 'inimigo', initiative_roll: init.roll, initiative_bonus: init.bonus, initiative_total: init.total })
      }
      if (!toInsert.length) throw new Error('Selecione pelo menos um participante.')
      const { data: inserted, error: partError } = await supabase.from('battle_participants').insert(toInsert).select('id, name, side')
      if (partError || !inserted) throw new Error('Nao foi possivel salvar os participantes.')
      const { error: actError } = await supabase.from('battle_sessions').update({ status: 'active' }).eq('id', session.id)
      if (actError) throw new Error('Nao foi possivel ativar o combate.')
      const { data: mapRow, error: mapError } = await supabase.from('battle_maps').insert({ battle_session_id: session.id, image_url: imageUrl, grid_cols: gridCols, grid_rows: gridRows }).select('id').single()
      if (mapError || !mapRow) throw new Error('Falha ao salvar o mapa.')
      await createTokens(session.id, mapRow.id, inserted as Participante[])
      onDone()
    } catch (e) {
      let cleanupFailed = false
      if (createdBattleId) { const r = await supabase.from('battle_sessions').delete().eq('id', createdBattleId); cleanupFailed = !!r.error }
      if (instanceIds.length) { const r = await supabase.from('enemy_instances').delete().in('id', instanceIds); cleanupFailed = cleanupFailed || !!r.error }
      setError((e instanceof Error ? e.message : 'Falha ao iniciar a mesa.') + (cleanupFailed ? ' A limpeza ficou incompleta.' : ' Nada parcial foi mantido.'))
    } finally { setBusy(false) }
  }  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-title font-bold text-2xl">{mode === 'create' ? 'Preparar mesa de combate' : 'Definir mapa do combate'}</h1>
      <p className="mt-2 font-body text-sm text-neutral-400">
        {mode === 'create'
          ? 'Envie o mapa (16:9) e escolha quem participa. Os tokens sao criados automaticamente.'
          : 'Envie o mapa (16:9) deste combate. Os tokens dos participantes serao distribuidos automaticamente.'}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="font-body text-sm text-neutral-300">Mapa (imagem 16:9)</p>
          <div className="mt-2 aspect-[16/9] w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
            {previewUrl
              ? <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center font-body text-xs text-neutral-500">Nenhuma imagem escolhida</span>}
          </div>
          <input type="file" accept="image/*" className="mt-2 font-body text-xs text-neutral-300" onChange={(e) => pickFile(e.target.files ? e.target.files[0] : null)} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="font-body text-xs text-neutral-400">Colunas<input type="number" min={1} max={200} value={gridCols} onChange={(e) => setGridCols(Number(e.target.value))} className={inputClass} /></label>
            <label className="font-body text-xs text-neutral-400">Linhas<input type="number" min={1} max={200} value={gridRows} onChange={(e) => setGridRows(Number(e.target.value))} className={inputClass} /></label>
          </div>
        </div>

        {mode === 'create' && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="font-body text-sm text-neutral-300">Aliados ({selectedChars.length})</p>
              <div className="mt-2 flex flex-col gap-1">
                {characters.length === 0 && <p className="font-body text-xs text-neutral-600">Nenhuma ficha ativa.</p>}
                {characters.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggleChar(c.id)} className={'flex items-center justify-between rounded border px-3 py-1.5 font-body text-xs ' + (selectedChars.includes(c.id) ? 'border-sky-400 text-white' : 'border-neutral-700 text-neutral-400')}>
                    <span>{c.name}</span><span className="text-neutral-500">Nv. {c.level}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-body text-sm text-neutral-300">Inimigos ({totalEnemies})</p>
              <div className="mt-2 flex flex-col gap-1">
                {enemyTemplates.length === 0 && <p className="font-body text-xs text-neutral-600">Nenhum inimigo cadastrado.</p>}
                {enemyTemplates.map((en) => (
                  <div key={en.id} className="flex items-center justify-between rounded border border-neutral-700 px-3 py-1.5">
                    <span className="font-body text-xs text-neutral-300">{en.name} <span className="text-neutral-600">{ENEMY_TIER_CONFIG[en.tier].label} Nv. {en.level}</span></span>
                    <input type="number" min={0} max={20} value={enemyCounts[en.id] ? enemyCounts[en.id] : 0} onChange={(e) => setCount(en.id, Number(e.target.value))} className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-6 font-body text-sm text-red-300">{error}</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" disabled={busy || !file} onClick={mode === 'create' ? startBattle : defineMap} className="rounded bg-white px-5 py-2 font-body text-sm font-semibold text-neutral-950 disabled:opacity-50">
          {busy ? 'Enviando...' : mode === 'create' ? 'Iniciar mesa de combate' : 'Salvar mapa'}
        </button>
      </div>
    </div>
  )
}