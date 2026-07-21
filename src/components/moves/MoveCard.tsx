import { Link } from 'react-router-dom'
import type { Move, MoveUserData } from '../../lib/types'
import { LEVEL_COLORS, categoryLabel } from '../../lib/constants'
import { thumbFor } from './MediaPreview'
import { StatusDots } from './StatusChips'

export function MoveCard({ move, data }: { move: Move; data?: MoveUserData }) {
  const thumb = thumbFor(move)
  const levelColor = move.level ? LEVEL_COLORS[move.level] : 'var(--color-border)'

  return (
    <Link
      to={`/move/${move.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-accent/60 hover:bg-card-hover"
    >
      <div className="relative bg-bg-soft" style={{ aspectRatio: '4/3' }}>
        {thumb ? (
          <img
            src={thumb}
            alt={move.name}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl text-text-dim">
            {move.kind === 'combo' ? '🎬' : '💃'}
          </div>
        )}

        {/* level badge */}
        {move.level && (
          <span
            className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full text-sm font-bold text-black shadow"
            style={{ background: levelColor }}
          >
            {move.level}
          </span>
        )}

        {move.kind === 'combo' && (
          <span className="absolute right-2 top-2 rounded-full bg-accent-2/90 px-2 py-0.5 text-xs font-semibold text-white">
            Combo
          </span>
        )}

        <div className="absolute bottom-2 right-2">
          <StatusDots data={data} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text">{move.name}</h3>
        <p className="mt-auto text-xs text-text-dim">{categoryLabel(move.category)}</p>
      </div>
    </Link>
  )
}
