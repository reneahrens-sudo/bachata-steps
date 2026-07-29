import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { readVideoDuration } from '../../lib/storage'
import { detectSegments } from '../../lib/segment'
import { CATEGORIES, LEVELS } from '../../lib/constants'
import { MoveNameField, type MoveLink } from './MoveNameField'
import type { VideoSegment } from '../../lib/videoClasses'

export type SegmenterData = { file: File; fileUrl: string; duration: number; segs: VideoSegment[]; videoEl: HTMLVideoElement }
export type SegmenterHandle = { getData: () => SegmenterData | null }

const SPEEDS = [0.25, 0.5, 1] as const

function fmt(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.round((t % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${cs}`
}

/**
 * Reusable video → segment editor. `multi` = mark/trim several moves (Class & Combo aus Video);
 * `single` = one clip spanning/trimmed from the video (single Move). Parent reads state via ref.getData().
 */
export const VideoSegmenter = forwardRef<SegmenterHandle, { mode: 'multi' | 'single' }>(function VideoSegmenter({ mode }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [segs, setSegs] = useState<VideoSegment[]>([])
  const [markStart, setMarkStart] = useState<number | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectPct, setDetectPct] = useState(0)

  useImperativeHandle(ref, () => ({
    getData: () =>
      file && fileUrl && videoRef.current && segs.length ? { file, fileUrl, duration, segs, videoEl: videoRef.current } : null,
  }))

  const onPick = async (f: File) => {
    setFile(f)
    setFileUrl(URL.createObjectURL(f))
    const d = await readVideoDuration(f)
    setDuration(d)
    // single mode → one segment covering the whole clip, ready to trim
    setSegs(mode === 'single' ? [{ start: 0, end: +d.toFixed(2), name: '', category: '', level: '', link: null }] : [])
    setMarkStart(null)
  }

  const now = () => videoRef.current?.currentTime ?? 0
  const setSpeedAll = (sp: number) => {
    setSpeed(sp)
    if (videoRef.current) videoRef.current.playbackRate = sp
  }

  const addSegment = () => {
    if (markStart == null) {
      setMarkStart(now())
    } else {
      const start = Math.min(markStart, now())
      const end = Math.max(markStart, now())
      if (end - start >= 0.3) setSegs((s) => [...s, { start: +start.toFixed(2), end: +end.toFixed(2), name: '', category: '', level: '', link: null }])
      setMarkStart(null)
    }
  }

  const autoDetect = async () => {
    const v = videoRef.current
    if (!v) return
    setDetecting(true)
    setDetectPct(0)
    try {
      const { segments } = await detectSegments(v, { onProgress: setDetectPct })
      setSegs(segments.map((s) => ({ ...s, name: '', category: '', level: '' as number | '', link: null })))
    } finally {
      setDetecting(false)
    }
  }

  const updateSeg = (i: number, patch: Partial<VideoSegment>) => setSegs((s) => s.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)))

  const nudge = (i: number, field: 'start' | 'end', delta: number) => {
    setSegs((s) =>
      s.map((seg, idx) => {
        if (idx !== i) return seg
        let val = +(seg[field] + delta).toFixed(2)
        if (field === 'start') val = Math.max(0, Math.min(val, seg.end - 0.2))
        else val = Math.min(duration || seg.end + delta, Math.max(val, seg.start + 0.2))
        if (videoRef.current) videoRef.current.currentTime = val
        return { ...seg, [field]: val }
      }),
    )
  }

  const play = (s: VideoSegment) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = speed
    v.currentTime = s.start
    v.play()
    const stop = () => {
      if (v.currentTime >= s.end) { v.pause(); v.removeEventListener('timeupdate', stop) }
    }
    v.addEventListener('timeupdate', stop)
  }

  const nudgeBtn = 'flex-1 rounded-md border border-border bg-bg py-2 text-xs font-medium text-text-dim hover:border-accent hover:text-accent'

  if (!fileUrl) {
    return (
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-10 text-center text-text-dim transition hover:border-accent">
        <span className="text-4xl">🎬</span>
        <span className="font-medium">{mode === 'single' ? 'Videodatei auswählen' : 'Video auswählen'}</span>
        <span className="text-xs">MP4 empfohlen (iPhone: „Kompatibelste" aufnehmen)</span>
        <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
      </label>
    )
  }

  return (
    <div className="space-y-3">
      <video ref={videoRef} src={fileUrl} controls playsInline className="w-full rounded-2xl bg-black" style={{ maxHeight: '60vh' }} />

      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-dim">Tempo:</span>
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            type="button"
            onClick={() => setSpeedAll(sp)}
            className="rounded-lg border px-3 py-1.5 font-medium transition"
            style={{
              borderColor: speed === sp ? 'var(--color-accent)' : 'var(--color-border)',
              background: speed === sp ? 'var(--color-accent-soft)' : 'transparent',
              color: speed === sp ? 'var(--color-accent)' : 'var(--color-text-dim)',
            }}
          >
            {sp === 1 ? 'Normal' : `${sp}× 🐢`}
          </button>
        ))}
      </div>

      {mode === 'multi' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addSegment} className="rounded-xl border border-accent bg-accent-soft px-4 py-2.5 font-medium text-accent">
            {markStart == null ? '⏺ Segment-Start setzen' : `⏹ Ende setzen (Start ${fmt(markStart)})`}
          </button>
          <button type="button" onClick={autoDetect} disabled={detecting} className="rounded-xl border border-border bg-card px-4 py-2.5 font-medium disabled:opacity-60">
            {detecting ? `Analysiere… ${detectPct}%` : '✨ Pausen automatisch erkennen'}
          </button>
        </div>
      )}

      {segs.length > 0 && (
        <div className="space-y-2">
          {mode === 'multi' && <p className="text-sm text-text-dim">{segs.length} Segmente</p>}
          {segs.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                {mode === 'multi' && <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>}
                <button type="button" onClick={() => play(s)} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white">▶ Abspielen</button>
                <span className="text-xs text-text-dim">{fmt(s.start)} – {fmt(s.end)} ({(s.end - s.start).toFixed(1)}s)</span>
                {mode === 'multi' && (
                  <button type="button" onClick={() => setSegs((x) => x.filter((_, idx) => idx !== i))} className="ml-auto text-text-dim hover:text-red-400">✕</button>
                )}
              </div>

              <div className="mb-2 space-y-2">
                {(['start', 'end'] as const).map((edge) => (
                  <div key={edge} className="flex items-center gap-1.5">
                    <span className="w-11 shrink-0 text-xs text-text-dim">{edge === 'start' ? 'Start' : 'Ende'}</span>
                    <div className="flex flex-1 gap-1.5">
                      {[-2, -1, 1, 2].map((d) => (
                        <button key={d} type="button" onClick={() => nudge(i, edge, d)} className={nudgeBtn}>{d > 0 ? `+${d}s` : `${d}s`}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {mode === 'multi' && (
                <div className="flex flex-wrap gap-2">
                  <MoveNameField
                    value={s.name}
                    link={s.link}
                    placeholder={`Move ${i + 1} – Name (tippen für Vorschläge)`}
                    onNameChange={(name) => updateSeg(i, { name })}
                    onLink={(link: MoveLink) => updateSeg(i, link?.mode === 'assign' ? { link, name: link.moveName } : { link })}
                    onClearLink={() => updateSeg(i, { link: null })}
                  />
                  <select value={s.category} onChange={(e) => updateSeg(i, { category: e.target.value })} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                    <option value="">Kategorie…</option>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <select value={s.level} onChange={(e) => updateSeg(i, { level: e.target.value === '' ? '' : Number(e.target.value) })} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                    <option value="">Lvl…</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
