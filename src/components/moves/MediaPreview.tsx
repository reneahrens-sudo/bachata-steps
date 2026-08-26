import { useEffect, useRef, useState } from 'react'
import type { MediaSource, Move } from '../../lib/types'
import { youTubeThumb } from '../../lib/youtube'
import { YouTubePlayer } from './YouTubePlayer'

function isVideoUrl(u: string | null | undefined): boolean {
  return !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u)
}

/** Build a MediaSource from a move's primary media fields. */
export function moveToSource(move: Move): MediaSource {
  return {
    id: move.id,
    label: null,
    youtube_id: move.youtube_id,
    media_url: move.media_url,
    thumb_url: move.thumb_url,
    clip_start: move.clip_start,
    clip_end: move.clip_end,
  }
}

/** Best still image for a source. */
export function thumbForSource(s: MediaSource): string | null {
  if (s.thumb_url) return s.thumb_url
  if (s.youtube_id) return youTubeThumb(s.youtube_id)
  if (s.media_url && /\.(gif|jpg|jpeg|png|webp)$/i.test(s.media_url)) return s.media_url
  return null
}

/** Best still image for a move card. */
export function thumbFor(move: Move): string | null {
  return thumbForSource(moveToSource(move))
}

function hasPlayable(s: MediaSource): boolean {
  return !!(s.youtube_id || s.media_url)
}

const CLIP_SPEEDS = [1, 0.5, 0.25] as const

/** Loops a time range [start,end] of a video, with real controls: play/pause, slow-mo, sound, fullscreen. */
function ClipPlayer({ source, className = '' }: { source: MediaSource; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(0)
  const start = source.clip_start ?? 0
  const end = source.clip_end ?? undefined

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const onLoaded = () => {
      v.currentTime = start
      v.play().catch(() => {})
    }
    const onTime = () => {
      if (end != null && v.currentTime >= end - 0.05) v.currentTime = start
    }
    const onPlay = () => setPaused(false)
    const onPause = () => setPaused(true)
    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [start, end, source.media_url])

  const togglePlay = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }
  const cycleSpeed = () => {
    const next = (speedIdx + 1) % CLIP_SPEEDS.length
    setSpeedIdx(next)
    if (ref.current) ref.current.playbackRate = CLIP_SPEEDS[next]
  }
  const toggleFullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  const btn = 'grid h-9 w-9 place-items-center rounded-full bg-black/60 text-sm text-white backdrop-blur transition hover:bg-black/85 active:scale-95'

  return (
    <div ref={wrapRef} className={`relative overflow-hidden rounded-2xl bg-black ${className}`} style={{ aspectRatio: '16/9' }}>
      <video
        ref={ref}
        src={source.media_url ?? undefined}
        poster={source.thumb_url ?? undefined}
        muted={muted}
        loop
        playsInline
        autoPlay
        onClick={togglePlay}
        className="h-full w-full cursor-pointer object-contain"
      />
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        <button onClick={togglePlay} className={btn} title={paused ? 'Abspielen' : 'Pause'}>
          {paused ? '▶' : '⏸'}
        </button>
        <button onClick={cycleSpeed} className={btn + ' w-auto px-2 text-xs font-semibold'} title="Tempo">
          {CLIP_SPEEDS[speedIdx]}×
        </button>
        <button onClick={() => setMuted((m) => !m)} className={btn} title={muted ? 'Ton an' : 'Ton aus'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={toggleFullscreen} className={btn} title="Vollbild">
          ⛶
        </button>
      </div>
    </div>
  )
}

/** Plays any single MediaSource (YouTube facade, looped clip, native video, or still). */
export function MediaSourcePlayer({
  source,
  name = '',
  className = '',
}: {
  source: MediaSource
  name?: string
  className?: string
}) {
  const [playing, setPlaying] = useState(false)
  const poster = thumbForSource(source)

  if (isVideoUrl(source.media_url) && source.clip_start != null) {
    return <ClipPlayer source={source} className={className} />
  }

  if (source.youtube_id) {
    if (!playing) {
      return (
        <button
          onClick={() => setPlaying(true)}
          className={`group relative block w-full overflow-hidden rounded-2xl bg-bg-soft ${className}`}
          style={{ aspectRatio: '16/9' }}
        >
          {poster && <img src={poster} alt={name} className="h-full w-full object-cover" />}
          <span className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/40">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl text-white shadow-lg">▶</span>
          </span>
        </button>
      )
    }
    // If a clip range is set, loop exactly that range; otherwise play the whole video.
    return (
      <div className={className}>
        <YouTubePlayer
          videoId={source.youtube_id}
          autoStart={source.clip_start}
          autoEnd={source.clip_end}
          autoLoop={source.clip_start != null && source.clip_end != null}
          chromeless={source.clip_start != null && source.clip_end != null}
        />
      </div>
    )
  }

  if (isVideoUrl(source.media_url)) {
    return (
      <video
        src={source.media_url!}
        poster={poster ?? undefined}
        controls
        playsInline
        className={`w-full rounded-2xl bg-black ${className}`}
        style={{ aspectRatio: '16/9', objectFit: 'contain' }}
      />
    )
  }

  if (poster) {
    return (
      <img src={poster} alt={name} className={`w-full rounded-2xl object-cover ${className}`} style={{ aspectRatio: '16/9' }} />
    )
  }

  return (
    <div className={`grid w-full place-items-center rounded-2xl bg-bg-soft text-5xl text-text-dim ${className}`} style={{ aspectRatio: '16/9' }}>
      💃
    </div>
  )
}

/** Convenience: play a move's primary media. */
export function MediaPlayer({ move, className = '' }: { move: Move; className?: string }) {
  return <MediaSourcePlayer source={moveToSource(move)} name={move.name} className={className} />
}

/** Multi-source gallery: a picker of thumbnails/labels above the player. */
export function MediaGallery({ sources, name = '' }: { sources: MediaSource[]; name?: string }) {
  const playable = sources.filter(hasPlayable)
  const [idx, setIdx] = useState(0)
  if (!playable.length) return <MediaSourcePlayer source={{ id: 'none', label: null, youtube_id: null, media_url: null, thumb_url: null, clip_start: null, clip_end: null }} name={name} />
  const current = playable[Math.min(idx, playable.length - 1)]

  return (
    <div className="space-y-2">
      <MediaSourcePlayer key={current.id} source={current} name={name} />
      {playable.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {playable.map((s, i) => {
            const thumb = thumbForSource(s)
            const active = i === idx
            return (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                className="relative w-24 shrink-0 overflow-hidden rounded-lg border-2"
                style={{ borderColor: active ? 'var(--color-accent)' : 'transparent', aspectRatio: '16/9' }}
                title={s.label ?? `Video ${i + 1}`}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-bg-soft text-lg">🎬</span>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[10px] text-white">
                  {s.label ?? `Video ${i + 1}`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
