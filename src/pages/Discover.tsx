import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MoveGrid } from '../components/moves/MoveGrid'
import type { Move } from '../lib/types'

export function Discover() {
  const { data: moves = [], isLoading, isError, error } = useQuery({
    queryKey: ['discover'],
    queryFn: async (): Promise<Move[]> => {
      const { data, error } = await supabase
        .from('moves')
        .select('*')
        .eq('visibility', 'public')
        .not('owner_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Entdecken</h1>
        <p className="text-sm text-text-dim">Öffentliche Moves &amp; Combos der Community</p>
      </div>
      {isError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center text-red-400">Fehler: {(error as Error).message}</div>
      ) : isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : moves.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch nichts Öffentliches geteilt. Sei der Erste! ✨
        </div>
      ) : (
        <MoveGrid moves={moves} />
      )}
    </div>
  )
}
