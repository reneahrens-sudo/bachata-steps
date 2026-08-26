import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMyShareLinks, useUpdateShareLink, useDeleteShareLink, shareUrlFor } from '../hooks/useShareLinks'
import { ShareDialog } from '../components/ShareDialog'

const TYPE_META: Record<string, { icon: string; label: string }> = {
  move: { icon: '💃', label: 'Move/Combo' },
  lesson: { icon: '📹', label: 'Class' },
  collection: { icon: '📚', label: 'Sammlung' },
  guest: { icon: '🎟️', label: 'Gast-Zugang (ganze Plattform)' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Manage the share links you created: copy, extend expiry, or revoke. */
export function ShareLinks() {
  const { user } = useAuth()
  const { data: links = [], isLoading, isError, error } = useMyShareLinks()
  const update = useUpdateShareLink()
  const del = useDeleteShareLink()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [guestOpen, setGuestOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editUnit, setEditUnit] = useState<'h' | 'd'>('h')

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Nicht angemeldet.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">Anmelden →</Link>
      </div>
    )

  const copy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrlFor(token))
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* ignore */ }
  }

  /** Extend by 7 days — from the current expiry if still in the future, else from now. */
  const extend = (id: string, expiresAt: string | null) => {
    const base = expiresAt && new Date(expiresAt) > new Date() ? new Date(expiresAt) : new Date()
    update.mutate({ id, expires_at: new Date(base.getTime() + 7 * 24 * 3600_000).toISOString() })
  }

  /** Set a free-form duration counted from NOW. */
  const applyCustom = (id: string) => {
    const n = parseFloat(editVal.replace(',', '.'))
    if (!isFinite(n) || n <= 0) return
    const hours = editUnit === 'd' ? n * 24 : n
    update.mutate({ id, expires_at: new Date(Date.now() + hours * 3600_000).toISOString() })
    setEditId(null)
    setEditVal('')
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Meine Links</h1>
        <p className="text-sm text-text-dim">Geteilte Links verwalten — kopieren, verlängern (auch mit eigener Dauer) oder löschen (Zugriff endet sofort).</p>
      </div>

      {/* time-limited guest access to the WHOLE platform */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="font-semibold">🎟️ Gast-Zugang</h2>
          <p className="text-sm text-text-dim">Zeitlich begrenzter Zugang zur gesamten Plattform — ohne eigenes Konto.</p>
        </div>
        <button onClick={() => setGuestOpen(true)} className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          Erstellen
        </button>
      </div>
      {guestOpen && (
        <ShareDialog targetType="guest" targetId={null} label="Gast-Zugang (ganze Plattform)" onClose={() => setGuestOpen(false)} />
      )}

      {isError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center text-red-400">Fehler: {(error as Error).message}</div>
      ) : isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : links.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine Links. Teile einen Move, eine Class oder eine Sammlung über „🔗 Teilen".
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const meta = TYPE_META[l.target_type] ?? { icon: '🔗', label: l.target_type }
            const expired = !!l.expires_at && new Date(l.expires_at) < new Date()
            return (
              <div key={l.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.label ?? meta.label}</p>
                    <p className="text-xs text-text-dim">
                      {meta.label} · {expired ? (
                        <span className="font-medium text-red-400">abgelaufen ({fmtDate(l.expires_at!)})</span>
                      ) : l.expires_at ? (
                        <>läuft ab: {fmtDate(l.expires_at)}</>
                      ) : (
                        'unbegrenzt gültig'
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => copy(l.id, l.token)} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-dim transition hover:border-accent hover:text-accent">
                    {copiedId === l.id ? '✓ Kopiert' : '🔗 Kopieren'}
                  </button>
                  <button onClick={() => extend(l.id, l.expires_at)} disabled={update.isPending} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-dim transition hover:border-accent hover:text-accent disabled:opacity-50">
                    ＋7 Tage
                  </button>
                  <button
                    onClick={() => { setEditId(editId === l.id ? null : l.id); setEditVal('') }}
                    className="rounded-full border px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      borderColor: editId === l.id ? 'var(--color-accent)' : 'var(--color-border)',
                      color: editId === l.id ? 'var(--color-accent)' : 'var(--color-text-dim)',
                    }}
                  >
                    ⏱ Eigene Dauer
                  </button>
                  {l.expires_at && (
                    <button onClick={() => update.mutate({ id: l.id, expires_at: null })} disabled={update.isPending} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-dim transition hover:border-accent hover:text-accent disabled:opacity-50">
                      ∞ Unbegrenzt
                    </button>
                  )}
                  <button
                    onClick={() => confirm('Link löschen? Der Zugriff endet sofort.') && del.mutate(l.id)}
                    disabled={del.isPending}
                    className="ml-auto rounded-full border border-border px-3 py-1.5 text-sm font-medium text-red-400 transition hover:border-red-400/60 disabled:opacity-50"
                  >
                    🗑 Löschen
                  </button>
                </div>
                {editId === l.id && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-bg p-2">
                    <span className="text-sm text-text-dim">Gültig ab jetzt für</span>
                    <input
                      type="number"
                      min={0.1}
                      step="any"
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyCustom(l.id)}
                      placeholder="z.B. 3"
                      className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as 'h' | 'd')} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm">
                      <option value="h">Stunden</option>
                      <option value="d">Tage</option>
                    </select>
                    <button onClick={() => applyCustom(l.id)} disabled={update.isPending} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                      Setzen
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
