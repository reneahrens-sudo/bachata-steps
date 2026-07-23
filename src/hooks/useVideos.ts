import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { deleteVideoObject, publicVideoUrl } from '../lib/storage'
import { deleteMovesDeep } from '../lib/moveCleanup'
import { useAuth } from './useAuth'
import type { VideoRow } from '../lib/types'

type UsedMove = { id: string; name: string; kind: string; visibility: string; thumb_url: string | null; media_url: string | null }
export type MyVideo = VideoRow & { moves: UsedMove[]; play_url: string | null; public_url: string | null }

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
      // Canonical public URL of the stored object (base + storage_path). Used both for
      // playback and to identify clips of this video attached to other moves on delete.
      const publicUrlFor = (v: VideoRow): string | null => {
        if (base) return base + v.storage_path
        const direct = byVid[v.id]?.find((m) => m.media_url)?.media_url
        if (direct) return direct
        if (import.meta.env.VITE_STORAGE_BACKEND !== 'r2') return publicVideoUrl(v.storage_path)
        return null
      }

      return (vids ?? []).map((v) => {
        const url = publicUrlFor(v)
        return { ...v, moves: byVid[v.id] ?? [], play_url: url, public_url: url }
      })
    },
  })
}

/**
 * Deletes a video. A move whose primary source is this video is KEPT if it has another
 * source (an extra move_media clip, or a YouTube link) — that source is promoted to primary.
 * Only moves left with no other source are removed. Clips of this video attached to other
 * moves are detached. Finally the row and the stored object are removed.
 */
export function useDeleteVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ videoId, storagePath, publicUrl }: { videoId: string; storagePath: string; publicUrl: string | null }) => {
      // 1. Moves whose PRIMARY source is this video.
      const { data: primaryMoves } = await supabase.from('moves').select('id, youtube_id').eq('video_id', videoId)
      const toDelete: string[] = []
      for (const m of primaryMoves ?? []) {
        // Look for an alternative source on this move (another video, not this one).
        const { data: media } = await supabase.from('move_media').select('*').eq('move_id', m.id)
        const alt =
          (media ?? []).find((a) => a.media_url && a.media_url !== publicUrl) ??
          (media ?? []).find((a) => a.youtube_id)
        if (alt) {
          // Promote the alternative to primary and keep the move.
          await supabase
            .from('moves')
            .update({
              media_url: alt.media_url,
              youtube_id: alt.youtube_id,
              thumb_url: alt.thumb_url,
              clip_start: alt.clip_start,
              clip_end: alt.clip_end,
              video_id: null,
            })
            .eq('id', m.id)
          await supabase.from('move_media').delete().eq('id', alt.id)
        } else if (m.youtube_id) {
          // Move also had a YouTube source alongside the video → just drop the video part.
          await supabase.from('moves').update({ media_url: null, clip_start: null, clip_end: null, video_id: null }).eq('id', m.id)
        } else {
          toDelete.push(m.id)
        }
      }
      // 2. Delete the moves that had no other source (+ their dependents).
      await deleteMovesDeep(toDelete)
      // 3. Detach clips of THIS video that hang on other (kept) moves as extra videos.
      if (publicUrl) await supabase.from('move_media').delete().eq('media_url', publicUrl)
      // 4. Detach any lesson that pointed at this video.
      await supabase.from('lessons').update({ video_id: null }).eq('video_id', videoId)
      // 5. Delete the videos row.
      const { error: dv } = await supabase.from('videos').delete().eq('id', videoId)
      if (dv) throw dv
      // 6. Free the stored object (best-effort — the DB is already consistent).
      try { await deleteVideoObject(storagePath) } catch (e) { console.warn('Storage-Objekt konnte nicht gelöscht werden:', e) }
    },
    onSuccess: () => {
      for (const k of [['my_videos'], ['moves'], ['move'], ['move_media'], ['lessons'], ['lesson'], ['discover'], ['collections']]) qc.invalidateQueries({ queryKey: k })
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
