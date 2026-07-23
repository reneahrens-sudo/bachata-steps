import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Collection, Move } from '../lib/types'

export function useCollections() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['collections', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Array<Collection & { count: number }>> => {
      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_items(count)')
        .eq('owner_id', user!.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<
        Collection & { collection_items: Array<{ count: number }> }
      >
      return rows.map((c) => ({
        ...c,
        count: c.collection_items?.[0]?.count ?? 0,
      }))
    },
  })
}

export function useCollectionBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['collection_slug', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: col, error } = await supabase
        .from('collections')
        .select('*')
        .eq('share_slug', slug!)
        .maybeSingle()
      if (error) throw error
      if (!col) return null
      const { data: items, error: e2 } = await supabase
        .from('collection_items')
        .select('position, move:moves(*)')
        .eq('collection_id', col.id)
        .order('position', { ascending: true })
      if (e2) throw e2
      const rows = (items ?? []) as unknown as Array<{ move: Move }>
      return { collection: col, moves: rows.map((i) => i.move) }
    },
  })
}

export function useCreateCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error('Nicht angemeldet')
      const { data, error } = await supabase
        .from('collections')
        .insert({ owner_id: user.id, name, description })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections', user?.id] }),
  })
}

/** Makes a collection shareable: ensures a share_slug and sets visibility to 'unlisted'. Returns the slug. */
export function useShareCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ collectionId, currentSlug }: { collectionId: string; currentSlug: string | null }) => {
      const slug = currentSlug || crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const { error } = await supabase
        .from('collections')
        .update({ share_slug: slug, visibility: 'unlisted' })
        .eq('id', collectionId)
      if (error) throw error
      return slug
    },
    onSuccess: (_s, v) => {
      qc.invalidateQueries({ queryKey: ['collection', v.collectionId] })
      qc.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

/** Renames / re-describes a collection. */
export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ collectionId, name, description }: { collectionId: string; name?: string; description?: string | null }) => {
      const patch: { name?: string; description?: string | null } = {}
      if (name !== undefined) patch.name = name
      if (description !== undefined) patch.description = description
      const { error } = await supabase.from('collections').update(patch).eq('id', collectionId)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['collection', v.collectionId] })
      qc.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

/** Removes a single move from a collection. */
export function useRemoveFromCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ collectionId, moveId }: { collectionId: string; moveId: string }) => {
      const { error } = await supabase.from('collection_items').delete().eq('collection_id', collectionId).eq('move_id', moveId)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['collection', v.collectionId] })
      qc.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

/** Persists a new order of move ids as collection_items.position. */
export function useReorderCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ collectionId, orderedMoveIds }: { collectionId: string; orderedMoveIds: string[] }) => {
      await Promise.all(
        orderedMoveIds.map((moveId, i) =>
          supabase.from('collection_items').update({ position: i }).eq('collection_id', collectionId).eq('move_id', moveId),
        ),
      )
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['collection', v.collectionId] })
    },
  })
}

export function useAddToCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ collectionId, moveId }: { collectionId: string; moveId: string }) => {
      const { count } = await supabase
        .from('collection_items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collectionId)
      const { error } = await supabase
        .from('collection_items')
        .insert({ collection_id: collectionId, move_id: moveId, position: count ?? 0 })
      if (error && error.code !== '23505') throw error // ignore duplicates
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['collection', v.collectionId] })
      qc.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}
