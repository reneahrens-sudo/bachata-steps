import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Lesson, Move } from '../lib/types'

export function useLessons() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['lessons', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Array<Lesson & { count: number }>> => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*, moves(count)')
        .eq('owner_id', user!.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<Lesson & { moves: Array<{ count: number }> }>
      return rows.map((l) => ({ ...l, count: l.moves?.[0]?.count ?? 0 }))
    },
  })
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: ['lesson', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: lesson, error } = await supabase.from('lessons').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      if (!lesson) return null
      const { data: moves } = await supabase
        .from('moves')
        .select('*')
        .eq('lesson_id', id!)
        .order('clip_start', { ascending: true })
      const all = (moves ?? []) as Move[]
      return {
        lesson: lesson as Lesson,
        combo: all.find((m) => m.kind === 'combo') ?? null,
        moves: all.filter((m) => m.kind === 'move'),
      }
    },
  })
}
