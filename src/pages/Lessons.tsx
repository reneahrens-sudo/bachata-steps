import { Link } from 'react-router-dom'
import { useLessons } from '../hooks/useLessons'

export function Lessons() {
  const { data: lessons = [], isLoading } = useLessons()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Link to="/lessons/neu" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          ＋ Aus Video
        </Link>
      </div>
      <p className="text-sm text-text-dim">
        Lade ein Klassenvideo hoch, markiere die Moves — alles wird nach Course &amp; Lesson gruppiert.
      </p>

      {isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine Classes. Leg deine erste aus einem Klassenvideo an! 🎬
        </div>
      ) : (
        Object.entries(
          lessons.reduce<Record<string, typeof lessons>>((acc, l) => {
            const key = l.course?.trim() || l.school?.trim() || 'Ohne Course'
            ;(acc[key] ??= []).push(l)
            return acc
          }, {}),
        ).map(([courseName, group]) => (
          <section key={courseName} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-dim">
              <span>📚</span> {courseName}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.map((l) => (
                <Link
                  key={l.id}
                  to={`/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-accent/60 hover:bg-card-hover"
                >
                  <div>
                    <h3 className="font-semibold">
                      {l.lesson_number != null ? `Lesson ${l.lesson_number}` : l.title}
                    </h3>
                    <p className="text-sm text-text-dim">
                      {l.count} Moves{l.school ? ` · ${l.school}` : ''}
                    </p>
                  </div>
                  <span className="text-2xl">🎬</span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
