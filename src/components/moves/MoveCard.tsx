import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Move, MoveUserData } from '../../lib/types'
import { LEVEL_COLORS, categoryLabel } from '../../lib/constants'
import { thumbFor } from './MediaPreview'
import { StatusDots } from './StatusChips'

function isVideoUrl(u: string | null | undefined): boolean {
  return !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u)
}

/** Autoplaying, looping, muted preview — only plays while the card is on screen. */
function CardVideo({ move, poster }: { move: Move; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null)
  const start = move.clip_start ?? 0
  const end = move.clip_end ?? undefined

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.25 },
    )
    io.observe(v)
    const onLoaded = () => {
      if (move.clip_start != null) v.currentTime = start
    }
    const onTime = () => {
      if (end != null && v.currentTime >= end - 0.05) v.currentTime = start
    }
    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTime)
    return () => {
      io.disconnect()
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTime)
    }
  }, [start, end, move.media_url])

  return (
    <video
      ref={ref}
      src={move.media_url ?? undefined}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
    />
  )
}

export function MoveCard({ move, data }: { move: Move; data?: MoveUserData }) {
  const thumb = thumbFor(move)
  const hasVideo = isVideoUrl(move.media_url)
  const levelColor = move.level ? LEVEL_COLORS[move.level] : 'var(--color-border)'

  return (
    <Link
      to={`/move/${move.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-accent/60 hover:bg-card-hover"
    >
      <div className="relative bg-bg-soft" style={{ aspectRatio: '4/3' }}>
        {hasVideo ? (
          <CardVideo move={move} poster={thumb} />
        ) : thumb ? (
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
