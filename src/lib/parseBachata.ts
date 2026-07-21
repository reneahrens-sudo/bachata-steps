import { extractYouTubeId } from './youtube'
import type { MoveInsert, SourceLink } from './types'

export type ParsedEntry = {
  ok: boolean
  raw: string
  legacy_id: string | null
  name: string
  style: string
  media_url: string | null
  youtube_id: string | null
  date: string | null
  dancers: string | null
  instagram: string | null
  withAudio: boolean
  isGif: boolean
  note?: string
}

const STYLE_WORDS = ['bachata', 'salsa', 'kizomba', 'zouk', 'fitness']

function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function splitCamel(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
}

/**
 * Parses a bachatasteps.com Bunny-CDN media URL. Filenames look like:
 *   bachata_moveid1952_733d71a6f8a_20251026_crossing-sidewave-rotatew_PiotrDorota_IG-DPVrnf-DCJ1_T51T_withAudio.mp4
 * Everything after the date up to the IG/credit block is the human name.
 */
export function parseBachataUrl(raw: string): ParsedEntry {
  const url = raw.trim()
  const base: ParsedEntry = {
    ok: false,
    raw: url,
    legacy_id: null,
    name: '',
    style: 'bachata',
    media_url: null,
    youtube_id: null,
    date: null,
    dancers: null,
    instagram: null,
    withAudio: false,
    isGif: false,
  }
  if (!url) return base

  // YouTube link → just an embed, no filename metadata
  const yt = extractYouTubeId(url)
  if (yt && !/b-cdn\.net/i.test(url)) {
    return { ...base, ok: true, youtube_id: yt, name: 'YouTube-Video', note: 'YouTube – Name bitte ergänzen' }
  }

  if (!/^https?:\/\//i.test(url)) {
    return { ...base, note: 'Keine gültige URL' }
  }

  const isMedia = /\.(mp4|webm|mov|gif)(\?|$)/i.test(url)
  const fileRaw = url.split('/').pop() ?? ''
  const file = decodeURIComponent(fileRaw).replace(/\?.*$/, '').replace(/\.(mp4|webm|mov|gif)$/i, '')
  const isGif = /\.gif(\?|$)/i.test(url)

  // Not a recognizable media file → keep URL, generic name
  if (!isMedia) {
    return { ...base, ok: true, media_url: url, name: titleCase(file) || 'Import', note: 'Kein Standard-Dateiname – Felder prüfen' }
  }

  const parts = file.split('_')
  const out: ParsedEntry = { ...base, ok: true, media_url: url, isGif, withAudio: /withaudio/i.test(file) }

  if (parts[0] && STYLE_WORDS.includes(parts[0].toLowerCase())) out.style = parts[0].toLowerCase()

  const idIdx = parts.findIndex((p) => /^moveid\d+$/i.test(p))
  if (idIdx >= 0) out.legacy_id = parts[idIdx].replace(/moveid/i, '')

  const dateStr = parts.find((p) => /^\d{8}$/.test(p))
  if (dateStr) out.date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`

  const igPart = parts.find((p) => /^IG-/i.test(p))
  if (igPart) out.instagram = igPart.replace(/^IG-/i, '')

  const dateIdx = dateStr ? parts.indexOf(dateStr) : -1
  const igIdx = igPart ? parts.indexOf(igPart) : parts.length

  if (dateIdx >= 0) {
    // name lives between date and (dancers, IG). Dancer token is the one right before IG.
    const nameEnd = igPart ? igIdx - 1 : igIdx
    const nameParts = parts.slice(dateIdx + 1, Math.max(dateIdx + 1, nameEnd))
    out.name = titleCase(nameParts.join(' '))
    if (igPart && igIdx - 1 > dateIdx) out.dancers = splitCamel(parts[igIdx - 1])
  } else {
    out.name = titleCase(parts.slice(1).join(' '))
  }

  if (!out.name) out.name = 'Import ' + (out.legacy_id ?? '')
  return out
}

/** Turns a parsed entry into a moves-table insert payload. */
export function parsedToMoveInsert(
  e: ParsedEntry,
  opts: { owner_id: string; visibility: string; category?: string | null; level?: number | null },
): MoveInsert {
  const tags: string[] = []
  if (e.dancers) tags.push(e.dancers)
  const sources: SourceLink[] = []
  if (e.instagram) {
    // The IG token is a single Instagram shortcode (base64url — may contain "-" or "_").
    sources.push({ label: 'Instagram', url: `https://www.instagram.com/reel/${e.instagram}/` })
  }
  return {
    owner_id: opts.owner_id,
    kind: 'move',
    name: e.name,
    style: e.style,
    category: opts.category ?? null,
    level: opts.level ?? null,
    media_url: e.media_url,
    thumb_url: null,
    youtube_id: e.youtube_id,
    source_links: sources,
    tags,
    visibility: opts.visibility,
    legacy_id: e.legacy_id ? `bs_${e.legacy_id}` : null,
    is_official: false,
  }
}
