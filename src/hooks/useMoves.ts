import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Move } from '../lib/types'

export type MoveFilters = {
  search?: string
  style?: string
  category?: string
  level?: number
  kind?: 'move' | 'combo'
  onlyMine?: boolean
}

export function useMoves(filters: MoveFilters = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['moves', filters, filters.onlyMine ? user?.id : null],
    queryFn: async (): Promise<Move[]> => {
      let q = supabase.from('moves').select('*').order('name', { ascending: true }).limit(1000)

      if (filters.style) q = q.eq('style', filters.style)
      if (filters.category) q = q.eq('category', filters.category)
      if (filters.level) q = q.eq('level', filters.level)
      if (filters.kind) q = q.eq('kind', filters.kind)
      if (filters.onlyMine && user) q = q.eq('owner_id', user.id)
      if (filters.search) {
        const s = filters.search.replace(/[%,()]/g, ' ').trim()
        q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMove(id: string | undefined) {
  return useQuery({
    queryKey: ['move', id],
    enabled: !!id,
    queryFn: async (): Promise<Move | null> => {
      const { data, error } = await supabase.from('moves').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useComboItems(comboId: string | undefined) {
  return useQuery({
    queryKey: ['combo_items', comboId],
    enabled: !!comboId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combo_items')
        .select('*, move:moves!combo_items_move_id_fkey(*)')
        .eq('combo_id', comboId!)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{ id: string; position: number; move_id: string; move: Move }>
    },
  })
}
