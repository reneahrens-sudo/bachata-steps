import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type AccessInfo = {
  isMember: boolean
  /** True when this account entered via a guest link. */
  isGuest: boolean
  /** Guest link expiry (null = unlimited / not a guest). */
  guestExpiresAt: string | null
}

/** Membership + guest status of the signed-in account. Refetches so revocation/expiry surfaces live. */
export function useAccess() {
  const { user, isRealUser } = useAuth()
  return useQuery({
    queryKey: ['access', user?.id],
    enabled: isRealUser,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AccessInfo> => {
      const [member, guest] = await Promise.all([supabase.rpc('is_member'), supabase.rpc('guest_link_info')])
      const g = guest.data as { expires_at?: string | null } | null
      return {
        isMember: !!member.data,
        isGuest: g != null,
        guestExpiresAt: g?.expires_at ?? null,
      }
    },
  })
}
