import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { MoveUserData, StatusFlag } from '../lib/types'

export type MyDataMap = Record<string, MoveUserData>

/** Loads ALL of the current user's status rows once, indexed by move_id. */
export function useMyMoveData() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['myMoveData', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyDataMap> => {
      const { data, error } = await supabase.from('move_user_data').select('*').eq('user_id', user!.id)
      if (error) throw error
      const map: MyDataMap = {}
      for (const row of data ?? []) map[row.move_id] = row
      return map
    },
  })
}

export function useToggleStatus() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ moveId, flag, value }: { moveId: string; flag: StatusFlag; value: boolean }) => {
      if (!user) throw new Error('Nicht angemeldet')
      const patch: Partial<MoveUserData> = { [flag]: value, updated_at: new Date().toISOString() }
      if (flag === 'learned') patch.learned_at = value ? new Date().toISOString() : null
      const { error } = await supabase
        .from('move_user_data')
        .upsert({ user_id: user.id, move_id: moveId, ...patch }, { onConflict: 'user_id,move_id' })
      if (error) throw error
    },
    onMutate: async ({ moveId, flag, value }) => {
      await qc.cancelQueries({ queryKey: ['myMoveData', user?.id] })
      const prev = qc.getQueryData<MyDataMap>(['myMoveData', user?.id])
      qc.setQueryData<MyDataMap>(['myMoveData', user?.id], (old) => {
        const map = { ...(old ?? {}) }
        const existing = map[moveId] ?? ({ user_id: user!.id, move_id: moveId } as MoveUserData)
        map[moveId] = {
          ...existing,
          [flag]: value,
          ...(flag === 'learned' ? { learned_at: value ? new Date().toISOString() : null } : {}),
        }
        return map
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['myMoveData', user?.id], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['myMoveData', user?.id] })
    },
  })
}

export function useSaveNotes() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ moveId, notes }: { moveId: string; notes: string }) => {
      if (!user) throw new Error('Nicht angemeldet')
      const { error } = await supabase
        .from('move_user_data')
        .upsert(
          { user_id: user.id, move_id: moveId, notes, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,move_id' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myMoveData', user?.id] }),
  })
}
