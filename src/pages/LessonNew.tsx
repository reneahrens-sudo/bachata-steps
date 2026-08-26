import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadClassVideoSmart, usedStorageBytes, STORAGE_QUOTA_BYTES } from '../lib/storage'
import { buildMovesAndCombo } from '../lib/videoClasses'
import { STYLES } from '../lib/constants'
import { ComboInput } from '../components/ui/ComboInput'
import { useLessonOptions } from '../hooks/useLessons'
import { VideoSegmenter, type SegmenterHandle } from '../components/moves/VideoSegmenter'
import type { Visibility } from '../lib/types'

export function LessonNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const segRef = useRef<SegmenterHandle>(null)

  const { data: options } = useLessonOptions()
  const [course, setCourse] = useState('')
  const [lessonNumber, setLessonNumber] = useState<number | ''>('')
  const [school, setSchool] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('bachata')
  const [visibility, setVisibility] = useState<Visibility>('unlisted')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um eine Class anzulegen.</p>
        <button onClick={() => navigate('/login')} className="mt-2 font-medium text-accent">Anmelden →</button>
      </div>
    )

  const save = async () => {
    const data = segRef.current?.getData()
    if (!course.trim() || lessonNumber === '' || !data) {
      setSaveMsg('Bitte Course, Lesson-Nr, Video und mindestens ein Segment angeben.')
      return
    }
    const lessonTitle = `Lektion ${lessonNumber}`
    const comboName = `${course.trim()} – ${lessonTitle}`
    setSaving(true)
    setSaveMsg('Speicherplatz wird geprüft…')
    try {
      const used = await usedStorageBytes(user.id)
      if (used + data.file.size > STORAGE_QUOTA_BYTES) {
        const gb = (n: number) => (n / 1e9).toFixed(2)
        setSaveMsg(`Fehler: Speicher voll (${gb(used)} GB belegt, Video ${gb(data.file.size)} GB, Limit ${gb(STORAGE_QUOTA_BYTES)} GB). Lösche zuerst Videos unter „Meine Videos".`)
        setSaving(false)
        return
      }
      setSaveMsg('Video wird hochgeladen… 0%')
      const { videoId, url } = await uploadClassVideoSmart(data.file, user.id, {
        title: comboName,
        visibility,
        durationS: data.duration,
        onProgress: (p) => setSaveMsg(`Video wird hochgeladen… ${p}%`),
      })

      const { data: lesson, error: le } = await supabase
        .from('lessons')
        .insert({
          owner_id: user.id, title: lessonTitle, course: course.trim(),
          lesson_number: Number(lessonNumber), school: school.trim() || null,
          notes: description.trim() || null, video_id: videoId,
        })
        .select('id')
        .single()
      if (le) throw le

      const { comboId } = await buildMovesAndCombo({
        file: data.file, videoEl: data.videoEl, duration: data.duration, segs: data.segs,
        userId: user.id, style, visibility, videoId, url,
        comboName, extraVideoLabel: comboName, movePrefix: `${course.trim()} L${lessonNumber} – Move`,
        lessonId: lesson.id, onMsg: setSaveMsg,
      })

      for (const key of [['lessons'], ['moves'], ['discover'], ['my_videos']]) qc.invalidateQueries({ queryKey: key })
      navigate(`/lessons/${lesson.id}`)
      void comboId
    } catch (e) {
      setSaveMsg('Fehler: ' + (e as Error).message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Neue Class aus Video</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ComboInput value={school} onChange={setSchool} options={options?.schools ?? []} listId="schools" placeholder="Schule, z.B. ICB" />
        <ComboInput value={course} onChange={setCourse} options={options?.courses ?? []} listId="courses" placeholder="Course, z.B. Foundations 1" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="number" min={1} placeholder="Lesson-Nr, z.B. 4" value={lessonNumber} onChange={(e) => setLessonNumber(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
          {STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <textarea placeholder="Beschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'} />

      <label className="block text-sm text-text-dim">
        Sichtbarkeit
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={inputCls + ' mt-1'}>
          <option value="private">🔒 Privat – nur für dich</option>
          <option value="unlisted">🔗 Nicht gelistet – nur per Link (z.B. für Klassenkamerad:innen)</option>
          <option value="public">🌍 Öffentlich – erscheint unter „Entdecken"</option>
        </select>
        <span className="mt-1 block text-xs text-text-dim">Gilt für das Video und alle daraus erzeugten Moves &amp; die Combo. Später unter „Meine Videos" änderbar.</span>
      </label>

      <VideoSegmenter ref={segRef} mode="multi" />

      <button onClick={save} disabled={saving} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
        {saving ? 'Speichert…' : 'Class speichern'}
      </button>

      {saveMsg && (
        <p className={`text-center text-sm ${saveMsg.startsWith('Fehler') ? 'text-red-400' : `text-text-dim ${saving ? 'animate-pulse' : ''}`}`}>
          {saveMsg}
        </p>
      )}
      {saving && <p className="text-center text-xs text-text-dim">Bitte die Seite geöffnet lassen — große Videos brauchen etwas.</p>}
    </div>
  )
}
