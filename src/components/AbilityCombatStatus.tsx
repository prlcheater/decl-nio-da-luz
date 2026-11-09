import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isAbilityReady, isCombatSupported, type AbilityConfig } from '@/lib/abilityDefinition'

// Situação da habilidade no combate e, para o mestre, a habilitação explícita de rascunhos
// que o motor já suporta. Nada vira utilizável sozinho quando o motor ganha suporte.
export default function AbilityCombatStatus({ abilityId, ability, canEdit, onChanged }: {
  abilityId: string
  ability: AbilityConfig
  canEdit: boolean
  onChanged: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (isAbilityReady(ability)) return null
  const supported = isCombatSupported(ability.definition)

  async function enable() {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('abilities').update({ combat_enabled: true }).eq('id', abilityId)
    setSaving(false)
    if (error) setError('Não foi possível habilitar: ' + error.message)
    else onChanged()
  }

  return (
    <div className="mt-2 text-sm">
      <p className="text-amber-200">
        {supported ? 'Rascunho revisável — o motor já suporta estes efeitos.' : 'Rascunho — efeitos ainda indisponíveis no combate.'}
      </p>
      {supported && canEdit && (
        <button onClick={enable} disabled={saving} className="mt-2 min-h-11 rounded border border-amber-300/60 px-3 text-amber-100 disabled:opacity-50">
          {saving ? 'Habilitando…' : 'Revisei — habilitar no combate'}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-red-300">{error}</p>}
    </div>
  )
}
