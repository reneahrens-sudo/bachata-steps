import { Link } from 'react-router-dom'
import { useLessons } from '../hooks/useLessons'
import { useAuth } from '../hooks/useAuth'

export function Lessons() {
  const { user } = useAuth()
  const { data: lessons = [], isLoading } = useLessons()

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um Lessons zu verwalten.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">
          Anmelden →
        </Link>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meine Lessons</h1>
        <Link to="/lessons/neu" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          ＋ Aus Video
        </Link>
      </div>
      <p className="text-sm text-text-dim">
        Lade ein Klassenvideo hoch, markiere die Moves und alles wird automatisch dieser Lesson zugeordnet.
      </p>

      {isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine Lessons. Leg deine erste aus einem Klassenvideo an! 🎬
        </div>
      ) : (
        Object.entries(
          lessons.reduce<Record<string, typeof lessons>>((acc, l) => {
            const key = l.school?.trim() || 'Ohne Schule'
            ;(acc[key] ??= []).push(l)
            return acc
          }, {}),
        ).map(([schoolName, group]) => (
          <section key={schoolName} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-dim">
              <span>🏫</span> {schoolName}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.map((l) => (
                <Link
                  key={l.id}
                  to={`/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-accent/60 hover:bg-card-hover"
                >
                  <div>
                    <h3 className="font-semibold">{l.title}</h3>
                    <p className="text-sm text-text-dim">{l.count} Einträge</p>
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
