import type { Move } from '../../lib/types'
import type { MyDataMap } from '../../hooks/useMyMoveData'
import { MoveCard } from './MoveCard'

export function MoveGrid({ moves, myData }: { moves: Move[]; myData?: MyDataMap }) {
  if (!moves.length) {
    return (
      <div className="grid place-items-center py-20 text-center text-text-dim">
        <div className="text-5xl">🔍</div>
        <p className="mt-3">Keine Moves gefunden.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {moves.map((m) => (
        <MoveCard key={m.id} move={m} data={myData?.[m.id]} />
      ))}
    </div>
  )
}
