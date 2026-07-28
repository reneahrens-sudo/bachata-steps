import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Move, MoveUserData, SourceLink, StatusFlag } from '../../lib/types'
import { LEVEL_COLORS, STATUS_META, STATUS_ORDER, categoryLabel } from '../../lib/constants'
import { thumbFor } from './MediaPreview'
import { StatusDots } from './StatusChips'
import { useToggleStatus } from '../../hooks/useMyMoveData'
import { useAuth } from '../../hooks/useAuth'
import { CollectionPicker } from '../collections/CollectionPicker'

function isVideoUrl(u: string | null | undefined): boolean {
  return !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u)
}

const SPEEDS = [1, 0.5, 0.25] as const

export function MoveCard({ move, data }: { move: Move; data?: MoveUserData }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toggle = useToggleStatus()

  const mediaRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [muted, setMuted] = useState(true)
  const [speedIdx, setSpeedIdx] = useState(0)
  const [picker, setPicker] = useState(false)
  const [shared, setShared] = useState(false)
  const [mounted, setMounted] = useState(false) // video element created only near the viewport
  const [playing, setPlaying] = useState(false) // video visible only once it truly plays

  const thumb = thumbFor(move)
  const hasVideo = isVideoUrl(move.media_url)
  const levelColor = move.level ? LEVEL_COLORS[move.level] : 'var(--color-border)'
  const sourceUrl = ((move.source_links as SourceLink[] | null) ?? [])[0]?.url ?? null
  const detailUrl = `/move/${move.id}`

  const start = move.clip_start ?? 0
  const end = move.clip_end ?? undefined

  // Mount the (heavy) <video> only while the card is near the viewport, and UNMOUNT it again
  // when scrolled well away — this bounds how many video decoders exist at once (crucial on iOS)
  // and avoids dozens of parallel downloads. The thumbnail stays visible either way.
  useEffect(() => {
    const el = mediaRef.current
    if (!el || !hasVideo) return
    const io = new IntersectionObserver(
      ([entry]) => {
        setMounted(entry.isIntersecting)
        if (!entry.isIntersecting) setPlaying(false)
      },
      { rootMargin: '250px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasVideo])

  // Once mounted: auto-loop the muted preview only while on screen. The <video> stays hidden
  // (thumbnail shows through) until it actually plays, so tiles never flash black while buffering.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !mounted) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.25 },
    )
    io.observe(v)
    const onLoaded = () => { if (move.clip_start != null) v.currentTime = start }
    const onTime = () => { if (end != null && v.currentTime >= end - 0.05) v.currentTime = start }
    const onPlaying = () => setPlaying(true)
    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('playing', onPlaying)
    return () => {
      io.disconnect()
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('playing', onPlaying)
    }
  }, [mounted, start, end, move.media_url, move.clip_start])

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }

  const cycleSpeed = (e: React.MouseEvent) => {
    stop(e)
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    if (videoRef.current) videoRef.current.playbackRate = SPEEDS[next]
  }
  const toggleSound = (e: React.MouseEvent) => {
    stop(e)
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted) v.play().catch(() => {})
  }
  const fullscreen = (e: React.MouseEvent) => {
    stop(e)
    const el = mediaRef.current
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {})
  }
  const toggleStatus = (e: React.MouseEvent, flag: StatusFlag, active: boolean) => {
    stop(e)
    if (!user) return navigate('/login')
    toggle.mutate({ moveId: move.id, flag, value: !active })
  }
  const share = async (e: React.MouseEvent) => {
    stop(e)
    const url = `${window.location.origin}${detailUrl}`
    try {
      if (navigator.share) await navigator.share({ title: move.name, url })
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500) }
    } catch { /* cancelled */ }
  }
  const openCollection = (e: React.MouseEvent) => { stop(e); if (!user) return navigate('/login'); setPicker(true) }

  // Controls are visible on hover (desktop) or when tapped-expanded (touch).
  const reveal = `pointer-events-none opacity-0 transition group-hover:opacity-100 ${
    expanded ? '!opacity-100' : ''
  }`
  const revealOn = `group-hover:pointer-events-auto ${expanded ? '!pointer-events-auto' : ''}`
  const roundBtn = 'grid h-8 w-8 place-items-center rounded-full bg-black/60 text-sm text-white backdrop-blur transition hover:bg-black/85 active:scale-95'

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-accent/60 hover:shadow-lg hover:shadow-black/20">
      <div ref={mediaRef} className="relative bg-bg-soft" style={{ aspectRatio: '4/3' }}>
        <Link to={detailUrl} className="relative block h-full w-full">
          {/* base layer — always visible instantly (thumbnail or placeholder) */}
          {thumb ? (
            <img src={thumb} alt={move.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-4xl text-text-dim">{move.kind === 'combo' ? '🎬' : '💃'}</div>
          )}
          {/* video overlay — lazy-mounted, fades in only once it actually plays */}
          {hasVideo && mounted && (
            <video
              ref={videoRef}
              src={move.media_url ?? undefined}
              muted={muted}
              loop
              playsInline
              preload="metadata"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 group-hover:scale-[1.03] ${playing ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
        </Link>

        {/* slim bottom gradient for control legibility — video stays fully visible while hovering */}
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent ${reveal}`} />

        {/* level + combo badges */}
        {move.level != null && (
          <span className="absolute left-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full text-sm font-bold text-black shadow" style={{ background: levelColor }}>
            {move.level}
          </span>
        )}
        {move.kind === 'combo' && (
          <span className="absolute left-2 top-10 z-10 rounded-full bg-accent-2/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow">Combo</span>
        )}

        {/* video controls (top-right) */}
        {hasVideo && (
          <div className={`absolute right-2 top-2 z-10 flex flex-col gap-1.5 ${reveal} ${revealOn}`}>
            <button onClick={toggleSound} className={roundBtn} title={muted ? 'Ton an' : 'Ton aus'}>{muted ? '🔇' : '🔊'}</button>
            <button onClick={cycleSpeed} className={roundBtn + ' w-auto px-2 text-xs'} title="Tempo">{SPEEDS[speedIdx]}×</button>
            <button onClick={fullscreen} className={roundBtn} title="Vollbild">⛶</button>
          </div>
        )}

        {/* collapsed: active status dots (bottom-right) + touch reveal trigger (bottom-left) */}
        <div className={`absolute bottom-2 right-2 z-10 transition group-hover:opacity-0 ${expanded ? 'opacity-0' : ''}`}>
          <StatusDots data={data} />
        </div>
        <button
          onClick={(e) => { stop(e); setExpanded((x) => !x) }}
          className={`absolute bottom-2 left-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-sm text-white backdrop-blur transition group-hover:opacity-0 ${expanded ? 'opacity-0' : ''} md:hidden`}
          title="Aktionen"
        >
          ⋯
        </button>

        {/* quick actions pinned to the BOTTOM edge — you keep watching the video above.
            Container stays click-through; empty areas still open the detail page. */}
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-2 ${reveal}`}>
          <div className="flex justify-end gap-1.5">
            <button onClick={openCollection} className={`${roundBtn} ${revealOn}`} title="Zu Sammlung">📚</button>
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`${roundBtn} ${revealOn}`} title="Quelle öffnen">↗</a>
            )}
            <button onClick={share} className={`${roundBtn} ${revealOn}`} title="Teilen">{shared ? '✓' : '🔗'}</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((flag) => {
              const meta = STATUS_META[flag]
              const active = !!data?.[flag]
              return (
                <button
                  key={flag}
                  onClick={(e) => toggleStatus(e, flag, active)}
                  className={`grid h-8 w-8 place-items-center rounded-full border text-sm backdrop-blur transition active:scale-95 ${revealOn}`}
                  style={{
                    borderColor: active ? meta.color : 'rgba(255,255,255,.45)',
                    background: active ? meta.color : 'rgba(0,0,0,.6)',
                    color: active ? '#000' : '#fff',
                  }}
                  title={meta.label}
                >
                  {meta.icon}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to={detailUrl} className="line-clamp-2 text-sm font-semibold leading-snug text-text hover:text-accent">{move.name}</Link>
        <p className="mt-auto text-xs text-text-dim">{categoryLabel(move.category)}</p>
      </div>

      {picker && <CollectionPicker moveId={move.id} onClose={() => setPicker(false)} />}
    </div>
  )
}
