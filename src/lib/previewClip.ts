import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

/** Combos reference the WHOLE class video, so their preview is capped; individual moves play their
 *  full clip (they're already short). Width cap keeps files small. */
export const COMBO_PREVIEW_MAX_SECONDS = 8
const PREVIEW_MAX_WIDTH = 480

// Single-thread core (no SharedArrayBuffer → no COOP/COEP, so R2 media keeps loading). Loads lazily
// from the CDN and ONLY for the person cutting clips (viewers never touch it) — no repo bloat.
// Vite bundles the ffmpeg worker as a MODULE worker, which loads the core via dynamic import(), so
// we must point at the ESM core build (it has a default export); the UMD build would not resolve.
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

let ffmpeg: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  if (!loading) {
    const inst = new FFmpeg()
    loading = (async () => {
      await inst.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpeg = inst
      return inst
    })().catch((e) => { loading = null; throw e }) // let a failed load be retried
  }
  return loading
}

/** True once the source is small enough that transcoding in-browser is reasonable (esp. on phones). */
export function canTranscodeInBrowser(sourceBytes: number): boolean {
  // ffmpeg.wasm must hold the whole input in memory; guard against OOM on large class videos.
  return sourceBytes > 0 && sourceBytes <= 220 * 1024 * 1024
}

/**
 * Cuts a small, compressed, muted preview clip [start,end] from `source` for catalog auto-loops.
 * `maxSeconds` optionally caps the length (used for combos); moves pass none → full clip.
 * Input-seeks (`-ss` before `-i`) so it doesn't decode from the top. Returns an mp4 Blob.
 * Throws on failure — callers treat the preview as optional and fall back to the full video.
 */
export async function makePreviewClip(
  source: Blob,
  start: number,
  end: number,
  opts: { maxSeconds?: number; onProgress?: (p: number) => void } = {},
): Promise<Blob> {
  const raw = Math.max(0.5, end - start)
  const dur = opts.maxSeconds ? Math.min(raw, opts.maxSeconds) : raw
  const onProgress = opts.onProgress
  const ff = await getFFmpeg()
  const onProg = ({ progress }: { progress: number }) => onProgress?.(Math.min(100, Math.round(progress * 100)))
  ff.on('progress', onProg)
  try {
    await ff.writeFile('in.mp4', await fetchFile(source))
    await ff.exec([
      '-ss', String(Math.max(0, start)),
      '-i', 'in.mp4',
      '-t', String(dur),
      '-an',
      '-vf', `scale='min(${PREVIEW_MAX_WIDTH},iw)':-2`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '30',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      'out.mp4',
    ])
    const data = await ff.readFile('out.mp4')
    const bytes = data as Uint8Array
    if (!bytes.length) throw new Error('Vorschau-Clip leer')
    // Copy into a plain ArrayBuffer-backed view (readFile may hand back a SharedArrayBuffer view).
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return new Blob([copy], { type: 'video/mp4' })
  } finally {
    ff.off('progress', onProg)
    try { await ff.deleteFile('in.mp4') } catch { /* ignore */ }
    try { await ff.deleteFile('out.mp4') } catch { /* ignore */ }
  }
}
