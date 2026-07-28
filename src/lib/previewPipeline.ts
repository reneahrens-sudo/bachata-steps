import { supabase } from './supabase'
import { makePreviewClip, canTranscodeInBrowser } from './previewClip'
import { uploadPreviewClip, deleteVideoObject } from './storage'

type PreviewMove = { id: string; media_url: string | null; clip_start: number | null; clip_end: number | null; preview_path: string | null }

/** Generate a preview clip from a local/blob source, upload it, point the move at it, delete the old one. */
export async function attachPreview(opts: {
  moveId: string
  source: Blob
  start: number
  end: number
  userId: string
  oldPath?: string | null
  onProgress?: (p: number) => void
}): Promise<string> {
  const blob = await makePreviewClip(opts.source, opts.start, opts.end, opts.onProgress)
  const { url, key } = await uploadPreviewClip(blob, opts.userId)
  const { error } = await supabase.from('moves').update({ preview_url: url, preview_path: key }).eq('id', opts.moveId)
  if (error) throw error
  if (opts.oldPath && opts.oldPath !== key) { try { await deleteVideoObject(opts.oldPath) } catch { /* best effort */ } }
  return url
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
      onProgress,
    })
  } catch {
    // Any failure → make sure no stale preview lingers; catalog uses the full video.
    await clearPreview(move)
    return null
  }
}
