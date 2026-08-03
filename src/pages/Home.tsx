import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useMoves } from '../hooks/useMoves'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { MoveCard } from '../components/moves/MoveCard'
import { STATUS_META } from '../lib/constants'
import type { StatusFlag } from '../lib/types'

function Section({
  title,
  flag,
  moves,
  myData,
}: {
  title: string
  flag: StatusFlag
  moves: ReturnType<typeof useMoves>['data']
  myData: ReturnType<typeof useMyMoveData>['data']
}) {
  const list = (moves ?? []).filter((m) => myData?.[m.id]?.[flag]).slice(0, 10)
  if (!list.length) return null
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span style={{ color: STATUS_META[flag].color }}>{STATUS_META[flag].icon}</span> {title}
        </h2>
        <Link to="/katalog" className="text-sm text-text-dim hover:text-accent">
          alle →
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        {list.map((m) => (
          <div key={m.id} className="w-36 shrink-0">
            <MoveCard move={m} data={myData?.[m.id]} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function Home() {
  const { user } = useAuth()
  const { data: moves } = useMoves()
  const { data: myData } = useMyMoveData()

  const stats = useMemo(() => {
    const d = Object.values(myData ?? {})
    return {
      learned: d.filter((x) => x.learned).length,
      practicing: d.filter((x) => x.practicing).length,
      favorite: d.filter((x) => x.favorite).length,
      total: moves?.length ?? 0,
    }
  }, [myData, moves])

  if (!user) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="text-6xl">💃🕺</div>
        <h1 className="mt-4 text-3xl font-bold">
          Bachata<span className="text-accent">Moves</span>
        </h1>
        <p className="mt-3 text-text-dim">
          Sammle deine gelernten Moves &amp; Combos, markiere was du üben willst, baue eigene Kombinationen und teile sie.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/login" className="rounded-xl bg-accent px-6 py-3 font-semibold text-white">
            Loslegen
          </Link>
          <Link to="/katalog" className="rounded-xl border border-border px-6 py-3 font-medium">
            Katalog ansehen
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hallo! 👋</h1>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Gelernt', value: stats.learned, color: STATUS_META.learned.color },
          { label: 'Am Üben', value: stats.practicing, color: STATUS_META.practicing.color },
          { label: 'Favoriten', value: stats.favorite, color: STATUS_META.favorite.color },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <div className="text-3xl font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="mt-1 text-xs text-text-dim">{s.label}</div>
          </div>
        ))}
      </div>

      <Section title="Gerade am Üben" flag="practicing" moves={moves} myData={myData} />
      <Section title="Als Nächstes" flag="next_up" moves={moves} myData={myData} />
      <Section title="Favoriten" flag="favorite" moves={moves} myData={myData} />
      <Section title="Party-Set" flag="party" moves={moves} myData={myData} />

      {stats.learned === 0 && stats.practicing === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          <p>Noch nichts markiert.</p>
          <Link to="/katalog" className="mt-2 inline-block font-medium text-accent">
            Stöbere im Katalog →
          </Link>
        </div>
      )}
    </div>
  )
}
