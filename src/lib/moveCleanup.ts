import { supabase } from './supabase'
import { deleteVideoObject } from './storage'

/**
 * Deletes moves/combos AND all their dependents that have no DB-level FK cascade:
 * combo steps (both directions), collection memberships, extra videos, personal status,
 * derived preview clips (storage), and any "variation_of" pointers aimed at the deleted moves.
 * Order matters (dependents first).
 */
export async function deleteMovesDeep(moveIds: string[]): Promise<void> {
  const ids = [...new Set(moveIds)].filter(Boolean)
  if (!ids.length) return
  // Free derived preview-clip objects from storage (best effort — DB rows go regardless).
  const { data: previews } = await supabase.from('moves').select('preview_path').in('id', ids)
  for (const p of previews ?? []) if (p.preview_path) { try { await deleteVideoObject(p.preview_path) } catch { /* ignore */ } }
  // Steps where a deleted move is a member, and steps of a deleted combo.
  await supabase.from('combo_items').delete().in('move_id', ids)
  await supabase.from('combo_items').delete().in('combo_id', ids)
  await supabase.from('collection_items').delete().in('move_id', ids)
  await supabase.from('move_media').delete().in('move_id', ids)
  await supabase.from('move_user_data').delete().in('move_id', ids)
  // Detach variation links pointing at the moves we're about to remove.
  await supabase.from('moves').update({ variation_of: null }).in('variation_of', ids)
  // Revoke share links pointing at the deleted moves.
  await supabase.from('share_links').delete().in('target_id', ids)
  const { error } = await supabase.from('moves').delete().in('id', ids)
  if (error) throw error
}
