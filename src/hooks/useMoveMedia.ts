import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { moveToSource } from '../components/moves/MediaPreview'
import type { MediaSource, Move, MoveMediaInsert } from '../lib/types'

/** All playable sources for a move: its primary media (if any) + move_media rows. */
export function useMoveSources(move: Move | null | undefined) {
  return useQuery({
    queryKey: ['move_media', move?.id],
    enabled: !!move,
    queryFn: async (): Promise<MediaSource[]> => {
      const { data, error } = await supabase
        .from('move_media')
        .select('*')
        .eq('move_id', move!.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error

      const sources: MediaSource[] = []
      const primary = moveToSource(move!)
      if (primary.youtube_id || primary.media_url) sources.push({ ...primary, label: 'Original' })
      for (const m of data ?? []) {
        sources.push({
          id: m.id,
          label: m.label,
          youtube_id: m.youtube_id,
          media_url: m.media_url,
          thumb_url: m.thumb_url,
          clip_start: m.clip_start,
          clip_end: m.clip_end,
          source_url: m.source_url,
        })
      }
      return sources
    },
  })
}

export function useAddMoveMedia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: MoveMediaInsert) => {
      const { error } = await supabase.from('move_media').insert(row)
      if (error) throw error
    },
    onSuccess: (_d, row) => qc.invalidateQueries({ queryKey: ['move_media', row.move_id] }),
  })
}

export function useDeleteMoveMedia(moveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('move_media').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['move_media', moveId] }),
  })
}
