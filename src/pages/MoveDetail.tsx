import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useMove, useComboItems } from '../hooks/useMoves'
import { useMyMoveData, useSaveNotes } from '../hooks/useMyMoveData'
import { useMoveSources, useDeleteMoveMedia } from '../hooks/useMoveMedia'
import { MediaGallery } from '../components/moves/MediaPreview'
import { AddVideoForm } from '../components/moves/AddVideoForm'
import { StatusChips } from '../components/moves/StatusChips'
import { CollectionPicker } from '../components/collections/CollectionPicker'
import { LEVEL_COLORS, categoryLabel, styleLabel } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'
import { MoveCard } from '../components/moves/MoveCard'
import type { Move, SourceLink } from '../lib/types'

export function MoveDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: move, isLoading } = useMove(id)
  const { data: myData } = useMyMoveData()
  const { data: comboItems } = useComboItems(move?.kind === 'combo' ? id : undefined)
  const { data: sources = [] } = useMoveSources(move)
  const delMedia = useDeleteMoveMedia(id ?? '')
  const saveNotes = useSaveNotes()

  // The "family" of a move = its base + all variations of that base (excluding itself),
  // so any move in the group shows the whole set — great for comparing variations.
  const { data: family = [] } = useQuery({
    queryKey: ['family', move?.id, move?.variation_of],
    enabled: !!move,
    queryFn: async (): Promise<Move[]> => {
      const baseId = move!.variation_of ?? move!.id
      const { data } = await supabase.from('moves').select('*').or(`id.eq.${baseId},variation_of.eq.${baseId}`)
      return ((data ?? []) as Move[]).filter((m) => m.id !== move!.id)
    },
  })

  const mine = myData?.[id ?? '']
  const [notes, setNotes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  useEffect(() => setNotes(mine?.notes ?? ''), [mine?.notes])

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!move) return <div className="py-20 text-center text-text-dim">Move nicht gefunden.</div>

  const isOwner = user && move.owner_id === user.id
  const links = (move.source_links as SourceLink[] | null) ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-text-dim hover:text-text">
        ← Zurück
      </button>

      <MediaGallery sources={sources} name={move.name} />

      {user && (
        <div className="space-y-2">
          <AddVideoForm moveId={move.id} />
          {/* extra videos (not the primary) — deletable by their uploader or the move owner */}
          {sources.filter((s) => s.id !== move.id).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sources
                .filter((s) => s.id !== move.id)
                .map((s) => {
                  const canDelete = isOwner || s.owner_id === user.id
                  return (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs text-text-dim">
                      🎬 {s.label ?? 'Video'}
                      {canDelete && (
                        <button onClick={() => delMedia.mutate(s.id)} className="text-text-dim hover:text-red-400" title="Dieses Zusatzvideo entfernen">
                          ✕
                        </button>
                      )}
                    </span>
                  )
                })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{move.name}</h1>
            <p className="mt-1 text-sm text-text-dim">
              {styleLabel(move.style)} · {categoryLabel(move.category)}
              {move.kind === 'combo' && ' · Combo'}
            </p>
          </div>
          {move.level && (
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold text-black"
              style={{ background: LEVEL_COLORS[move.level] }}
            >
              {move.level}
            </span>
          )}
        </div>

        {move.description && <p className="whitespace-pre-wrap text-text-dim">{move.description}</p>}

        {move.tags && move.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {move.tags.map((t) => (
              <span key={t} className="rounded-full bg-card px-2.5 py-1 text-xs text-text-dim">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* status */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-dim">Mein Status</h2>
        <StatusChips moveId={move.id} data={mine} />
      </div>

      {/* combo steps */}
      {move.kind === 'combo' && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-dim">Ablauf ({comboItems?.length ?? 0} Schritte)</h2>
            {isOwner && (
              <Link to={`/move/neu?combo=${move.id}`} className="text-sm font-medium text-accent">
                ＋ Move hinzufügen
              </Link>
            )}
          </div>
          {comboItems && comboItems.length > 0 ? (
            <ol className="space-y-2">
              {comboItems.map((it, i) => (
                <li key={it.id}>
                  <Link to={`/move/${it.move.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-card-hover">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                      {i + 1}
                    </span>
                    <span className="font-medium">{it.move.name}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-dim">Noch keine Moves. Füge welche hinzu.</p>
          )}
        </div>
      )}

      {/* related moves & variations — the whole family, as comparable preview cards */}
      {family.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-dim">
            <span>🔗</span> Verwandte Moves &amp; Varianten ({family.length})
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {family.map((m) => (
              <div key={m.id} className="relative w-40 shrink-0">
                {move.variation_of && m.id === move.variation_of && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Basis
                  </span>
                )}
                <MoveCard move={m} data={myData?.[m.id]} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* notes */}
      {user && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-dim">Meine Notizen</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (mine?.notes ?? '') && saveNotes.mutate({ moveId: move.id, notes })}
            rows={3}
            placeholder="Was ist der Trick bei diesem Move?"
            className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {saveNotes.isPending && <p className="mt-1 text-xs text-text-dim">Speichert…</p>}
        </div>
      )}

      {/* source links */}
      {links.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text-dim">Quellen</h2>
          {links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="block text-sm text-accent hover:underline">
              🔗 {l.label || l.url}
            </a>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2">
        {user && (
          <button
            onClick={() => setPickerOpen(true)}
            className="flex-1 rounded-xl border border-border bg-card py-3 font-medium transition hover:bg-card-hover"
          >
            📚 Zu Sammlung
          </button>
        )}
        {isOwner && (
          <Link
            to={`/move/${move.id}/bearbeiten`}
            className="flex-1 rounded-xl border border-border bg-card py-3 text-center font-medium transition hover:bg-card-hover"
          >
            ✏️ Bearbeiten
          </Link>
        )}
      </div>

      {pickerOpen && <CollectionPicker moveId={move.id} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
