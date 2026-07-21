import { Link } from 'react-router-dom'

const options = [
  { to: '/move/neu', icon: '💃', title: 'Einzel-Move', desc: 'Einen Move mit Video/Link, Kategorie & Level anlegen' },
  { to: '/move/neu?kind=combo', icon: '🎬', title: 'Combo', desc: 'Eine Kombination aus mehreren Moves zusammenstellen' },
  { to: '/lessons/neu', icon: '📹', title: 'Class aus Video', desc: 'Klassenvideo hochladen, nach Course & Lesson ordnen, in Moves zerlegen' },
]

export function NewChooser() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Was möchtest du hinzufügen?</h1>
      <div className="space-y-3">
        {options.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-accent/60 hover:bg-card-hover"
          >
            <span className="text-3xl">{o.icon}</span>
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-text-dim">{o.desc}</span>
            </span>
            <span className="ml-auto text-text-dim">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
