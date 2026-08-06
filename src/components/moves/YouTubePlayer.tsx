import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/* Minimal typing for the YouTube IFrame API we use. */
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState?: { ENDED: number } }
    onYouTubeIframeAPIReady?: () => void
  }
}
type YTPlayer = {
  getDuration: () => number
  getCurrentTime: () => number
  seekTo: (t: number, allow: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  setPlaybackRate: (r: number) => void
  destroy: () => void
}

export type PlayMode = 'once' | 'loop'
export type YTHandle = {
  seekTo: (t: number) => void
  /** Play [start,end]; mode 'once' pauses at the end, 'loop' repeats the clip. */
  playRange: (start: number, end: number, mode?: PlayMode) => void
  pause: () => void
  setRate: (r: number) => void
  getTime: () => number
}

let apiPromise: Promise<void> | null = null
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

/**
 * YouTube player with an imperative handle (seek/playRange/rate) for the trim editor, plus an
 * optional standalone auto-loop of [autoStart, autoEnd] for previews. Playback is kept tightly
 * inside the clip: a fast poll seeks back (loop) or pauses (once) at the end, and onStateChange
 * catches a real end so the full video / end screen never takes over.
 */
export const YouTubePlayer = forwardRef<
  YTHandle,
  {
    videoId: string
    autoStart?: number | null
    autoEnd?: number | null
    autoLoop?: boolean
    /** Hide YouTube controls/branding as much as possible (for clean looping previews). */
    chromeless?: boolean
    onReady?: (duration: number) => void
    onTime?: (t: number) => void
  }
>(({ videoId, autoStart, autoEnd, autoLoop, chromeless, onReady, onTime }, ref) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const loopStart = useRef(0)
  const loopEnd = useRef<number | null>(null)
  const mode = useRef<PlayMode>('loop')
  const reported = useRef(false)

  const enforceBound = (t: number) => {
    const p = player.current
    if (!p || loopEnd.current == null) return
    if (t >= loopEnd.current - 0.1) {
      if (mode.current === 'loop') {
        p.seekTo(loopStart.current, true)
      } else {
        loopEnd.current = null
        p.pauseVideo()
        p.seekTo(loopStart.current, true) // reset to clip start so a manual replay starts right
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    reported.current = false
    loadApi().then(() => {
      if (cancelled || !hostRef.current) return
      player.current = new window.YT!.Player(hostRef.current, {
        videoId,
        playerVars: chromeless
          ? { rel: 0, playsinline: 1, modestbranding: 1, controls: 0, iv_load_policy: 3, fs: 0, disablekb: 1 }
          : { rel: 0, playsinline: 1, modestbranding: 1, controls: 1 },
        events: {
          onReady: () => {
            const p = player.current
            if (!p) return
            if (!reported.current && p.getDuration() > 0) { reported.current = true; onReady?.(p.getDuration()) }
            if (autoStart != null && autoEnd != null) {
              loopStart.current = autoStart
              loopEnd.current = autoEnd
              mode.current = autoLoop ? 'loop' : 'once'
              p.seekTo(autoStart, true)
              p.playVideo()
            }
          },
          onStateChange: (e: { data: number }) => {
            // ENDED (0): if we're bounding a clip, loop or pause instead of showing the end screen.
            if (e.data === 0 && loopEnd.current != null) {
              const p = player.current
              if (!p) return
              if (mode.current === 'loop') { p.seekTo(loopStart.current, true); p.playVideo() }
              else p.pauseVideo()
            }
          },
        },
      }) as unknown as YTPlayer
    })
    const timer = setInterval(() => {
      const p = player.current
      if (!p?.getCurrentTime) return
      const t = p.getCurrentTime()
      onTime?.(t)
      if (!reported.current && p.getDuration() > 0) { reported.current = true; onReady?.(p.getDuration()) }
      enforceBound(t)
    }, 100)
    return () => {
      cancelled = true
      clearInterval(timer)
      try { player.current?.destroy() } catch { /* ignore */ }
      player.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useImperativeHandle(ref, () => ({
    seekTo: (t) => player.current?.seekTo(t, true),
    playRange: (s, e, m = 'once') => {
      loopStart.current = s
      loopEnd.current = e
      mode.current = m
      player.current?.seekTo(s, true)
      player.current?.playVideo()
    },
    pause: () => {
      loopEnd.current = null
      player.current?.pauseVideo()
    },
    setRate: (r) => player.current?.setPlaybackRate(r),
    getTime: () => player.current?.getCurrentTime?.() ?? 0,
  }))

  return (
    <div className="w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16/9' }}>
      <div ref={hostRef} className="h-full w-full" />
    </div>
  )
})
YouTubePlayer.displayName = 'YouTubePlayer'
