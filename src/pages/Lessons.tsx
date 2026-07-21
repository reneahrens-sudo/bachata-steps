import { Link } from 'react-router-dom'
import { useLessons } from '../hooks/useLessons'
import type { Lesson } from '../lib/types'

type LessonRow = Lesson & { count: number; moveNames: string[] }

export function Lessons() {
  const { data: lessons = [], isLoading } = useLessons()

  // Nested grouping: School → Course → Lessons (sorted by lesson number)
  const bySchool = new Map<string, Map<string, LessonRow[]>>()
  for (const l of lessons) {
    const school = l.school?.trim() || 'Ohne Schule'
    const course = l.course?.trim() || 'Ohne Course'
    if (!bySchool.has(school)) bySchool.set(school, new Map())
    const courses = bySchool.get(school)!
    if (!courses.has(course)) courses.set(course, [])
    courses.get(course)!.push(l)
  }
  const sortLessons = (a: LessonRow, b: LessonRow) =>
    (a.lesson_number ?? 9999) - (b.lesson_number ?? 9999) || a.title.localeCompare(b.title)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Link to="/lessons/neu" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          ＋ Aus Video
        </Link>
      </div>

      {isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine Classes. Leg deine erste aus einem Klassenvideo an! 🎬
        </div>
      ) : (
        [...bySchool.entries()].map(([school, courses]) => (
          <section key={school} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span>🏫</span> {school}
            </h2>
            {[...courses.entries()].map(([course, group]) => (
              <div key={course} className="space-y-2 border-l-2 border-border pl-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-dim">
                  <span>📚</span> {course}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.sort(sortLessons).map((l) => (
                    <Link
                      key={l.id}
                      to={`/lessons/${l.id}`}
                      className="flex items-start justify-between gap-2 rounded-2xl border border-border bg-card p-3 transition hover:border-accent/60 hover:bg-card-hover"
                    >
                      <div className="min-w-0">
                        <h4 className="font-semibold">
                          {l.lesson_number != null ? `Lesson ${l.lesson_number}` : l.title}
                        </h4>
                        <p className="text-xs text-text-dim">{l.count} Moves</p>
                        {l.moveNames.length > 0 && (
                          <p className="mt-1 line-clamp-2 text-sm text-text">
                            {l.moveNames.join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xl">🎬</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
