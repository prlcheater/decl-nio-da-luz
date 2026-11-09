import { supabase } from './supabase'
import type { AbilityInput } from '@/components/AbilityBuilder'
import { validateDefinition } from './abilityDefinition'

export async function saveAbility(ownerType: 'character' | 'enemy', ownerId: string, value: AbilityInput): Promise<void> {
  const problem = validateDefinition(value.definition)
  if (problem) throw new Error(problem)
  const { error } = await supabase.rpc('create_structured_ability', {
    p_owner_type: ownerType, p_owner_id: ownerId, p_name: value.name, p_description: value.description,
    p_tier: value.tier, p_level: value.level, p_definition: value.definition,
  })
  if (error) throw new Error('Não foi possível salvar a habilidade: ' + error.message)
}
