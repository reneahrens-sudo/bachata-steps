import { useState } from 'react'
import { useCollections, useCreateCollection, useAddToCollection } from '../../hooks/useCollections'

export function CollectionPicker({ moveId, onClose }: { moveId: string; onClose: () => void }) {
  const { data: collections = [] } = useCollections()
  const create = useCreateCollection()
  const add = useAddToCollection()
  const [newName, setNewName] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())

  const addTo = async (collectionId: string) => {
    await add.mutateAsync({ collectionId, moveId })
    setAdded((s) => new Set(s).add(collectionId))
  }

  const createAndAdd = async () => {
    if (!newName.trim()) return
    const col = await create.mutateAsync({ name: newName.trim() })
    await addTo(col.id)
    setNewName('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Zu Sammlung hinzufügen</h2>
          <button onClick={onClose} className="text-text-dim">
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
            placeholder="Neue Sammlung…"
            className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={createAndAdd}
            className="rounded-xl bg-accent px-4 text-sm font-semibold text-white"
          >
            ＋
          </button>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {collections.length === 0 && (
            <p className="py-4 text-center text-sm text-text-dim">Noch keine Sammlungen.</p>
          )}
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => addTo(c.id)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-card-hover"
            >
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-text-dim">{c.count} Moves</span>
              </span>
              <span className={added.has(c.id) ? 'text-green-500' : 'text-text-dim'}>
                {added.has(c.id) ? '✓' : '＋'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
