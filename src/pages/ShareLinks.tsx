import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMyShareLinks, useUpdateShareLink, useDeleteShareLink, shareUrlFor } from '../hooks/useShareLinks'

const TYPE_META: Record<string, { icon: string; label: string }> = {
  move: { icon: '💃', label: 'Move/Combo' },
  lesson: { icon: '📹', label: 'Class' },
  collection: { icon: '📚', label: 'Sammlung' },
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

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Meine Links</h1>
        <p className="text-sm text-text-dim">Geteilte Links verwalten — kopieren, um 7 Tage verlängern oder löschen (Zugriff endet sofort).</p>
      </div>

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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
