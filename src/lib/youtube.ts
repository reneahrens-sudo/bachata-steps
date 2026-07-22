/** Extract the 11-char YouTube video ID from any common URL form (or a bare ID). */
export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return null
}

export function youTubeThumb(id: string, quality: 'hq' | 'mq' | 'max' = 'hq'): string {
  const map = { hq: 'hqdefault', mq: 'mqdefault', max: 'maxresdefault' }
  return `https://i.ytimg.com/vi/${id}/${map[quality]}.jpg`
}

export function youTubeEmbed(id: string, opts?: { start?: number | null; end?: number | null }): string {
  let u = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
  if (opts?.start != null) u += `&start=${Math.floor(opts.start)}`
  if (opts?.end != null) u += `&end=${Math.ceil(opts.end)}`
  return u
}

/** Parses "1:05", "65", or "1:05.5" into seconds; empty/invalid → null. */
export function parseTime(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t)
  const m = t.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2])
  return null
}
