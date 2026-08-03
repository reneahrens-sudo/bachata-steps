import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type Member = { id: string; email: string | null; note: string | null; is_admin: boolean; added_at: string | null }

/** Is the current user an admin (may manage members)? */
export function useIsAdmin() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['is_admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return !!data
    },
  })
}

async function callMembers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('members', { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as T
}

export function useMembers(enabled: boolean) {
  return useQuery({
    queryKey: ['members'],
    enabled,
    queryFn: () => callMembers<{ members: Member[] }>({ action: 'list' }).then((d) => d.members),
  })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { email: string; password: string; note?: string }) => callMembers({ action: 'invite', ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => callMembers({ action: 'remove', id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}
