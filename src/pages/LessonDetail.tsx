import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLesson } from '../hooks/useLessons'
import { ShareDialog } from '../components/ShareDialog'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { useAuth } from '../hooks/useAuth'
import { MediaPlayer } from '../components/moves/MediaPreview'
import { MoveGrid } from '../components/moves/MoveGrid'

export function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useLesson(id)
  const { data: myData } = useMyMoveData()
  const { user } = useAuth()
  const [shareOpen, setShareOpen] = useState(false)

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!data) return <div className="py-20 text-center text-text-dim">Class nicht gefunden.</div>

  const isOwner = user && data.lesson.owner_id === user.id

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/lessons')} className="text-sm text-text-dim hover:text-text">
        ← Classes
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
            {data.lesson.lesson_number != null ? `Lektion ${data.lesson.lesson_number}` : data.lesson.title}
          </h1>
          {data.lesson.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-text-dim">{data.lesson.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {user && (
            <button onClick={() => setShareOpen(true)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              🔗 Teilen
            </button>
          )}
          {isOwner && (
            <Link to={`/lessons/${data.lesson.id}/bearbeiten`} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              ✏️ Bearbeiten
            </Link>
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareDialog
          targetType="lesson"
          targetId={data.lesson.id}
          label={`${data.lesson.course ? data.lesson.course + ' – ' : ''}${data.lesson.lesson_number != null ? `Lektion ${data.lesson.lesson_number}` : data.lesson.title}`}
          onClose={() => setShareOpen(false)}
        />
      )}

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
          <h2 className="text-sm font-semibold text-text-dim">Moves dieser Class ({data.moves.length})</h2>
          <Link to={`/move/neu?lesson=${data.lesson.id}`} className="text-sm font-medium text-accent">
            ＋ Move hinzufügen
          </Link>
        </div>
        <MoveGrid moves={data.moves} myData={myData} />
      </div>
    </div>
  )
}
