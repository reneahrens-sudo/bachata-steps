import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useLesson } from '../hooks/useLessons'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { MediaPlayer } from '../components/moves/MediaPreview'
import { MoveGrid } from '../components/moves/MoveGrid'
import { supabase } from '../lib/supabase'

export function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useLesson(id)
  const { data: myData } = useMyMoveData()

  const del = useMutation({
    mutationFn: async () => {
      // remove lesson's moves + combo, then the lesson
      await supabase.from('moves').delete().eq('lesson_id', id!)
      await supabase.from('lessons').delete().eq('id', id!)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lessons'] })
      qc.invalidateQueries({ queryKey: ['moves'] })
      navigate('/lessons')
    },
  })

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!data) return <div className="py-20 text-center text-text-dim">Lesson nicht gefunden.</div>

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/lessons')} className="text-sm text-text-dim hover:text-text">
        ← Lessons
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          {(data.lesson.course || data.lesson.school) && (
            <p className="text-sm text-text-dim">
              {data.lesson.school ? `🏫 ${data.lesson.school} · ` : ''}
              {data.lesson.course ? `📚 ${data.lesson.course}` : ''}
            </p>
          )}
          <h1 className="text-2xl font-bold">
            {data.lesson.lesson_number != null ? `Lesson ${data.lesson.lesson_number}` : data.lesson.title}
          </h1>
        </div>
        <button
          onClick={() => confirm('Lesson mit allen Moves löschen?') && del.mutate()}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-red-400"
        >
          🗑
        </button>
      </div>

      {data.combo && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-dim">Ganze Combo</h2>
          <MediaPlayer move={data.combo} />
          <Link to={`/move/${data.combo.id}`} className="inline-block text-sm text-accent">
            Combo-Details →
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-dim">Moves dieser Lesson ({data.moves.length})</h2>
          <Link to={`/move/neu?lesson=${data.lesson.id}`} className="text-sm font-medium text-accent">
            ＋ Move hinzufügen
          </Link>
        </div>
        <MoveGrid moves={data.moves} myData={myData} />
      </div>
    </div>
  )
}
