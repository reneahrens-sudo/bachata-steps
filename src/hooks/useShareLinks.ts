import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { ShareLink } from '../lib/types'

export type ShareTargetType = 'move' | 'lesson' | 'collection'

export function shareUrlFor(token: string): string {
  return `${window.location.origin}/s/${token}`
}

/** All share links created by the current user (RLS-scoped). */
export function useMyShareLinks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['share_links', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ShareLink[]> => {
      const { data, error } = await supabase.from('share_links').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Creates a share link; expiresInHours = null → never expires. Returns the full URL. */
export function useCreateShareLink() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { targetType: ShareTargetType; targetId: string; label: string; expiresInHours: number | null }) => {
      if (!user) throw new Error('Nicht angemeldet')
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      const expires_at = v.expiresInHours == null ? null : new Date(Date.now() + v.expiresInHours * 3600_000).toISOString()
      const { error } = await supabase.from('share_links').insert({
        token,
        owner_id: user.id,
        target_type: v.targetType,
        target_id: v.targetId,
        label: v.label,
        expires_at,
      })
      if (error) throw error
      return shareUrlFor(token)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share_links'] }),
  })
}

/** Change a link's expiry (extend, or set to null = never). */
export function useUpdateShareLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; expires_at: string | null }) => {
      const { error } = await supabase.from('share_links').update({ expires_at: v.expires_at }).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share_links'] }),
  })
}

export function useDeleteShareLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('share_links').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share_links'] }),
  })
}
