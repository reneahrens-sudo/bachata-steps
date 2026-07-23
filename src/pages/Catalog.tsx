import { useMemo, useState } from 'react'
import { useMoves, type MoveFilters as MF } from '../hooks/useMoves'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { useAuth } from '../hooks/useAuth'
import { MoveFilters } from '../components/moves/MoveFilters'
import { MoveGrid } from '../components/moves/MoveGrid'
import { STATUS_META, STATUS_ORDER } from '../lib/constants'
import type { StatusFlag } from '../lib/types'

export function Catalog() {
  const { isRealUser } = useAuth()
  const [filters, setFilters] = useState<MF>({})
  const [statusFilter, setStatusFilter] = useState<StatusFlag | null>(null)
  const { data: moves = [], isLoading, isError, error } = useMoves(filters)
  const { data: myData } = useMyMoveData()

  const shown = useMemo(() => {
    if (!statusFilter) return moves
    return moves.filter((m) => myData?.[m.id]?.[statusFilter])
  }, [moves, statusFilter, myData])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Katalog</h1>
        <p className="text-sm text-text-dim">{shown.length} Moves &amp; Combos</p>
      </div>

      <input
        type="search"
        placeholder="Move suchen…"
        value={filters.search ?? ''}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent"
      />

      <MoveFilters filters={filters} onChange={setFilters} />

      {/* status filter row */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {isRealUser && (
          <button
            onClick={() => setFilters((f) => ({ ...f, onlyMine: !f.onlyMine }))}
            className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium"
            style={{
              borderColor: filters.onlyMine ? 'var(--color-accent)' : 'var(--color-border)',
              background: filters.onlyMine ? 'var(--color-accent-soft)' : 'transparent',
              color: filters.onlyMine ? 'var(--color-accent)' : 'var(--color-text-dim)',
            }}
          >
            👤 Nur meine
          </button>
        )}
        <button
          onClick={() => setStatusFilter(null)}
          className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium"
          style={{
            borderColor: !statusFilter ? 'var(--color-accent)' : 'var(--color-border)',
            color: !statusFilter ? 'var(--color-accent)' : 'var(--color-text-dim)',
          }}
        >
          Alle
        </button>
        {STATUS_ORDER.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(statusFilter === f ? null : f)}
            className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium"
            style={{
              borderColor: statusFilter === f ? STATUS_META[f].color : 'var(--color-border)',
              background: statusFilter === f ? STATUS_META[f].color + '22' : 'transparent',
              color: statusFilter === f ? STATUS_META[f].color : 'var(--color-text-dim)',
            }}
          >
            {STATUS_META[f].icon} {STATUS_META[f].short}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center text-red-400">
          Fehler beim Laden: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-card" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      ) : (
        <MoveGrid moves={shown} myData={myData} />
      )}
    </div>
  )
}
