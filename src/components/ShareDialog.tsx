import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateShareLink, type ShareTargetType } from '../hooks/useShareLinks'

const EXPIRY_OPTIONS = [
  { hours: 24, label: '24 Stunden' },
  { hours: 24 * 7, label: '7 Tage' },
  { hours: 24 * 30, label: '30 Tage' },
  { hours: null as number | null, label: 'Unbegrenzt' },
]

/** Creates a public share link (with expiry) for one move/combo, lesson or collection. */
export function ShareDialog({
  targetType,
  targetId,
  label,
  onClose,
}: {
  targetType: ShareTargetType
  targetId: string
  label: string
  onClose: () => void
}) {
  const create = useCreateShareLink()
  const [hours, setHours] = useState<number | null>(24 * 7)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const doCreate = async () => {
    setErr(null)
    try {
      setUrl(await create.mutateAsync({ targetType, targetId, label, expiresInHours: hours }))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const copy = async () => {
    if (!url) return
    try {
      if (navigator.share) await navigator.share({ title: label, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch { /* cancelled */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Link teilen</h2>
          <button onClick={onClose} className="text-text-dim">✕</button>
        </div>
        <p className="mb-3 truncate text-sm text-text-dim">{label}</p>

        {!url ? (
          <>
            <p className="mb-2 text-sm font-medium">Gültigkeit</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {EXPIRY_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  onClick={() => setHours(o.hours)}
                  className="rounded-xl border py-2.5 text-sm font-medium transition"
                  style={{
                    borderColor: hours === o.hours ? 'var(--color-accent)' : 'var(--color-border)',
                    background: hours === o.hours ? 'var(--color-accent-soft)' : 'transparent',
                    color: hours === o.hours ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
            <button onClick={doCreate} disabled={create.isPending} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
              {create.isPending ? 'Erstellt…' : 'Link erstellen'}
            </button>
            <p className="mt-2 text-xs text-text-dim">
              Wer den Link hat, sieht nur diesen Inhalt — ohne Zugang zur Plattform.
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 break-all rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs text-text">{url}</div>
            <button onClick={copy} className="w-full rounded-xl bg-accent py-3 font-semibold text-white">
              {copied ? '✓ Kopiert' : '🔗 Link kopieren / teilen'}
            </button>
            <p className="mt-2 text-center text-xs text-text-dim">
              Verwalten (verlängern/löschen) unter <Link to="/links" className="text-accent" onClick={onClose}>Meine Links</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
