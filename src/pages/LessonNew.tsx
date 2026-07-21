import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadClassVideoSmart, uploadThumb, captureFrame, readVideoDuration } from '../lib/storage'
import { detectSegments, type Segment } from '../lib/segment'
import { CATEGORIES, LEVELS, STYLES } from '../lib/constants'

type Seg = Segment & { name: string; category: string; level: number | '' }

function fmt(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LessonNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)

  const [title, setTitle] = useState('')
  const [school, setSchool] = useState('')
  const [style, setStyle] = useState('bachata')
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [segs, setSegs] = useState<Seg[]>([])
  const [markStart, setMarkStart] = useState<number | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectPct, setDetectPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um Lessons anzulegen.</p>
        <button onClick={() => navigate('/login')} className="mt-2 font-medium text-accent">
          Anmelden →
        </button>
      </div>
    )

  const onPick = async (f: File) => {
    setFile(f)
    const url = URL.createObjectURL(f)
    setFileUrl(url)
    setDuration(await readVideoDuration(f))
    setSegs([])
    setMarkStart(null)
  }

  const now = () => videoRef.current?.currentTime ?? 0

  const addSegment = () => {
    if (markStart == null) {
      setMarkStart(now())
    } else {
      const start = Math.min(markStart, now())
      const end = Math.max(markStart, now())
      if (end - start >= 0.3) {
        setSegs((s) => [...s, { start: +start.toFixed(2), end: +end.toFixed(2), name: '', category: '', level: '' }])
      }
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
      setSegs(segments.map((s) => ({ ...s, name: '', category: '', level: '' as number | '' })))
    } finally {
      setDetecting(false)
    }
  }

  const updateSeg = (i: number, patch: Partial<Seg>) =>
    setSegs((s) => s.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)))

  const play = (s: Seg) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = s.start
    v.play()
    const stop = () => {
      if (v.currentTime >= s.end) {
        v.pause()
        v.removeEventListener('timeupdate', stop)
      }
    }
    v.addEventListener('timeupdate', stop)
  }

  const save = async () => {
    if (!file || !title.trim() || !segs.length) {
      setSaveMsg('Bitte Titel, Video und mindestens ein Segment angeben.')
      return
    }
    setSaving(true)
    setSaveMsg('Video wird hochgeladen…')
    try {
      const { videoId, url } = await uploadClassVideoSmart(file, user.id, {
        title: title.trim(),
        visibility: 'public',
        durationS: duration,
      })

      // lesson
      const { data: lesson, error: le } = await supabase
        .from('lessons')
        .insert({ owner_id: user.id, title: title.trim(), school: school.trim() || null, video_id: videoId })
        .select('id')
        .single()
      if (le) throw le

      // thumbnails + move rows
      const v = videoRef.current!
      const moveIds: string[] = []
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i]
        setSaveMsg(`Segment ${i + 1}/${segs.length} wird verarbeitet…`)
        let thumbUrl: string | null = null
        try {
          const blob = await captureFrame(v, s.start)
          thumbUrl = await uploadThumb(blob, user.id)
        } catch {
          /* thumbnail optional */
        }
        const { data: move, error: me } = await supabase
          .from('moves')
          .insert({
            owner_id: user.id,
            kind: 'move',
            name: s.name.trim() || `${title.trim()} – Move ${i + 1}`,
            style,
            category: s.category || null,
            level: s.level === '' ? null : Number(s.level),
            media_url: url,
            thumb_url: thumbUrl,
            clip_start: s.start,
            clip_end: s.end,
            lesson_id: lesson.id,
            visibility: 'public',
          })
          .select('id')
          .single()
        if (me) throw me
        moveIds.push(move.id)
      }

      // combo for the whole lesson
      setSaveMsg('Combo wird erstellt…')
      const { data: combo, error: ce } = await supabase
        .from('moves')
        .insert({
          owner_id: user.id,
          kind: 'combo',
          name: title.trim(),
          style,
          media_url: url,
          clip_start: 0,
          clip_end: duration,
          lesson_id: lesson.id,
          visibility: 'public',
        })
        .select('id')
        .single()
      if (ce) throw ce
      await supabase
        .from('combo_items')
        .insert(moveIds.map((mid, idx) => ({ combo_id: combo.id, move_id: mid, position: idx })))

      navigate(`/lessons/${lesson.id}`)
    } catch (e) {
      setSaveMsg('Fehler: ' + (e as Error).message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Neue Lesson aus Video</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input placeholder="Schule, z.B. ICB" value={school} onChange={(e) => setSchool(e.target.value)} className={inputCls} />
        <input placeholder="Titel, z.B. Lesson 1" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>
      <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
        {STYLES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      {!fileUrl ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-10 text-center text-text-dim transition hover:border-accent">
          <span className="text-4xl">🎬</span>
          <span className="font-medium">Klassenvideo auswählen</span>
          <span className="text-xs">MP4 empfohlen (iPhone: „Kompatibelste" aufnehmen)</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          />
        </label>
      ) : (
        <>
          <video ref={videoRef} src={fileUrl} controls playsInline className="w-full rounded-2xl bg-black" style={{ maxHeight: '60vh' }} />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addSegment}
              className="rounded-xl border border-accent bg-accent-soft px-4 py-2.5 font-medium text-accent"
            >
              {markStart == null ? '⏺ Segment-Start setzen' : `⏹ Ende setzen (Start ${fmt(markStart)})`}
            </button>
            <button
              onClick={autoDetect}
              disabled={detecting}
              className="rounded-xl border border-border bg-card px-4 py-2.5 font-medium disabled:opacity-60"
            >
              {detecting ? `Analysiere… ${detectPct}%` : '✨ Pausen automatisch erkennen'}
            </button>
          </div>

          {segs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-text-dim">{segs.length} Segmente</p>
              {segs.map((s, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                      {i + 1}
                    </span>
                    <button onClick={() => play(s)} className="text-accent">
                      ▶ {fmt(s.start)}–{fmt(s.end)}
                    </button>
                    <button onClick={() => setSegs((x) => x.filter((_, idx) => idx !== i))} className="ml-auto text-text-dim hover:text-red-400">
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={s.name}
                      onChange={(e) => updateSeg(i, { name: e.target.value })}
                      placeholder={`Move ${i + 1} – Name`}
                      className="min-w-40 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <select value={s.category} onChange={(e) => updateSeg(i, { category: e.target.value })} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                      <option value="">Kategorie…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select value={s.level} onChange={(e) => updateSeg(i, { level: e.target.value === '' ? '' : Number(e.target.value) })} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                      <option value="">Lvl…</option>
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={save}
            disabled={saving || !segs.length}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Speichert…' : `Lesson speichern (${segs.length} Moves + Combo)`}
          </button>
        </>
      )}

      {saveMsg && (
        <p className={`text-center text-sm ${saveMsg.startsWith('Fehler') ? 'text-red-400' : 'text-text-dim'}`}>{saveMsg}</p>
      )}
    </div>
  )
}
