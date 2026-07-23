import { supabase } from './supabase'

/**
 * Deletes moves/combos AND all their dependents that have no DB-level FK cascade:
 * combo steps (both directions), collection memberships, extra videos, personal status,
 * and any "variation_of" pointers aimed at the deleted moves. Order matters (dependents first).
 */
export async function deleteMovesDeep(moveIds: string[]): Promise<void> {
  const ids = [...new Set(moveIds)].filter(Boolean)
  if (!ids.length) return
  // Steps where a deleted move is a member, and steps of a deleted combo.
  await supabase.from('combo_items').delete().in('move_id', ids)
  await supabase.from('combo_items').delete().in('combo_id', ids)
  await supabase.from('collection_items').delete().in('move_id', ids)
  await supabase.from('move_media').delete().in('move_id', ids)
  await supabase.from('move_user_data').delete().in('move_id', ids)
  // Detach variation links pointing at the moves we're about to remove.
  await supabase.from('moves').update({ variation_of: null }).in('variation_of', ids)
  const { error } = await supabase.from('moves').delete().in('id', ids)
  if (error) throw error
}
