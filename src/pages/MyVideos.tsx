import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useMyVideos, useSetVideoVisibility, useDeleteVideo, type MyVideo } from '../hooks/useVideos'
import { STORAGE_QUOTA_BYTES } from '../lib/storage'
import { backfillPreviews, countMissingPreviews, type BackfillProgress } from '../lib/previewPipeline'

const VIS = [
  { key: 'private', label: '🔒 Privat' },
  { key: 'unlisted', label: '🔗 Nicht gelistet' },
  { key: 'public', label: '🌍 Öffentlich' },
] as const

const QUOTA_GB = STORAGE_QUOTA_BYTES / 1e9

export function MyVideos() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: videos = [], isLoading, isError, error } = useMyVideos()
  const setVis = useSetVideoVisibility()
  const del = useDeleteVideo()
  const [playing, setPlaying] = useState<MyVideo | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const [backfill, setBackfill] = useState<BackfillProgress | null>(null)
  const cancelRef = useRef(false)
  const { data: missing = 0, refetch: refetchMissing } = useQuery({
    queryKey: ['missing_previews', user?.id],
    enabled: !!user,
    queryFn: () => countMissingPreviews(user!.id),
  })
  const runBackfill = async () => {
    if (!user) return
    cancelRef.current = false
    await backfillPreviews(user.id, setBackfill, () => cancelRef.current)
    refetchMissing()
    qc.invalidateQueries({ queryKey: ['moves'] })
  }

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

      {/* one-time backfill: generate small preview clips for existing classes */}
      {(missing > 0 || backfill) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Schnelle Vorschau-Clips</h2>
          <p className="mt-1 text-sm text-text-dim">
            Erzeugt kleine Katalog-Vorschauen aus deinen bestehenden Class-Videos, damit der Katalog schnell lädt
            (wie bei neuen Uploads). Die Originalvideos bleiben unverändert. Am besten am Desktop mit gutem WLAN starten.
          </p>
          {backfill?.running ? (
            <div className="mt-3 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${backfill.total ? Math.round(((backfill.done + backfill.failed + backfill.skipped) / backfill.total) * 100) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm text-text-dim">
                <span>{backfill.message} · {backfill.done}/{backfill.total}</span>
                <button onClick={() => (cancelRef.current = true)} className="rounded-lg border border-border px-3 py-1 font-medium">Abbrechen</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3">
              {missing > 0 && (
                <button onClick={runBackfill} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
                  Vorschau-Clips erzeugen ({missing})
                </button>
              )}
              {backfill && (
                <span className="text-sm text-text-dim">
                  {backfill.message} {backfill.done} erstellt
                  {backfill.failed ? `, ${backfill.failed} fehlgeschlagen` : ''}
                  {backfill.skipped ? `, ${backfill.skipped} übersprungen (zu groß)` : ''}
                  {missing > 0 ? ` · noch ${missing} offen` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {isError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center text-red-400">Fehler: {(error as Error).message}</div>
      ) : isLoading ? (
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
            const busy = (setVis.isPending && setVis.variables?.videoId === v.id) || (del.isPending && del.variables?.videoId === v.id)
            const confirming = confirmId === v.id
            return (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => v.play_url && setPlaying(v)}
                    disabled={!v.play_url}
                    className="group relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-bg-soft disabled:cursor-default"
                    title={v.play_url ? 'Abspielen' : 'Keine abspielbare Quelle'}
                  >
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-2xl">🎬</span>}
                    {v.play_url && (
                      <span className="absolute inset-0 grid place-items-center bg-black/25 text-2xl text-white opacity-90 transition group-hover:bg-black/40">▶</span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{v.title ?? 'Video'}</h3>
                    <p className="text-xs text-text-dim">
                      {v.size_bytes ? `${(v.size_bytes / 1e6).toFixed(0)} MB · ` : ''}
                      {v.moves.length} Einträge{moveList.length ? `: ${moveList.map((m) => m.name).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                  <button
                    disabled={busy}
                    onClick={() => setConfirmId(v.id)}
                    className="ml-auto rounded-full border border-border px-3 py-1.5 text-sm font-medium text-red-400 transition hover:border-red-400/60 disabled:opacity-50"
                  >
                    🗑 Löschen
                  </button>
                </div>

                {confirming && (
                  <div className="mt-2 rounded-xl border border-red-400/40 bg-red-500/5 p-3 text-sm">
                    <p className="text-text">
                      Video wirklich löschen?
                      {v.moves.length > 0 && (
                        <> Daraus entstandene Moves/Combos ({v.moves.length}) werden entfernt — <b>außer</b> sie haben noch ein weiteres Video, dann bleiben sie erhalten.</>
                      )}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() =>
                          del.mutate(
                            { videoId: v.id, storagePath: v.storage_path, publicUrl: v.public_url },
                            { onSettled: () => setConfirmId(null), onError: (e) => alert((e as Error).message) },
                          )
                        }
                        className="rounded-lg bg-red-500 px-4 py-1.5 font-semibold text-white disabled:opacity-50"
                      >
                        {busy ? 'Löscht…' : 'Endgültig löschen'}
                      </button>
                      <button disabled={busy} onClick={() => setConfirmId(null)} className="rounded-lg border border-border px-4 py-1.5">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setPlaying(null)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <video src={playing.play_url!} controls autoPlay playsInline className="max-h-[80svh] w-full rounded-xl bg-black" />
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-sm text-white/80">{playing.title ?? 'Video'}</span>
              <button onClick={() => setPlaying(null)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
