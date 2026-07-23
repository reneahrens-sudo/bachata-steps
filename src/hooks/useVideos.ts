import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { deleteVideoObject, publicVideoUrl } from '../lib/storage'
import { deleteMovesDeep } from '../lib/moveCleanup'
import { useAuth } from './useAuth'
import type { VideoRow } from '../lib/types'

type UsedMove = { id: string; name: string; kind: string; visibility: string; thumb_url: string | null; media_url: string | null }
export type MyVideo = VideoRow & { moves: UsedMove[]; play_url: string | null }

/** All uploaded videos owned by the user, each with the moves/combo derived from it + a playable URL. */
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
          .select('id, name, kind, visibility, thumb_url, media_url, video_id')
          .in('video_id', ids)
        moves = (data ?? []) as (UsedMove & { video_id: string })[]
      }
      const byVid: Record<string, UsedMove[]> = {}
      for (const m of moves) (byVid[m.video_id] ??= []).push(m)

      // Derive the storage public base once from any (move.media_url, video.storage_path) pair,
      // so even videos without derived moves get a working play URL (R2 base isn't exposed to the client).
      let base: string | null = null
      for (const v of vids ?? []) {
        const url = byVid[v.id]?.find((m) => m.media_url?.endsWith(v.storage_path))?.media_url
        if (url) { base = url.slice(0, url.length - v.storage_path.length); break }
      }
      const playUrlFor = (v: VideoRow): string | null => {
        const direct = byVid[v.id]?.find((m) => m.media_url)?.media_url
        if (direct) return direct
        if (base) return base + v.storage_path
        if (import.meta.env.VITE_STORAGE_BACKEND !== 'r2') return publicVideoUrl(v.storage_path)
        return null
      }

      return (vids ?? []).map((v) => ({ ...v, moves: byVid[v.id] ?? [], play_url: playUrlFor(v) }))
    },
  })
}

/** Deletes a video: its storage object, all moves/combos derived from it (+ their links), and the row. */
export function useDeleteVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ videoId, storagePath }: { videoId: string; storagePath: string }) => {
      // 1. Delete all moves/combos derived from this video (+ their dependents).
      const { data: moves } = await supabase.from('moves').select('id').eq('video_id', videoId)
      await deleteMovesDeep((moves ?? []).map((m) => m.id))
      // 2. Detach any lesson that pointed at this video, then delete the lesson if now empty.
      await supabase.from('lessons').update({ video_id: null }).eq('video_id', videoId)
      // 3. Delete the videos row.
      const { error: dv } = await supabase.from('videos').delete().eq('id', videoId)
      if (dv) throw dv
      // 4. Free the stored object (best-effort — the DB is already consistent).
      try { await deleteVideoObject(storagePath) } catch (e) { console.warn('Storage-Objekt konnte nicht gelöscht werden:', e) }
    },
    onSuccess: () => {
      for (const k of [['my_videos'], ['moves'], ['move'], ['lessons'], ['lesson'], ['discover'], ['collections']]) qc.invalidateQueries({ queryKey: k })
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
