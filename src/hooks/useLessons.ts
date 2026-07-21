import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Lesson, Move } from '../lib/types'

export function useLessons() {
  const { user } = useAuth()
  return useQuery({
    // Re-fetch when auth state changes (a logged-in owner also sees their private lessons).
    queryKey: ['lessons', user?.id ?? 'anon'],
    queryFn: async (): Promise<Array<Lesson & { count: number; moveNames: string[] }>> => {
      // No owner filter: RLS returns all lessons the viewer may see (shared/public + own),
      // so classmates see shared lessons via the app link without an account.
      const { data, error } = await supabase
        .from('lessons')
        .select('*, moves(name, kind, clip_start)')
        .order('course', { ascending: true })
        .order('lesson_number', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<
        Lesson & { moves: Array<{ name: string; kind: string; clip_start: number | null }> }
      >

      // Combo-based move names (includes assigned/related moves), keyed by lesson_id.
      const { data: combos } = await supabase
        .from('moves')
        .select('lesson_id, combo_items:combo_items!combo_items_combo_id_fkey(position, move:moves!combo_items_move_id_fkey(name))')
        .eq('kind', 'combo')
        .in('lesson_id', rows.map((l) => l.id))
      const comboNames: Record<string, string[]> = {}
      for (const c of (combos ?? []) as unknown as Array<{ lesson_id: string; combo_items: Array<{ position: number; move: { name: string } | null }> }>) {
        const seen = new Set<string>()
        comboNames[c.lesson_id] = (c.combo_items ?? [])
          .sort((a, b) => a.position - b.position)
          .map((i) => i.move?.name)
          .filter((n): n is string => {
            if (!n || seen.has(n)) return false
            seen.add(n)
            return true
          })
      }

      return rows.map((l) => {
        const fromCombo = comboNames[l.id]
        if (fromCombo && fromCombo.length) return { ...l, count: fromCombo.length, moveNames: fromCombo }
        const mv = (l.moves ?? [])
          .filter((m) => m.kind === 'move')
          .sort((a, b) => (a.clip_start ?? 0) - (b.clip_start ?? 0))
        return { ...l, count: mv.length, moveNames: mv.map((m) => m.name) }
      })
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

      const { data: combo } = await supabase
        .from('moves')
        .select('*')
        .eq('lesson_id', id!)
        .eq('kind', 'combo')
        .maybeSingle()

      let moves: Move[] = []
      if (combo) {
        // Authoritative move list = the combo's ordered steps (includes moves that were
        // assigned to an existing/catalog move, which have no lesson_id of their own).
        const { data: items } = await supabase
          .from('combo_items')
          .select('position, move:moves!combo_items_move_id_fkey(*)')
          .eq('combo_id', combo.id)
          .order('position', { ascending: true })
        const seen = new Set<string>()
        const stepMoves = ((items ?? []) as unknown as Array<{ move: Move }>)
          .map((i) => i.move)
          .filter((m) => m && !seen.has(m.id) && seen.add(m.id))

        // For assigned moves, show THIS class's own clip (the move_media that uses the
        // same class video), not the move's original/primary clip from another class.
        const classClips: Record<string, { media_url: string | null; thumb_url: string | null; clip_start: number | null; clip_end: number | null }> = {}
        if (combo.media_url && stepMoves.length) {
          const { data: mm } = await supabase
            .from('move_media')
            .select('move_id, media_url, thumb_url, clip_start, clip_end')
            .in('move_id', stepMoves.map((m) => m.id))
            .eq('media_url', combo.media_url)
          for (const c of mm ?? []) if (!classClips[c.move_id]) classClips[c.move_id] = c
        }
        moves = stepMoves.map((m) => {
          const c = classClips[m.id]
          return c ? { ...m, media_url: c.media_url, thumb_url: c.thumb_url, clip_start: c.clip_start, clip_end: c.clip_end } : m
        })
      } else {
        const { data: m } = await supabase
          .from('moves')
          .select('*')
          .eq('lesson_id', id!)
          .eq('kind', 'move')
          .order('clip_start', { ascending: true })
        moves = (m ?? []) as Move[]
      }

      return { lesson: lesson as Lesson, combo: (combo as Move) ?? null, moves }
    },
  })
}
