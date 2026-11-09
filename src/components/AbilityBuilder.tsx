import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import GlowCard from './GlowCard'
import { ATTRIBUTES, EFFECTS, ABILITY_ELEMENTS, defaultEffect, validateDefinition, isCombatSupported, abilitySummary, type AbilityDefinition, type Effect, type EffectKind } from '@/lib/abilityDefinition'
import type { AbilityTier } from '@/lib/diceEngine'

export type AbilityInput = { name: string; description: string; tier: AbilityTier; level: number; definition: AbilityDefinition }
const input = 'w-full min-w-0 min-h-11 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100'
export default function AbilityBuilder({ onAdd }: { onAdd: (value: AbilityInput) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tier, setTier] = useState<AbilityTier>('comum')
  const [level, setLevel] = useState(1)
  const [effects, setEffects] = useState<Effect[]>([defaultEffect()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const definition: AbilityDefinition = { version: 1, effects }
  const ability = { definition, tipo_efeito: effects[0].kind }
  const ready = isCombatSupported(definition)
  function update(index: number, patch: Partial<Effect>) {
    setEffects(previous => previous.map((effect, i) => i === index ? { ...effect, ...patch } : effect))
  }
  function changeKind(index: number, kind: EffectKind) {
    setEffects(previous => previous.map((effect, i) => {
      if (i !== index) return effect
      const next = defaultEffect(kind)
      if (index !== 0 && previous[0].kind === 'movimento') next.target = 'self'
      return next
    }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const problem = validateDefinition(definition)
    if (problem || !name.trim() || !Number.isInteger(level) || level < 1 || level > 10) {
      setError(problem ?? 'Informe nome e nível inteiro de 1 a 10.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdd({ name: name.trim(), description: description.trim(), tier, level, definition })
      setName(''); setDescription(''); setTier('comum'); setLevel(1); setEffects([defaultEffect()]); setOpen(false)
    } catch (cause) {
      setError((cause as { message?: string })?.message ?? 'Não foi possível salvar. Seus campos foram preservados.')
    } finally { setSaving(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="flex min-h-[120px] items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 text-sm text-neutral-300"><Plus size={16} />Adicionar habilidade</button>
  return <GlowCard className="sm:col-span-2 lg:col-span-full" contentClassName="p-5">
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      <h3 className="font-title text-lg">Criar habilidade</h3>
      <label>Nome<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={input} /></label>
      <label>Descrição narrativa<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className={input} /></label>
      <p className="text-sm text-neutral-400">A descrição não altera as regras. Configure os efeitos abaixo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Tier<select aria-label="Tier" value={tier} onChange={e => setTier(e.target.value as AbilityTier)} className={input}><option value="comum">Comum</option><option value="especial">Especial</option><option value="suprema">Suprema</option></select></label>
        <label>Nível<input type="number" min={1} max={10} step={1} value={level} onChange={e => setLevel(Number(e.target.value))} className={input} /></label>
      </div>
      {effects.map((effect, index) => <fieldset key={index} className="min-w-0 rounded border border-neutral-700 p-3">
        <legend className="px-2">{index === 0 ? 'Efeito principal' : 'Efeito adicional ' + index}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Categoria<select aria-label="Categoria" value={effect.kind} onChange={e => changeKind(index, e.target.value as EffectKind)} className={input}>{Object.entries(EFFECTS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Atributo escalador<select aria-label="Atributo escalador" value={effect.scaler} onChange={e => update(index, { scaler: e.target.value as Effect['scaler'] })} className={input}>{Object.entries(ATTRIBUTES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Elemento<select aria-label="Elemento" value={effect.element ?? ''} onChange={e => update(index, { element: e.target.value || null, appliesElement: !!e.target.value, duration: e.target.value ? effect.duration ?? 1 : ['buff','debuff','controle','preparacao'].includes(effect.kind) ? effect.duration : null })} className={input}><option value="">Nenhum</option>{ABILITY_ELEMENTS.map(name => <option key={name}>{name}</option>)}</select></label>
          <label>Destinatário<select aria-label="Destinatário" value={effect.target} onChange={e => update(index, { target: e.target.value as Effect['target'] })} className={input}>
            {(['dano','debuff','controle'].includes(effect.kind) ? ['enemy'] : effect.kind === 'movimento' || effects[0].kind === 'movimento' ? ['self'] : ['ally','self']).map(target => <option key={target} value={target}>{({ enemy: 'Adversário', ally: 'Aliado (incluindo você)', self: 'Somente você' } as Record<string,string>)[target]}</option>)}
          </select></label>
          {['buff','debuff'].includes(effect.kind) && <>
            <label>Atributo alterado<select aria-label="Atributo alterado" value={effect.attribute ?? ''} onChange={e => update(index, { attribute: e.target.value as Effect['attribute'] || null })} className={input}><option value="">Selecione</option>{Object.entries(ATTRIBUTES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>{effect.kind === 'buff' ? 'Aumento' : 'Redução'} em pontos<input type="number" min={1} max={10} step={1} value={effect.amount ?? ''} onChange={e => update(index, { amount: e.target.value ? Number(e.target.value) : null })} className={input} /></label>
          </>}
          {['controle','preparacao','purificacao'].includes(effect.kind) && <label>Comportamento<select aria-label="Comportamento" value={effect.state ?? ''} onChange={e => update(index, { state: e.target.value as Effect['state'] || null })} className={input}><option value="">Selecione</option>{(effect.kind === 'controle' ? ['medo','imobilizacao','silencio'] : effect.kind === 'preparacao' ? ['marca'] : ['remover_penalidade']).map(state => <option key={state} value={state}>{state.replaceAll('_',' ')}</option>)}</select></label>}
          {(effect.appliesElement || ['buff','debuff','controle','preparacao'].includes(effect.kind)) && <label>Duração (turnos do alvo)<input type="number" min={1} max={20} step={1} value={effect.duration ?? ''} onChange={e => update(index, { duration: e.target.value ? Number(e.target.value) : null })} className={input} /></label>}
        </div>
        {effect.element && <label className="mt-3 flex min-h-11 items-center gap-2"><input type="checkbox" checked={effect.appliesElement} onChange={e => update(index, { appliesElement: e.target.checked, duration: e.target.checked ? effect.duration ?? 1 : ['buff','debuff','controle','preparacao'].includes(effect.kind) ? effect.duration : null })} />Aplicar estado elemental (rascunho)</label>}
        {index > 0 && <button type="button" className="mt-2 min-h-11 text-red-300" onClick={() => setEffects(previous => previous.filter((_,i) => i !== index))}>Remover efeito {index}</button>}
      </fieldset>)}
      <button type="button" disabled={effects.length >= 8 || saving} onClick={() => setEffects(previous => [...previous, defaultEffect(effects[0].kind === 'movimento' ? 'movimento' : 'debuff')])} className="min-h-11 rounded border border-neutral-600 px-3 disabled:opacity-50">Adicionar efeito</button>
      <p className="break-words text-sm text-neutral-300">{abilitySummary(ability)}</p>
      <p className="text-sm text-amber-200">{ready ? 'Disponível no combate assim que salva. Elemento sem aplicação é apenas identificação.' : 'Rascunho: não pode ser usado até que seus efeitos sejam implementados.'}</p>
      {effects.some(e => e.kind === 'escudo') && <p className="text-sm text-neutral-400">Escudo cria uma barreira separada do PV: absorve dano depois da mitigação até acabar ou o combate terminar.</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={saving} className="min-h-11 rounded bg-white px-4 text-neutral-950 disabled:opacity-50">{saving ? 'Salvando...' : ready ? 'Salvar habilidade' : 'Salvar rascunho'}</button>
        <button type="button" disabled={saving} onClick={() => setOpen(false)} className="min-h-11 rounded border border-neutral-700 px-4">Cancelar</button>
      </div>
    </form>
  </GlowCard>
}
