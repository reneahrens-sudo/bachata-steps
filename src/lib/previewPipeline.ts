import { supabase } from './supabase'
import { makePreviewClip, canTranscodeInBrowser, COMBO_PREVIEW_MAX_SECONDS } from './previewClip'
import { uploadPreviewClip, deleteVideoObject } from './storage'

const isNativeVideo = (u: string | null) => !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u)
/** Combos (whole class video) get capped; individual moves play their full clip. */
const capFor = (kind: string | null | undefined) => (kind === 'combo' ? COMBO_PREVIEW_MAX_SECONDS : undefined)

type PreviewMove = { id: string; kind?: string | null; media_url: string | null; clip_start: number | null; clip_end: number | null; preview_path: string | null }

/** Generate a preview clip from a local/blob source, upload it, point the move at it, delete the old one. */
export async function attachPreview(opts: {
  moveId: string
  source: Blob
  start: number
  end: number
  userId: string
  oldPath?: string | null
  maxSeconds?: number
  onProgress?: (p: number) => void
}): Promise<string> {
  const blob = await makePreviewClip(opts.source, opts.start, opts.end, { maxSeconds: opts.maxSeconds, onProgress: opts.onProgress })
  const { url, key } = await uploadPreviewClip(blob, opts.userId)
  const { error } = await supabase.from('moves').update({ preview_url: url, preview_path: key }).eq('id', opts.moveId)
  if (error) throw error
  if (opts.oldPath && opts.oldPath !== key) { try { await deleteVideoObject(opts.oldPath) } catch { /* best effort */ } }
  return url
}

export type BackfillProgress = { message: string; done: number; total: number; failed: number; skipped: number; running: boolean }

/** Count of the user's video-moves that still lack a preview clip. */
export async function countMissingPreviews(userId: string): Promise<number> {
  const { data } = await supabase
    .from('moves')
    .select('id, media_url, preview_url')
    .eq('owner_id', userId)
    .is('preview_url', null)
  return (data ?? []).filter((m) => isNativeVideo(m.media_url)).length
}

/**
 * One-time backfill: generate preview clips for existing video-moves that don't have one yet.
 * Downloads each source video ONCE (grouped by URL) and cuts every move's stored range from it.
 * Idempotent (only touches moves with preview_url = null) and cancellable. Original videos untouched.
 */
export async function backfillPreviews(
  userId: string,
  onProgress: (p: BackfillProgress) => void,
  isCancelled: () => boolean,
): Promise<BackfillProgress> {
  const { data } = await supabase
    .from('moves')
    .select('id, kind, media_url, clip_start, clip_end, preview_path, preview_url')
    .eq('owner_id', userId)
    .is('preview_url', null)
  const candidates = (data ?? []).filter((m) => isNativeVideo(m.media_url))

  // Group by source video so each big file is downloaded only once.
  const groups = new Map<string, typeof candidates>()
  for (const m of candidates) {
    const arr = groups.get(m.media_url!) ?? []
    arr.push(m)
    groups.set(m.media_url!, arr)
  }

  const prog: BackfillProgress = { message: 'Starte…', done: 0, total: candidates.length, failed: 0, skipped: 0, running: true }
  onProgress({ ...prog })
  const groupArr = [...groups.entries()]

  for (let g = 0; g < groupArr.length; g++) {
    if (isCancelled()) break
    const [url, moves] = groupArr[g]
    prog.message = `Video ${g + 1}/${groupArr.length} wird geladen…`
    onProgress({ ...prog })
    let blob: Blob
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      blob = await res.blob()
    } catch {
      prog.failed += moves.length
      onProgress({ ...prog })
      continue
    }
    if (!canTranscodeInBrowser(blob.size)) {
      prog.skipped += moves.length
      onProgress({ ...prog })
      continue
    }
    for (let i = 0; i < moves.length; i++) {
      if (isCancelled()) break
      const m = moves[i]
      prog.message = `Video ${g + 1}/${groupArr.length} · Ausschnitt ${i + 1}/${moves.length}`
      onProgress({ ...prog })
      try {
        const cap = capFor(m.kind)
        const start = m.clip_start ?? 0
        const end = m.clip_end ?? start + (cap ?? COMBO_PREVIEW_MAX_SECONDS)
        await attachPreview({ moveId: m.id, source: blob, start, end, userId, oldPath: m.preview_path, maxSeconds: cap })
        prog.done += 1
      } catch {
        prog.failed += 1
      }
      onProgress({ ...prog })
    }
  }

  prog.running = false
  prog.message = isCancelled() ? 'Abgebrochen.' : 'Fertig.'
  onProgress({ ...prog })
  return prog
}

/** Remove a move's preview clip (storage object + columns) — catalog then falls back to the full video. */
export async function clearPreview(move: { id: string; preview_path: string | null }): Promise<void> {
  if (move.preview_path) { try { await deleteVideoObject(move.preview_path) } catch { /* best effort */ } }
  await supabase.from('moves').update({ preview_url: null, preview_path: null }).eq('id', move.id)
}

/**
 * Rebuild a move's preview from its (remote) full video after a clip-range/source change.
 * The old preview is always cleaned up. If the source is missing, too large to transcode in-browser,
 * or unreachable (CORS), the preview is simply cleared and the catalog falls back to the full video.
 */
export async function regeneratePreview(move: PreviewMove, userId: string, onProgress?: (p: number) => void): Promise<string | null> {
  const isClip = move.media_url && /\.(mp4|webm|mov)(\?|$)/i.test(move.media_url) && move.clip_start != null && move.clip_end != null
  if (!isClip) { await clearPreview(move); return null }
  try {
    // Size guard first (avoid downloading a huge file just to bail).
    let bytes = 0
    try {
      const head = await fetch(move.media_url!, { method: 'HEAD' })
      bytes = Number(head.headers.get('content-length') || 0)
    } catch { /* HEAD blocked (CORS) — fall through and check after download */ }
    if (bytes && !canTranscodeInBrowser(bytes)) { await clearPreview(move); return null }

    const res = await fetch(move.media_url!)
    if (!res.ok) { await clearPreview(move); return null }
    const blob = await res.blob()
    if (!canTranscodeInBrowser(blob.size)) { await clearPreview(move); return null }

    return await attachPreview({
      moveId: move.id,
      source: blob,
      start: move.clip_start!,
      end: move.clip_end!,
      userId,
      oldPath: move.preview_path,
      maxSeconds: capFor(move.kind),
      onProgress,
    })
  } catch {
    // Any failure → make sure no stale preview lingers; catalog uses the full video.
    await clearPreview(move)
    return null
  }
}
