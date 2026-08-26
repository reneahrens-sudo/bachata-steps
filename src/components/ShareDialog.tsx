import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateShareLink, type ShareTargetType } from '../hooks/useShareLinks'

const EXPIRY_OPTIONS = [
  { hours: 1, label: '1 Stunde' },
  { hours: 2, label: '2 Stunden' },
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
  targetId: string | null
  label: string
  onClose: () => void
}) {
  const create = useCreateShareLink()
  const [hours, setHours] = useState<number | null | 'custom'>(24 * 7)
  const [customVal, setCustomVal] = useState('')
  const [customUnit, setCustomUnit] = useState<'h' | 'd'>('h')
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const effectiveHours = (): number | null | undefined => {
    if (hours !== 'custom') return hours
    const n = parseFloat(customVal.replace(',', '.'))
    if (!isFinite(n) || n <= 0) return undefined // invalid custom input
    return customUnit === 'd' ? n * 24 : n
  }

  const doCreate = async () => {
    setErr(null)
    const h = effectiveHours()
    if (h === undefined) {
      setErr('Bitte eine gültige Dauer eingeben (z.B. 3).')
      return
    }
    try {
      setUrl(await create.mutateAsync({ targetType, targetId, label, expiresInHours: h }))
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
            <div className="mb-2 grid grid-cols-3 gap-2">
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
            {/* free-form duration */}
            <div
              className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: hours === 'custom' ? 'var(--color-accent)' : 'var(--color-border)' }}
            >
              <span className="text-sm text-text-dim">Eigene Dauer:</span>
              <input
                type="number"
                min={0.1}
                step="any"
                value={customVal}
                onFocus={() => setHours('custom')}
                onChange={(e) => { setCustomVal(e.target.value); setHours('custom') }}
                placeholder="z.B. 3"
                className="w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <select
                value={customUnit}
                onChange={(e) => { setCustomUnit(e.target.value as 'h' | 'd'); setHours('custom') }}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
              >
                <option value="h">Stunden</option>
                <option value="d">Tage</option>
              </select>
            </div>
            {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
            <button onClick={doCreate} disabled={create.isPending} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
              {create.isPending ? 'Erstellt…' : 'Link erstellen'}
            </button>
            <p className="mt-2 text-xs text-text-dim">
              {targetType === 'guest'
                ? 'Wer den Link hat, kann die GESAMTE Plattform als Gast nutzen — bis der Link abläuft oder du ihn löschst.'
                : 'Wer den Link hat, sieht nur diesen Inhalt — ohne Zugang zur Plattform.'}
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
