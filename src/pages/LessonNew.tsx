import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadClassVideoSmart, uploadThumb, captureFrame, readVideoDuration, usedStorageBytes, STORAGE_QUOTA_BYTES } from '../lib/storage'
import { detectSegments, type Segment } from '../lib/segment'
import { CATEGORIES, LEVELS, STYLES } from '../lib/constants'
import { MoveNameField, type MoveLink } from '../components/moves/MoveNameField'
import { ComboInput } from '../components/ui/ComboInput'
import { useLessonOptions } from '../hooks/useLessons'
import { attachPreview } from '../lib/previewPipeline'
import { canTranscodeInBrowser, PREVIEW_MAX_SECONDS } from '../lib/previewClip'
import type { Visibility } from '../lib/types'

type Seg = Segment & { name: string; category: string; level: number | ''; link: MoveLink }

function fmt(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.round((t % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${cs}`
}

const SPEEDS = [0.25, 0.5, 1] as const

export function LessonNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)

  const { data: options } = useLessonOptions()
  const [course, setCourse] = useState('')
  const [lessonNumber, setLessonNumber] = useState<number | ''>('')
  const [school, setSchool] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('bachata')
  const [visibility, setVisibility] = useState<Visibility>('unlisted')
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [segs, setSegs] = useState<Seg[]>([])
  const [markStart, setMarkStart] = useState<number | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectPct, setDetectPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um eine Class anzulegen.</p>
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
      if (end - start >= 0.3) {
        setSegs((s) => [...s, { start: +start.toFixed(2), end: +end.toFixed(2), name: '', category: '', level: '', link: null }])
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
      setSegs(segments.map((s) => ({ ...s, name: '', category: '', level: '' as number | '', link: null })))
    } finally {
      setDetecting(false)
    }
  }

  const updateSeg = (i: number, patch: Partial<Seg>) =>
    setSegs((s) => s.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)))

  /** Nudge a segment's start or end by delta seconds, keeping start < end within bounds. */
  const nudge = (i: number, field: 'start' | 'end', delta: number) => {
    setSegs((s) =>
      s.map((seg, idx) => {
        if (idx !== i) return seg
        let v = +(seg[field] + delta).toFixed(2)
        if (field === 'start') v = Math.max(0, Math.min(v, seg.end - 0.2))
        else v = Math.min(duration || seg.end + delta, Math.max(v, seg.start + 0.2))
        // jump the preview to the changed edge so you see it
        if (videoRef.current) videoRef.current.currentTime = v
        return { ...seg, [field]: v }
      }),
    )
  }

  /** Play just this segment (respects the selected slow-motion speed). */
  const play = (s: Seg) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = speed
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
    if (!file || !course.trim() || lessonNumber === '' || !segs.length) {
      setSaveMsg('Bitte Course, Lesson-Nr, Video und mindestens ein Segment angeben.')
      return
    }
    const lessonTitle = `Lektion ${lessonNumber}`
    setSaving(true)
    setSaveMsg('Speicherplatz wird geprüft…')
    try {
      const used = await usedStorageBytes(user.id)
      if (used + file.size > STORAGE_QUOTA_BYTES) {
        const gb = (n: number) => (n / 1e9).toFixed(2)
        setSaveMsg(`Fehler: Speicher voll (${gb(used)} GB belegt, Video ${gb(file.size)} GB, Limit ${gb(STORAGE_QUOTA_BYTES)} GB). Lösche zuerst Videos unter „Meine Videos".`)
        setSaving(false)
        return
      }
      setSaveMsg('Video wird hochgeladen…')
      const { videoId, url } = await uploadClassVideoSmart(file, user.id, {
        title: `${course.trim()} – ${lessonTitle}`,
        visibility,
        durationS: duration,
      })

      const { data: lesson, error: le } = await supabase
        .from('lessons')
        .insert({
          owner_id: user.id,
          title: lessonTitle,
          course: course.trim(),
          lesson_number: Number(lessonNumber),
          school: school.trim() || null,
          notes: description.trim() || null,
          video_id: videoId,
        })
        .select('id')
        .single()
      if (le) throw le

      const v = videoRef.current!
      const moveIds: string[] = []
      const lessonLabel = `${course.trim()} – ${lessonTitle}`
      // Generate small catalog preview clips from the LOCAL file (cheap: input-seek, no re-download).
      // Optional optimization — failures are ignored (catalog falls back to the full video).
      const canPreview = canTranscodeInBrowser(file.size)
      const genPreview = async (moveId: string, from: number, to: number) => {
        if (!canPreview) return
        try { await attachPreview({ moveId, source: file, start: from, end: to, userId: user.id }) }
        catch (e) { console.warn('Vorschau-Clip übersprungen:', e) }
      }
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

        // Assign to an existing move → no new move. If that move has no video yet, this
        // clip becomes its MAIN video (so it previews everywhere); otherwise an extra video.
        if (s.link?.mode === 'assign') {
          const { data: tgt } = await supabase
            .from('moves')
            .select('media_url, youtube_id, owner_id')
            .eq('id', s.link.moveId)
            .single()
          const hasPrimary = !!(tgt && (tgt.media_url || tgt.youtube_id))
          if (!hasPrimary && tgt?.owner_id === user.id) {
            const { error: ue } = await supabase
              .from('moves')
              // link video_id too, so visibility changes on this video cascade to the move
              .update({ media_url: url, thumb_url: thumbUrl, clip_start: s.start, clip_end: s.end, video_id: videoId })
              .eq('id', s.link.moveId)
            if (ue) throw ue
            await genPreview(s.link.moveId, s.start, s.end)
          } else {
            const { error: mme } = await supabase.from('move_media').insert({
              move_id: s.link.moveId,
              owner_id: user.id,
              label: lessonLabel,
              media_url: url,
              thumb_url: thumbUrl,
              clip_start: s.start,
              clip_end: s.end,
            })
            if (mme) throw mme
          }
          moveIds.push(s.link.moveId)
          continue
        }

        // New move (optionally marked as a variation of an existing move).
        const { data: move, error: me } = await supabase
          .from('moves')
          .insert({
            owner_id: user.id,
            kind: 'move',
            name: s.name.trim() || `${course.trim()} L${lessonNumber} – Move ${i + 1}`,
            style,
            category: s.category || null,
            level: s.level === '' ? null : Number(s.level),
            media_url: url,
            thumb_url: thumbUrl,
            clip_start: s.start,
            clip_end: s.end,
            lesson_id: lesson.id,
            video_id: videoId,
            visibility,
            variation_of: s.link?.mode === 'variation' ? s.link.moveId : null,
          })
          .select('id')
          .single()
        if (me) throw me
        moveIds.push(move.id)
        setSaveMsg(`Vorschau-Clip ${i + 1}/${segs.length} wird erstellt…`)
        await genPreview(move.id, s.start, s.end)
      }

      setSaveMsg('Combo wird erstellt…')
      let comboThumb: string | null = null
      try {
        const blob = await captureFrame(v, Math.min(1, duration / 2))
        comboThumb = await uploadThumb(blob, user.id)
      } catch {
        /* thumbnail optional */
      }
      const { data: combo, error: ce } = await supabase
        .from('moves')
        .insert({
          owner_id: user.id,
          kind: 'combo',
          name: `${course.trim()} – ${lessonTitle}`,
          style,
          media_url: url,
          thumb_url: comboThumb,
          clip_start: 0,
          clip_end: duration,
          lesson_id: lesson.id,
          video_id: videoId,
          visibility,
        })
        .select('id')
        .single()
      if (ce) throw ce
      await supabase
        .from('combo_items')
        .insert(moveIds.map((mid, idx) => ({ combo_id: combo.id, move_id: mid, position: idx })))

      setSaveMsg('Vorschau-Clip der Combo wird erstellt…')
      await genPreview(combo.id, 0, Math.min(duration || PREVIEW_MAX_SECONDS, PREVIEW_MAX_SECONDS))

      for (const key of [['lessons'], ['moves'], ['discover'], ['my_videos']]) qc.invalidateQueries({ queryKey: key })
      navigate(`/lessons/${lesson.id}`)
    } catch (e) {
      setSaveMsg('Fehler: ' + (e as Error).message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'
  const nudgeBtn = 'flex-1 rounded-md border border-border bg-bg py-2 text-xs font-medium text-text-dim hover:border-accent hover:text-accent'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Neue Class aus Video</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ComboInput value={school} onChange={setSchool} options={options?.schools ?? []} listId="schools" placeholder="Schule, z.B. ICB" />
        <ComboInput value={course} onChange={setCourse} options={options?.courses ?? []} listId="courses" placeholder="Course, z.B. Foundations 1" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="number"
          min={1}
          placeholder="Lesson-Nr, z.B. 4"
          value={lessonNumber}
          onChange={(e) => setLessonNumber(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputCls}
        />
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
          {STYLES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Beschreibung (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className={inputCls + ' resize-none'}
      />

      <label className="block text-sm text-text-dim">
        Sichtbarkeit
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={inputCls + ' mt-1'}>
          <option value="private">🔒 Privat – nur für dich</option>
          <option value="unlisted">🔗 Nicht gelistet – nur per Link (z.B. für Klassenkamerad:innen)</option>
          <option value="public">🌍 Öffentlich – erscheint unter „Entdecken"</option>
        </select>
        <span className="mt-1 block text-xs text-text-dim">Gilt für das Video und alle daraus erzeugten Moves &amp; die Combo. Später unter „Meine Videos" änderbar.</span>
      </label>

      {!fileUrl ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-10 text-center text-text-dim transition hover:border-accent">
          <span className="text-4xl">🎬</span>
          <span className="font-medium">Klassenvideo auswählen</span>
          <span className="text-xs">MP4 empfohlen (iPhone: „Kompatibelste" aufnehmen)</span>
          <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
        </label>
      ) : (
        <>
          <video ref={videoRef} src={fileUrl} controls playsInline className="w-full rounded-2xl bg-black" style={{ maxHeight: '60vh' }} />

          {/* speed / slow-motion */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-dim">Tempo:</span>
            {SPEEDS.map((sp) => (
              <button
                key={sp}
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

          <div className="flex flex-wrap gap-2">
            <button onClick={addSegment} className="rounded-xl border border-accent bg-accent-soft px-4 py-2.5 font-medium text-accent">
              {markStart == null ? '⏺ Segment-Start setzen' : `⏹ Ende setzen (Start ${fmt(markStart)})`}
            </button>
            <button onClick={autoDetect} disabled={detecting} className="rounded-xl border border-border bg-card px-4 py-2.5 font-medium disabled:opacity-60">
              {detecting ? `Analysiere… ${detectPct}%` : '✨ Pausen automatisch erkennen'}
            </button>
          </div>

          {segs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-text-dim">{segs.length} Segmente</p>
              {segs.map((s, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                    <button onClick={() => play(s)} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white">
                      ▶ Abspielen
                    </button>
                    <span className="text-xs text-text-dim">
                      {fmt(s.start)} – {fmt(s.end)} ({(s.end - s.start).toFixed(1)}s)
                    </span>
                    <button onClick={() => setSegs((x) => x.filter((_, idx) => idx !== i))} className="ml-auto text-text-dim hover:text-red-400">
                      ✕
                    </button>
                  </div>

                  {/* fine-tune start / end */}
                  <div className="mb-2 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-11 shrink-0 text-xs text-text-dim">Start</span>
                      <div className="flex flex-1 gap-1.5">
                        <button onClick={() => nudge(i, 'start', -2)} className={nudgeBtn}>−2s</button>
                        <button onClick={() => nudge(i, 'start', -1)} className={nudgeBtn}>−1s</button>
                        <button onClick={() => nudge(i, 'start', 1)} className={nudgeBtn}>+1s</button>
                        <button onClick={() => nudge(i, 'start', 2)} className={nudgeBtn}>+2s</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-11 shrink-0 text-xs text-text-dim">Ende</span>
                      <div className="flex flex-1 gap-1.5">
                        <button onClick={() => nudge(i, 'end', -2)} className={nudgeBtn}>−2s</button>
                        <button onClick={() => nudge(i, 'end', -1)} className={nudgeBtn}>−1s</button>
                        <button onClick={() => nudge(i, 'end', 1)} className={nudgeBtn}>+1s</button>
                        <button onClick={() => nudge(i, 'end', 2)} className={nudgeBtn}>+2s</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <MoveNameField
                      value={s.name}
                      link={s.link}
                      placeholder={`Move ${i + 1} – Name (tippen für Vorschläge)`}
                      onNameChange={(name) => updateSeg(i, { name })}
                      onLink={(link) => updateSeg(i, link.mode === 'assign' ? { link, name: link.moveName } : { link })}
                      onClearLink={() => updateSeg(i, { link: null })}
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

          <button onClick={save} disabled={saving || !segs.length} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
            {saving ? 'Speichert…' : `Class speichern (${segs.length} Moves + Combo)`}
          </button>
        </>
      )}

      {saveMsg && <p className={`text-center text-sm ${saveMsg.startsWith('Fehler') ? 'text-red-400' : 'text-text-dim'}`}>{saveMsg}</p>}
    </div>
  )
}
