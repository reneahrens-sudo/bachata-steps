import { useState } from 'react'
import { useAddMoveMedia } from '../../hooks/useMoveMedia'
import { extractYouTubeId } from '../../lib/youtube'
import { useAuth } from '../../hooks/useAuth'
import { uploadClassVideoSmart, generateThumbFromFile } from '../../lib/storage'

/** Add an extra teaching video/source to a move: a link (YouTube/URL) or an uploaded file. */
export function AddVideoForm({ moveId }: { moveId: string }) {
  const { user } = useAuth()
  const add = useAddMoveMedia()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'link' | 'file'>('link')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const reset = () => {
    setUrl('')
    setLabel('')
    setFile(null)
    setOpen(false)
    setErr(null)
    setBusy(null)
  }

  const submitLink = async () => {
    setErr(null)
    const u = url.trim()
    if (!u) return
    const yt = extractYouTubeId(u)
    const isMedia = /\.(mp4|webm|mov|gif)(\?|$)/i.test(u)
    if (!yt && !isMedia) {
      setErr('Bitte einen YouTube-Link oder eine direkte Video-/GIF-URL angeben.')
      return
    }
    try {
      await add.mutateAsync({
        move_id: moveId,
        owner_id: user?.id,
        label: label.trim() || null,
        youtube_id: yt,
        media_url: yt ? null : u,
        source_url: u,
      })
      reset()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const submitFile = async () => {
    if (!file || !user) return
    setErr(null)
    try {
      setBusy('Video wird hochgeladen…')
      const { url: mediaUrl } = await uploadClassVideoSmart(file, user.id, { title: label.trim() || file.name })
      setBusy('Vorschaubild wird erstellt…')
      const thumb = await generateThumbFromFile(file, user.id)
      await add.mutateAsync({
        move_id: moveId,
        owner_id: user.id,
        label: label.trim() || null,
        media_url: mediaUrl,
        thumb_url: thumb,
      })
      reset()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(null)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-text-dim transition hover:border-accent hover:text-accent"
      >
        ＋ Weiteres Video / Quelle hinzufügen
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex gap-2">
        {(['link', 'file'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex-1 rounded-lg border py-1.5 text-sm font-medium transition"
            style={{
              borderColor: mode === m ? 'var(--color-accent)' : 'var(--color-border)',
              background: mode === m ? 'var(--color-accent-soft)' : 'transparent',
              color: mode === m ? 'var(--color-accent)' : 'var(--color-text-dim)',
            }}
          >
            {m === 'link' ? '🔗 Link' : '⬆️ Datei hochladen'}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube-Link oder Video-/GIF-URL"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-text-dim hover:border-accent">
          {file ? `🎬 ${file.name}` : '🎬 Videodatei wählen (MP4)'}
          <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label, z.B. Piotr @ ICB oder YouTube Tutorial"
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {err && <p className="text-xs text-red-400">{err}</p>}
      {busy && <p className="text-xs text-text-dim">{busy}</p>}

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-lg border border-border py-2 text-sm text-text-dim">
          Abbrechen
        </button>
        <button
          onClick={mode === 'link' ? submitLink : submitFile}
          disabled={add.isPending || !!busy || (mode === 'file' && !file)}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy || add.isPending ? '…' : 'Hinzufügen'}
        </button>
      </div>
    </div>
  )
}
