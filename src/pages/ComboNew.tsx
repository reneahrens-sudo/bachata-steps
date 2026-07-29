import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { uploadClassVideoSmart, usedStorageBytes, STORAGE_QUOTA_BYTES } from '../lib/storage'
import { buildMovesAndCombo } from '../lib/videoClasses'
import { STYLES } from '../lib/constants'
import { VideoSegmenter, type SegmenterHandle } from '../components/moves/VideoSegmenter'
import type { Visibility } from '../lib/types'

/** Combo aus Video: same segmentation engine as classes, but a plain combo (no school/course/lesson). */
export function ComboNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const segRef = useRef<SegmenterHandle>(null)

  const [name, setName] = useState('')
  const [style, setStyle] = useState('bachata')
  const [visibility, setVisibility] = useState<Visibility>('unlisted')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um eine Combo anzulegen.</p>
        <button onClick={() => navigate('/login')} className="mt-2 font-medium text-accent">Anmelden →</button>
      </div>
    )

  const save = async () => {
    const data = segRef.current?.getData()
    if (!name.trim() || !data) {
      setSaveMsg('Bitte einen Namen, ein Video und mindestens ein Segment angeben.')
      return
    }
    const comboName = name.trim()
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
      setSaveMsg('Video wird hochgeladen…')
      const { videoId, url } = await uploadClassVideoSmart(data.file, user.id, { title: comboName, visibility, durationS: data.duration })

      const { comboId } = await buildMovesAndCombo({
        file: data.file, videoEl: data.videoEl, duration: data.duration, segs: data.segs,
        userId: user.id, style, visibility, videoId, url,
        comboName, extraVideoLabel: comboName, movePrefix: `${comboName} – Move`,
        lessonId: null, onMsg: setSaveMsg,
      })

      for (const key of [['moves'], ['discover'], ['my_videos']]) qc.invalidateQueries({ queryKey: key })
      navigate(`/move/${comboId}`)
    } catch (e) {
      setSaveMsg('Fehler: ' + (e as Error).message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Combo aus Video</h1>
      <p className="text-sm text-text-dim">Video hochladen, einzelne Moves markieren &amp; zuschneiden — sie landen einzeln im Katalog, plus die ganze Combo.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input placeholder="Combo-Name *" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
          {STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <label className="block text-sm text-text-dim">
        Sichtbarkeit
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={inputCls + ' mt-1'}>
          <option value="private">🔒 Privat – nur für dich</option>
          <option value="unlisted">🔗 Nicht gelistet – nur per Link</option>
          <option value="public">🌍 Öffentlich – erscheint unter „Entdecken"</option>
        </select>
        <span className="mt-1 block text-xs text-text-dim">Gilt für das Video und alle daraus erzeugten Moves &amp; die Combo. Später unter „Meine Videos" änderbar.</span>
      </label>

      <VideoSegmenter ref={segRef} mode="multi" />

      <button onClick={save} disabled={saving} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
        {saving ? 'Speichert…' : 'Combo speichern'}
      </button>

      {saveMsg && <p className={`text-center text-sm ${saveMsg.startsWith('Fehler') ? 'text-red-400' : 'text-text-dim'}`}>{saveMsg}</p>}
    </div>
  )
}
