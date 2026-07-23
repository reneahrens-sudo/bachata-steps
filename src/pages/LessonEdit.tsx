import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useLessonOptions } from '../hooks/useLessons'
import { deleteMovesDeep } from '../lib/moveCleanup'
import { ComboInput } from '../components/ui/ComboInput'

export function LessonEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: options } = useLessonOptions()

  const [school, setSchool] = useState('')
  const [course, setCourse] = useState('')
  const [lessonNumber, setLessonNumber] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSchool(data.school ?? '')
          setCourse(data.course ?? '')
          setLessonNumber(data.lesson_number ?? '')
          setDescription(data.notes ?? '')
        }
        setLoaded(true)
      })
  }, [id])

  if (!user) return <div className="py-20 text-center text-text-dim">Nicht angemeldet.</div>
  if (!loaded) return <div className="py-20 text-center text-text-dim">Lädt…</div>

  const save = async () => {
    setBusy(true)
    setErr(null)
    try {
      const title = lessonNumber === '' ? course.trim() || 'Lektion' : `Lektion ${lessonNumber}`
      const { error } = await supabase
        .from('lessons')
        .update({
          school: school.trim() || null,
          course: course.trim() || null,
          lesson_number: lessonNumber === '' ? null : Number(lessonNumber),
          notes: description.trim() || null,
          title,
        })
        .eq('id', id!)
      if (error) throw error
      // keep the combo's display name in sync
      await supabase
        .from('moves')
        .update({ name: `${course.trim()} – ${title}` })
        .eq('lesson_id', id!)
        .eq('kind', 'combo')
      qc.invalidateQueries({ queryKey: ['lessons'] })
      qc.invalidateQueries({ queryKey: ['lesson', id] })
      navigate(`/lessons/${id}`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  const del = async () => {
    if (!confirm('Diese Class mit allen Moves löschen? Verknüpfungen (Combos, Sammlungen) werden mit entfernt.')) return
    setBusy(true)
    try {
      // This class's own moves + combo (assigned catalog moves have no lesson_id and stay).
      const { data: own } = await supabase.from('moves').select('id, media_url').eq('lesson_id', id!)
      const videoUrl = (own ?? []).find((m) => m.media_url)?.media_url
      // Offer to also remove clips that were assigned from this class's video to OTHER moves.
      if (videoUrl) {
        const { count } = await supabase
          .from('move_media')
          .select('*', { count: 'exact', head: true })
          .eq('media_url', videoUrl)
        if ((count ?? 0) > 0 && confirm(`In anderen Moves gibt es ${count} zugeordnete Videoausschnitte aus dieser Class. Diese auch entfernen?`)) {
          await supabase.from('move_media').delete().eq('media_url', videoUrl)
        }
      }
      await deleteMovesDeep((own ?? []).map((m) => m.id))
      await supabase.from('lessons').delete().eq('id', id!)
      for (const key of [['lessons'], ['lesson', id], ['moves'], ['discover'], ['collections']]) qc.invalidateQueries({ queryKey: key })
      navigate('/lessons')
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Class bearbeiten</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ComboInput value={school} onChange={setSchool} options={options?.schools ?? []} listId="schools-edit" placeholder="Schule, z.B. ICB" />
        <ComboInput value={course} onChange={setCourse} options={options?.courses ?? []} listId="courses-edit" placeholder="Course, z.B. Foundations 1" />
      </div>
      <input
        type="number"
        min={1}
        placeholder="Lesson-Nr, z.B. 4"
        value={lessonNumber}
        onChange={(e) => setLessonNumber(e.target.value === '' ? '' : Number(e.target.value))}
        className={inputCls}
      />
      <textarea
        placeholder="Beschreibung (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={inputCls + ' resize-none'}
      />

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex gap-2">
        <button onClick={() => navigate(`/lessons/${id}`)} className="flex-1 rounded-xl border border-border py-3 font-medium text-text-dim">
          Abbrechen
        </button>
        <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      <button onClick={del} disabled={busy} className="w-full rounded-xl border border-red-500/40 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10">
        🗑 Class löschen
      </button>
    </div>
  )
}
