import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { VideoRow } from '../lib/types'

type UsedMove = { id: string; name: string; kind: string; visibility: string; thumb_url: string | null }
export type MyVideo = VideoRow & { moves: UsedMove[] }

/** All uploaded videos owned by the user, each with the moves/combo derived from it. */
export function useMyVideos() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my_videos', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyVideo[]> => {
      const { data: vids, error } = await supabase
        .from('videos')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      const ids = (vids ?? []).map((v) => v.id)
      let moves: (UsedMove & { video_id: string })[] = []
      if (ids.length) {
        const { data } = await supabase
          .from('moves')
          .select('id, name, kind, visibility, thumb_url, video_id')
          .in('video_id', ids)
        moves = (data ?? []) as (UsedMove & { video_id: string })[]
      }
      const byVid: Record<string, UsedMove[]> = {}
      for (const m of moves) (byVid[m.video_id] ??= []).push(m)
      return (vids ?? []).map((v) => ({ ...v, moves: byVid[v.id] ?? [] }))
    },
  })
}

/** Set a video's visibility and cascade it to every move/combo derived from that video. */
export function useSetVideoVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ videoId, visibility }: { videoId: string; visibility: string }) => {
      const { error: ve } = await supabase.from('videos').update({ visibility }).eq('id', videoId)
      if (ve) throw ve
      const { error: me } = await supabase.from('moves').update({ visibility }).eq('video_id', videoId)
      if (me) throw me
    },
    onSuccess: () => {
      for (const k of [['my_videos'], ['moves'], ['move'], ['lessons'], ['lesson'], ['discover']]) qc.invalidateQueries({ queryKey: k })
    },
  })
}
