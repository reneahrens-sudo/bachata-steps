import { useMemo } from 'react'
import { useMoves } from '../hooks/useMoves'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { useAuth } from '../hooks/useAuth'
import { CATEGORIES, LEVELS, LEVEL_COLORS, STATUS_META, STATUS_ORDER } from '../lib/constants'
import { Link } from 'react-router-dom'

export function Stats() {
  const { user } = useAuth()
  const { data: moves = [] } = useMoves()
  const { data: myData } = useMyMoveData()

  const s = useMemo(() => {
    const d = Object.values(myData ?? {})
    const byId = new Map(moves.map((m) => [m.id, m]))
    const learnedMoves = d.filter((x) => x.learned).map((x) => byId.get(x.move_id)).filter(Boolean)

    const perLevel = LEVELS.map((l) => ({
      level: l,
      count: learnedMoves.filter((m) => m!.level === l).length,
    }))
    const perCat = CATEGORIES.map((c) => ({
      cat: c.label,
      count: learnedMoves.filter((m) => m!.category === c.key).length,
    })).filter((x) => x.count > 0)

    const flags = STATUS_ORDER.map((f) => ({ f, count: d.filter((x) => x[f]).length }))
    const maxLevel = Math.max(1, ...perLevel.map((p) => p.count))
    return { total: learnedMoves.length, perLevel, perCat, flags, maxLevel, catalog: moves.length }
  }, [myData, moves])

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um deine Statistik zu sehen.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">
          Anmelden →
        </Link>
      </div>
    )

  const pct = s.catalog ? Math.round((s.total / s.catalog) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Deine Statistik</h1>

      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <div className="text-5xl font-bold text-accent">{s.total}</div>
        <p className="mt-1 text-text-dim">gelernte Moves ({pct}% des Katalogs)</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {s.flags.map(({ f, count }) => (
          <div key={f} className="rounded-2xl border border-border bg-card p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: STATUS_META[f].color }}>
              {count}
            </div>
            <div className="mt-1 text-xs text-text-dim">
              {STATUS_META[f].icon} {STATUS_META[f].short}
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Gelernt nach Level</h2>
        <div className="space-y-2">
          {s.perLevel.map((p) => (
            <div key={p.level} className="flex items-center gap-3">
              <span className="w-12 text-sm text-text-dim">Lvl {p.level}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-lg bg-card">
                <div
                  className="flex h-full items-center justify-end rounded-lg px-2 text-xs font-bold text-black"
                  style={{ width: `${(p.count / s.maxLevel) * 100}%`, background: LEVEL_COLORS[p.level], minWidth: p.count ? '1.5rem' : 0 }}
                >
                  {p.count || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {s.perCat.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Gelernt nach Kategorie</h2>
          <div className="flex flex-wrap gap-2">
            {s.perCat.map((c) => (
              <span key={c.cat} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                {c.cat} <span className="font-bold text-accent">{c.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
