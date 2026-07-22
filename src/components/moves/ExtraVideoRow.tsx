import { useState } from 'react'
import { parseTime } from '../../lib/youtube'
import type { MediaSource } from '../../lib/types'

function fmt(t: number | null | undefined): string {
  if (t == null) return ''
  const m = Math.floor(t / 60)
  const s = Math.round(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Manage one additional video of a move: label, clip start/end, delete. */
export function ExtraVideoRow({
  source,
  canManage,
  onSave,
  onDelete,
}: {
  source: MediaSource
  canManage: boolean
  onSave: (id: string, patch: { label: string | null; clip_start: number | null; clip_end: number | null }) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [label, setLabel] = useState(source.label ?? '')
  const [start, setStart] = useState(fmt(source.clip_start))
  const [end, setEnd] = useState(fmt(source.clip_end))
  const [busy, setBusy] = useState(false)
  const kind = source.youtube_id ? 'YouTube' : 'Video'

  if (!canManage) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs text-text-dim">
        🎬 {source.label ?? kind}
      </span>
    )
  }

  const inp = 'rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent'

  return (
    <div className="space-y-2 rounded-xl border border-border bg-bg p-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-text-dim">{kind}</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className={inp + ' flex-1'} />
        <button onClick={() => onDelete(source.id)} className="shrink-0 text-sm text-red-400 hover:underline">
          Entfernen
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-dim">Ausschnitt:</span>
        <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Start 0:45" className={inp + ' w-24'} />
        <span className="text-text-dim">–</span>
        <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Ende 1:10" className={inp + ' w-24'} />
        <button
          onClick={async () => {
            setBusy(true)
            await onSave(source.id, { label: label.trim() || null, clip_start: parseTime(start), clip_end: parseTime(end) })
            setBusy(false)
          }}
          disabled={busy}
          className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? '…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
