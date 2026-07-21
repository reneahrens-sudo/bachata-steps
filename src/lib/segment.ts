export type Segment = { start: number; end: number }

/**
 * Analyzes a loaded <video> for motion and proposes segment boundaries at the
 * "still" moments (the teacher pausing between moves). Fully client-side.
 *
 * Approach: sample frames at a fixed rate, compute mean absolute pixel diff to
 * the previous frame on a tiny canvas → a motion curve. Low-motion valleys that
 * are far enough apart become cut points.
 */
export async function detectSegments(
  video: HTMLVideoElement,
  opts: { sampleEvery?: number; minSegment?: number; onProgress?: (pct: number) => void } = {},
): Promise<{ segments: Segment[]; motion: number[]; times: number[] }> {
  const sampleEvery = opts.sampleEvery ?? 0.35
  const minSegment = opts.minSegment ?? 2.0
  const duration = video.duration
  if (!duration || !isFinite(duration)) return { segments: [], motion: [], times: [] }

  const W = 64
  const H = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * W)) || 36
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const seek = (t: number) =>
    new Promise<void>((res) => {
      const on = () => {
        video.removeEventListener('seeked', on)
        res()
      }
      video.addEventListener('seeked', on)
      video.currentTime = Math.min(t, duration - 0.01)
    })

  const motion: number[] = []
  const times: number[] = []
  let prev: Uint8ClampedArray | null = null

  for (let t = 0; t < duration; t += sampleEvery) {
    await seek(t)
    ctx.drawImage(video, 0, 0, W, H)
    const cur = ctx.getImageData(0, 0, W, H).data
    if (prev) {
      let sum = 0
      for (let i = 0; i < cur.length; i += 4) {
        sum += Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2])
      }
      motion.push(sum / (cur.length / 4))
    } else {
      motion.push(0)
    }
    times.push(t)
    prev = cur.slice(0)
    opts.onProgress?.(Math.round((t / duration) * 100))
  }
  opts.onProgress?.(100)

  // Threshold = fraction of the median motion → "still" frames.
  const sorted = [...motion].filter((m) => m > 0).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] || 0
  const thresh = median * 0.45

  // Find valleys (still points) separated by >= minSegment.
  const cutTimes: number[] = [0]
  let lastCut = 0
  for (let i = 1; i < motion.length - 1; i++) {
    const isValley = motion[i] < thresh && motion[i] <= motion[i - 1] && motion[i] <= motion[i + 1]
    if (isValley && times[i] - lastCut >= minSegment) {
      cutTimes.push(times[i])
      lastCut = times[i]
    }
  }
  if (duration - lastCut >= minSegment) cutTimes.push(duration)
  else cutTimes[cutTimes.length - 1] = duration

  const segments: Segment[] = []
  for (let i = 0; i < cutTimes.length - 1; i++) {
    segments.push({ start: +cutTimes[i].toFixed(2), end: +cutTimes[i + 1].toFixed(2) })
  }

  video.currentTime = 0
  return { segments, motion, times }
}
