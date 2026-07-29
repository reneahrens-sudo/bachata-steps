import { Link } from 'react-router-dom'

const options = [
  { to: '/move/neu', icon: '💃', title: 'Einzel-Move', desc: 'Move anlegen — Videodatei hochladen & zuschneiden oder YouTube-Link' },
  { to: '/combo/neu-video', icon: '🎥', title: 'Combo aus Video', desc: 'Video hochladen, einzelne Moves markieren & zuschneiden → Combo + Moves im Katalog' },
  { to: '/move/neu?kind=combo', icon: '🎬', title: 'Combo aus Moves', desc: 'Eine Kombination aus bereits vorhandenen Moves zusammenstellen' },
  { to: '/lessons/neu', icon: '📹', title: 'Class aus Video', desc: 'Wie „Combo aus Video", zusätzlich nach Schule / Course / Lektion geordnet' },
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
