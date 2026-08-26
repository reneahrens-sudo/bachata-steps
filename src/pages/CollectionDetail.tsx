import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { useAuth } from '../hooks/useAuth'
import { useUpdateCollection, useRemoveFromCollection, useReorderCollection } from '../hooks/useCollections'
import { MoveGrid } from '../components/moves/MoveGrid'
import { ShareDialog } from '../components/ShareDialog'
import type { Collection, Move } from '../lib/types'

export function CollectionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { data: myData } = useMyMoveData()
  const [shareOpen, setShareOpen] = useState(false)
  const [manage, setManage] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)

  const update = useUpdateCollection()
  const removeItem = useRemoveFromCollection()
  const reorder = useReorderCollection()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['collection', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: col, error: ce } = await supabase.from('collections').select('*').eq('id', id!).maybeSingle()
      if (ce) throw ce
      const { data: items, error: ie } = await supabase
        .from('collection_items')
        .select('position, move:moves(*)')
        .eq('collection_id', id!)
        .order('position', { ascending: true })
      if (ie) throw ie
      const rows = (items ?? []) as unknown as Array<{ move: Move | null }>
      return { collection: col as Collection | null, moves: rows.map((i) => i.move).filter((m): m is Move => !!m) }
    },
  })

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from('collection_items').delete().eq('collection_id', id!)
      await supabase.from('share_links').delete().eq('target_id', id!)
      const { error } = await supabase.from('collections').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      navigate('/sammlungen')
    },
  })

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (isError) return <div className="py-20 text-center text-red-400">Fehler: {(error as Error).message}</div>
  if (!data?.collection) return <div className="py-20 text-center text-text-dim">Sammlung nicht gefunden.</div>

  const col = data.collection
  const isOwner = user && col.owner_id === user.id

  const move = (idx: number, dir: -1 | 1) => {
    const ids = data.moves.map((m) => m.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    qc.setQueryData(['collection', id], { ...data, moves: swap(data.moves, idx, j) })
    reorder.mutate({ collectionId: col.id, orderedMoveIds: ids })
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/sammlungen')} className="text-sm text-text-dim hover:text-text">
        ← Sammlungen
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingName !== null ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-xl font-bold outline-none focus:border-accent"
              />
              <button
                onClick={() => { if (editingName.trim()) update.mutate({ collectionId: col.id, name: editingName.trim() }); setEditingName(null) }}
                className="rounded-lg bg-accent px-3 text-sm font-semibold text-white"
              >
                ✓
              </button>
              <button onClick={() => setEditingName(null)} className="rounded-lg border border-border px-3 text-sm">✕</button>
            </div>
          ) : (
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {col.name}
              {isOwner && (
                <button onClick={() => setEditingName(col.name)} className="text-sm text-text-dim hover:text-accent" title="Umbenennen">✏️</button>
              )}
            </h1>
          )}
          <p className="text-sm text-text-dim">{data.moves.length} Moves</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setShareOpen(true)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
            🔗 Teilen
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => setManage((m) => !m)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
                style={{ borderColor: manage ? 'var(--color-accent)' : undefined, color: manage ? 'var(--color-accent)' : undefined }}
              >
                {manage ? 'Fertig' : '✏️ Bearbeiten'}
              </button>
              <button
                onClick={() => confirm('Sammlung löschen?') && del.mutate()}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-red-400"
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>

      {shareOpen && <ShareDialog targetType="collection" targetId={col.id} label={col.name} onClose={() => setShareOpen(false)} />}

      {data.moves.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine Moves. Füge welche über das ＋-Symbol auf einer Move-Seite hinzu.
        </div>
      ) : manage ? (
        <ul className="space-y-2">
          {data.moves.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-text-dim hover:text-accent disabled:opacity-30">▲</button>
                <button onClick={() => move(i, 1)} disabled={i === data.moves.length - 1} className="px-1 text-text-dim hover:text-accent disabled:opacity-30">▼</button>
              </div>
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-bg-soft">
                {m.thumb_url ? <img src={m.thumb_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">💃</span>}
              </div>
              <Link to={`/move/${m.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{m.name}</Link>
              <button
                onClick={() => removeItem.mutate({ collectionId: col.id, moveId: m.id })}
                className="px-2 text-text-dim hover:text-red-400"
                title="Aus Sammlung entfernen"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <MoveGrid moves={data.moves} myData={myData} />
      )}
    </div>
  )
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = arr.slice()
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}
