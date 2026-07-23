import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMyVideos, useSetVideoVisibility } from '../hooks/useVideos'

const VIS = [
  { key: 'private', label: '🔒 Privat' },
  { key: 'unlisted', label: '🔗 Nicht gelistet' },
  { key: 'public', label: '🌍 Öffentlich' },
] as const

const QUOTA_GB = 10

export function MyVideos() {
  const { user } = useAuth()
  const { data: videos = [], isLoading } = useMyVideos()
  const setVis = useSetVideoVisibility()

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um deine Videos zu verwalten.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">Anmelden →</Link>
      </div>
    )

  const usedBytes = videos.reduce((a, v) => a + (v.size_bytes ?? 0), 0)
  const usedGb = usedBytes / 1e9
  const pct = Math.min(100, (usedGb / QUOTA_GB) * 100)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Meine Videos</h1>
        <p className="text-sm text-text-dim">Sichtbarkeit gilt automatisch für alle daraus entstandenen Moves &amp; Combos.</p>
      </div>

      {/* storage usage */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-text-dim">Speicher</span>
          <span className="font-medium">{usedGb.toFixed(2)} GB / {QUOTA_GB} GB</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-text-dim">Lädt…</p>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim">
          Noch keine hochgeladenen Videos. Lege eine Class aus einem Video an! 🎬
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => {
            const combo = v.moves.find((m) => m.kind === 'combo')
            const moveList = v.moves.filter((m) => m.kind === 'move')
            const thumb = combo?.thumb_url ?? moveList[0]?.thumb_url ?? null
            const busy = setVis.isPending && setVis.variables?.videoId === v.id
            return (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex gap-3">
                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-bg-soft">
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-2xl">🎬</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{v.title ?? 'Video'}</h3>
                    <p className="text-xs text-text-dim">
                      {v.size_bytes ? `${(v.size_bytes / 1e6).toFixed(0)} MB · ` : ''}
                      {v.moves.length} Einträge{moveList.length ? `: ${moveList.map((m) => m.name).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VIS.map((o) => {
                    const active = v.visibility === o.key
                    return (
                      <button
                        key={o.key}
                        disabled={busy}
                        onClick={() => setVis.mutate({ videoId: v.id, visibility: o.key })}
                        className="rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
                        style={{
                          borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                          background: active ? 'var(--color-accent-soft)' : 'transparent',
                          color: active ? 'var(--color-accent)' : 'var(--color-text-dim)',
                        }}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
