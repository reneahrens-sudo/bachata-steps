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

export function youTubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
}
