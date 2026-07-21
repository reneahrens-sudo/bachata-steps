import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Lesson, Move } from '../lib/types'

export function useLessons() {
  const { user } = useAuth()
  return useQuery({
    // Re-fetch when auth state changes (a logged-in owner also sees their private lessons).
    queryKey: ['lessons', user?.id ?? 'anon'],
    queryFn: async (): Promise<Array<Lesson & { count: number }>> => {
      // No owner filter: RLS returns all lessons the viewer may see (shared/public + own),
      // so classmates see shared lessons via the app link without an account.
      const { data, error } = await supabase
        .from('lessons')
        .select('*, moves(count)')
        .order('course', { ascending: true })
        .order('lesson_number', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<Lesson & { moves: Array<{ count: number }> }>
      return rows.map((l) => ({ ...l, count: l.moves?.[0]?.count ?? 0 }))
    },
  })
}

/** Distinct existing course & school values, for the create/edit comboboxes. */
export function useLessonOptions() {
  return useQuery({
    queryKey: ['lesson_options'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('course, school')
      const uniq = (arr: (string | null)[]) =>
        [...new Set(arr.map((x) => x?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))
      return {
        courses: uniq((data ?? []).map((d) => d.course)),
        schools: uniq((data ?? []).map((d) => d.school)),
      }
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
