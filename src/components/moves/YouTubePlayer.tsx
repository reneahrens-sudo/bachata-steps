import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/* Minimal typing for the YouTube IFrame API we use. */
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer }
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

export type YTHandle = {
  seekTo: (t: number) => void
  playRange: (start: number, end: number) => void
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

/** YouTube player with an imperative handle (seek/playRange/rate) so it can drive the trim editor. */
export const YouTubePlayer = forwardRef<
  YTHandle,
  { videoId: string; onReady?: (duration: number) => void; onTime?: (t: number) => void }
>(({ videoId, onReady, onTime }, ref) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const loopStart = useRef(0)
  const loopEnd = useRef<number | null>(null)
  const reported = useRef(false)

  useEffect(() => {
    let cancelled = false
    reported.current = false
    loadApi().then(() => {
      if (cancelled || !hostRef.current) return
      player.current = new window.YT!.Player(hostRef.current, {
        videoId,
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
      }) as unknown as YTPlayer
    })
    const timer = setInterval(() => {
      const p = player.current
      if (!p?.getCurrentTime) return
      const t = p.getCurrentTime()
      onTime?.(t)
      if (!reported.current && p.getDuration() > 0) {
        reported.current = true
        onReady?.(p.getDuration())
      }
      if (loopEnd.current != null && t >= loopEnd.current - 0.15) p.seekTo(loopStart.current, true)
    }, 200)
    return () => {
      cancelled = true
      clearInterval(timer)
      try {
        player.current?.destroy()
      } catch {
        /* ignore */
      }
      player.current = null
    }
  }, [videoId])

  useImperativeHandle(ref, () => ({
    seekTo: (t) => player.current?.seekTo(t, true),
    playRange: (s, e) => {
      loopStart.current = s
      loopEnd.current = e
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
