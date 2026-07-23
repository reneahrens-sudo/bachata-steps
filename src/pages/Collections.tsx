import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useCollections, useCreateCollection } from '../hooks/useCollections'
import { useAuth } from '../hooks/useAuth'

export function Collections() {
  const { user } = useAuth()
  const { data: collections = [], isLoading, isError, error } = useCollections()
  const create = useCreateCollection()
  const [name, setName] = useState('')

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um Sammlungen zu erstellen.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">
          Anmelden →
        </Link>
      </div>
    )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meine Sammlungen</h1>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              create.mutate({ name: name.trim() })
              setName('')
            }
          }}
          placeholder="Neue Sammlung (z.B. Party-Set)…"
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <button
          onClick={() => {
            if (name.trim()) {
              create.mutate({ name: name.trim() })
              setName('')
            }
          }}
          className="rounded-xl bg-accent px-5 font-semibold text-white"
        >
          Anlegen
        </button>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center text-red-400">Fehler: {(error as Error).message}</div>
      ) : isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine Sammlungen. Leg deine erste an! 📚
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/sammlungen/${c.id}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-accent/60 hover:bg-card-hover"
            >
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-sm text-text-dim">{c.count} Moves</p>
              </div>
              <span className="text-text-dim">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
