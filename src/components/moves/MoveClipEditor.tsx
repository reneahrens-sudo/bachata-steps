import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useMove } from '../../hooks/useMoves'
import { useMoveSources, useDeleteMoveMedia, useUpdateMoveMedia } from '../../hooks/useMoveMedia'
import { regeneratePreview, clearPreview } from '../../lib/previewPipeline'
import { thumbForSource } from './MediaPreview'
import { AddVideoForm } from './AddVideoForm'
import { YouTubePlayer, type YTHandle } from './YouTubePlayer'
import type { MediaSource } from '../../lib/types'

function fmt(t: number | null | undefined): string {
  if (t == null || isNaN(t)) return '0:00.0'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${cs}`
}
const isNativeVideo = (u: string | null | undefined) => !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u)
const SPEEDS = [0.25, 0.5, 1] as const

/** Unified per-move video manager: pick a video, trim its clip visually (native OR YouTube),
 * remove it, or add one — same editor for all sources. */
export function MoveClipEditor({ moveId }: { moveId: string }) {
  const qc = useQueryClient()
  const { data: move } = useMove(moveId)
  const { data: sources = [] } = useMoveSources(move)
  const delMedia = useDeleteMoveMedia(moveId)
  const updateMedia = useUpdateMoveMedia(moveId)

  const [selId, setSelId] = useState<string | null>(null)
  const sel = sources.find((s) => s.id === selId) ?? sources[0] ?? null

  const videoRef = useRef<HTMLVideoElement>(null)
  const ytRef = useRef<YTHandle>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<null | 'start' | 'end' | 'seek'>(null)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [dur, setDur] = useState(0)
  const [cur, setCur] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [saved, setSaved] = useState(false)
  const [regen, setRegen] = useState(false)

  const native = isNativeVideo(sel?.media_url)
  const isYT = !!sel?.youtube_id && !native

  useEffect(() => {
    if (!sel) return
    setStart(sel.clip_start ?? 0)
    setEnd(sel.clip_end ?? 0)
    setDur(0)
    setCur(0)
    setSpeed(1)
    setSaved(false)
  }, [sel?.id])

  if (!move || !sel) return null
  const isPrimary = sel.id === move.id

  const seekTo = (t: number) => {
    if (native && videoRef.current) videoRef.current.currentTime = t
    else if (isYT) ytRef.current?.seekTo(t)
  }
  const clampStart = (t: number) => Math.max(0, Math.min(t, end - 0.1))
  const clampEnd = (t: number) => Math.min(dur || t, Math.max(t, start + 0.1))

  const timeAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * dur
  }
  const onMove = (e: PointerEvent) => {
    if (!drag.current || !dur) return
    const t = timeAt(e.clientX)
    if (drag.current === 'start') { const v = clampStart(t); setStart(v); seekTo(v) }
    else if (drag.current === 'end') { const v = clampEnd(t); setEnd(v); seekTo(v) }
    else seekTo(t)
  }
  const onUp = () => {
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  const startDrag = (which: 'start' | 'end' | 'seek', e: React.PointerEvent) => {
    drag.current = which
    onMove(e.nativeEvent)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const nudge = (which: 'start' | 'end', d: number) => {
    if (which === 'start') { const v = clampStart(start + d); setStart(v); seekTo(v) }
    else { const v = clampEnd(end + d); setEnd(v); seekTo(v) }
  }
  const setEdgeToPlayhead = (which: 'start' | 'end') => {
    const t = native ? videoRef.current?.currentTime ?? 0 : ytRef.current?.getTime() ?? 0
    if (which === 'start') setStart(clampStart(t))
    else setEnd(clampEnd(t))
  }
  const playClip = () => {
    if (native) {
      const v = videoRef.current
      if (!v) return
      v.playbackRate = speed
      v.currentTime = start
      v.play()
      const stop = () => {
        if (v.currentTime >= end - 0.03) { v.pause(); v.removeEventListener('timeupdate', stop) }
      }
      v.addEventListener('timeupdate', stop)
    } else if (isYT) {
      ytRef.current?.setRate(speed)
      ytRef.current?.playRange(start, end)
    }
  }
  const applyRate = (sp: number) => {
    setSpeed(sp)
    if (native && videoRef.current) videoRef.current.playbackRate = sp
    else if (isYT) ytRef.current?.setRate(sp)
  }

  const save = async () => {
    const patch = { clip_start: +start.toFixed(2), clip_end: +end.toFixed(2) }
    if (isPrimary) {
      await supabase.from('moves').update(patch).eq('id', move.id)
      // The catalog preview clip is derived from this range → rebuild it (old one is cleaned up).
      // The full original video is untouched, so the range stays freely editable afterwards.
      if (isNativeVideo(move.media_url) && move.owner_id) {
        setRegen(true)
        try {
          await regeneratePreview(
            { id: move.id, kind: move.kind, media_url: move.media_url, clip_start: patch.clip_start, clip_end: patch.clip_end, preview_path: move.preview_path },
            move.owner_id,
          )
        } finally { setRegen(false) }
      }
      qc.invalidateQueries({ queryKey: ['move', move.id] })
      qc.invalidateQueries({ queryKey: ['moves'] })
      qc.invalidateQueries({ queryKey: ['move_media', move.id] })
      qc.invalidateQueries({ queryKey: ['lesson'] })
    } else {
      await updateMedia.mutateAsync({ id: sel.id, patch })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const removeVideo = async () => {
    if (isPrimary) {
      if (!confirm('Hauptvideo dieses Moves entfernen?')) return
      await supabase.from('moves').update({ media_url: null, youtube_id: null, thumb_url: null, clip_start: null, clip_end: null }).eq('id', move.id)
      await clearPreview({ id: move.id, preview_path: move.preview_path }) // no source → no catalog preview clip
      qc.invalidateQueries({ queryKey: ['move', move.id] })
      qc.invalidateQueries({ queryKey: ['moves'] })
    } else {
      if (!confirm('Dieses Video entfernen?')) return
      await delMedia.mutateAsync(sel.id)
    }
    setSelId(null)
  }

  const btn = 'rounded-md border border-border bg-bg px-2 py-1.5 text-xs font-medium text-text-dim hover:border-accent hover:text-accent'
  const editable = native || isYT

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-semibold">Videos &amp; Ausschnitte</h2>

      {sources.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {sources.map((s: MediaSource, i) => {
            const active = s.id === sel.id
            const thumb = thumbForSource(s)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelId(s.id)}
                className="relative w-24 shrink-0 overflow-hidden rounded-lg border-2"
                style={{ borderColor: active ? 'var(--color-accent)' : 'transparent', aspectRatio: '16/9' }}
              >
                {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-bg-soft text-lg">🎬</span>}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[10px] text-white">
                  {s.id === move.id ? 'Original' : s.label || `Video ${i + 1}`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {native && (
        <video
          key={sel.id}
          ref={videoRef}
          src={sel.media_url!}
          onLoadedMetadata={() => {
            const v = videoRef.current!
            setDur(v.duration || 0)
            if (!sel.clip_end) setEnd(v.duration || 0)
            v.currentTime = sel.clip_start ?? 0
          }}
          onTimeUpdate={() => setCur(videoRef.current?.currentTime ?? 0)}
          controls
          playsInline
          className="w-full rounded-xl bg-black"
          style={{ maxHeight: '46vh' }}
        />
      )}
      {isYT && (
        <YouTubePlayer
          key={sel.id}
          ref={ytRef}
          videoId={sel.youtube_id!}
          onReady={(d) => { setDur(d); if (!sel.clip_end) setEnd(d) }}
          onTime={setCur}
        />
      )}
      {!editable && <p className="text-sm text-text-dim">Für diese Quelle ist kein Ausschnitt-Editor verfügbar.</p>}

      {editable && (
        <>
          {/* trim bar */}
          <div className="select-none">
            <div ref={trackRef} onPointerDown={(e) => startDrag('seek', e)} className="relative h-8 cursor-pointer rounded-lg bg-bg">
              {dur > 0 && (
                <>
                  <div className="absolute inset-y-0 rounded-lg bg-accent/25" style={{ left: `${(start / dur) * 100}%`, width: `${((end - start) / dur) * 100}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: `${(cur / dur) * 100}%` }} />
                  <div onPointerDown={(e) => { e.stopPropagation(); startDrag('start', e) }} className="absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded bg-accent" style={{ left: `${(start / dur) * 100}%` }} title="Start ziehen" />
                  <div onPointerDown={(e) => { e.stopPropagation(); startDrag('end', e) }} className="absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded bg-accent" style={{ left: `${(end / dur) * 100}%` }} title="Ende ziehen" />
                </>
              )}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-text-dim">
              <span>Start {fmt(start)}</span>
              <span>▸ {fmt(cur)}</span>
              <span>Ende {fmt(end)} · Dauer {(end - start).toFixed(1)}s</span>
            </div>
          </div>

          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={playClip} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">▶ Ausschnitt</button>
            <span className="text-xs text-text-dim">Tempo:</span>
            {SPEEDS.map((sp) => (
              <button key={sp} type="button" onClick={() => applyRate(sp)} className={btn} style={{ borderColor: speed === sp ? 'var(--color-accent)' : undefined, color: speed === sp ? 'var(--color-accent)' : undefined }}>
                {sp === 1 ? '1×' : `${sp}× 🐢`}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-xs text-text-dim">Start</span>
              <button type="button" onClick={() => nudge('start', -1)} className={btn}>−1s</button>
              <button type="button" onClick={() => nudge('start', -0.1)} className={btn}>−0,1</button>
              <button type="button" onClick={() => nudge('start', 0.1)} className={btn}>+0,1</button>
              <button type="button" onClick={() => nudge('start', 1)} className={btn}>+1s</button>
              <button type="button" onClick={() => setEdgeToPlayhead('start')} className={btn + ' flex-1'}>= Playhead</button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-xs text-text-dim">Ende</span>
              <button type="button" onClick={() => nudge('end', -1)} className={btn}>−1s</button>
              <button type="button" onClick={() => nudge('end', -0.1)} className={btn}>−0,1</button>
              <button type="button" onClick={() => nudge('end', 0.1)} className={btn}>+0,1</button>
              <button type="button" onClick={() => nudge('end', 1)} className={btn}>+1s</button>
              <button type="button" onClick={() => setEdgeToPlayhead('end')} className={btn + ' flex-1'}>= Playhead</button>
            </div>
          </div>
        </>
      )}

      {/* actions */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={removeVideo} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
          🗑 Video entfernen
        </button>
        {editable && (
          <button type="button" onClick={save} disabled={regen} className="ml-auto rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
            {regen ? 'Erzeuge Vorschau…' : saved ? '✓ Gespeichert' : 'Ausschnitt speichern'}
          </button>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <AddVideoForm moveId={move.id} />
      </div>
    </div>
  )
}
