import { supabase } from './supabase'
import { captureFrame, uploadThumb } from './storage'
import { attachPreview } from './previewPipeline'
import { canTranscodeInBrowser, COMBO_PREVIEW_MAX_SECONDS } from './previewClip'
import type { MoveLink } from '../components/moves/MoveNameField'

export type VideoSegment = {
  start: number
  end: number
  name: string
  category: string
  level: number | ''
  link: MoveLink
}

/**
 * Shared engine behind "Class aus Video" and "Combo aus Video": from an already-uploaded video
 * (videoId/url) and a list of segments, creates the individual moves (or assigns to existing ones),
 * a parent combo, links them, and generates small catalog preview clips from the local file.
 * Pass `lessonId` to file it under a class; omit for a plain combo. The original video is untouched.
 */
export async function buildMovesAndCombo(opts: {
  file: File
  videoEl: HTMLVideoElement
  duration: number
  segs: VideoSegment[]
  userId: string
  style: string
  visibility: string
  videoId: string
  url: string
  comboName: string
  extraVideoLabel: string
  movePrefix: string
  lessonId?: string | null
  onMsg?: (m: string) => void
}): Promise<{ comboId: string; moveIds: string[] }> {
  const { file, videoEl: v, duration, segs, userId, style, visibility, videoId, url, comboName, extraVideoLabel, movePrefix, lessonId = null, onMsg } = opts

  const canPreview = canTranscodeInBrowser(file.size)
  const genPreview = async (moveId: string, from: number, to: number, maxSeconds?: number, msgPrefix?: string) => {
    if (!canPreview) return
    try {
      await attachPreview({
        moveId, source: file, start: from, end: to, userId, maxSeconds,
        onProgress: msgPrefix ? (p) => onMsg?.(`${msgPrefix} ${p}%`) : undefined,
      })
    } catch (e) { console.warn('Vorschau-Clip übersprungen:', e) }
  }

  const moveIds: string[] = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    onMsg?.(`Segment ${i + 1}/${segs.length} wird verarbeitet…`)
    let thumbUrl: string | null = null
    try {
      const blob = await captureFrame(v, s.start)
      thumbUrl = await uploadThumb(blob, userId)
    } catch { /* thumbnail optional */ }

    // Assign to an existing move → no new move. Promote to primary if it has no video yet (& you own it).
    if (s.link?.mode === 'assign') {
      const { data: tgt } = await supabase.from('moves').select('media_url, youtube_id, owner_id').eq('id', s.link.moveId).single()
      const hasPrimary = !!(tgt && (tgt.media_url || tgt.youtube_id))
      if (!hasPrimary && tgt?.owner_id === userId) {
        const { error: ue } = await supabase
          .from('moves')
          .update({ media_url: url, thumb_url: thumbUrl, clip_start: s.start, clip_end: s.end, video_id: videoId })
          .eq('id', s.link.moveId)
        if (ue) throw ue
        await genPreview(s.link.moveId, s.start, s.end, undefined, `Vorschau-Clip ${i + 1}/${segs.length} wird erstellt…`)
      } else {
        const { error: mme } = await supabase.from('move_media').insert({
          move_id: s.link.moveId, owner_id: userId, label: extraVideoLabel,
          media_url: url, thumb_url: thumbUrl, clip_start: s.start, clip_end: s.end,
        })
        if (mme) throw mme
      }
      moveIds.push(s.link.moveId)
      continue
    }

    // New move (optionally a variation of an existing move).
    const { data: move, error: me } = await supabase
      .from('moves')
      .insert({
        owner_id: userId,
        kind: 'move',
        name: s.name.trim() || `${movePrefix} ${i + 1}`,
        style,
        category: s.category || null,
        level: s.level === '' ? null : Number(s.level),
        media_url: url,
        thumb_url: thumbUrl,
        clip_start: s.start,
        clip_end: s.end,
        lesson_id: lessonId,
        video_id: videoId,
        visibility,
        variation_of: s.link?.mode === 'variation' ? s.link.moveId : null,
      })
      .select('id')
      .single()
    if (me) throw me
    moveIds.push(move.id)
    onMsg?.(`Vorschau-Clip ${i + 1}/${segs.length} wird erstellt…`)
    await genPreview(move.id, s.start, s.end, undefined, `Vorschau-Clip ${i + 1}/${segs.length} wird erstellt…`)
  }

  onMsg?.('Combo wird erstellt…')
  let comboThumb: string | null = null
  try {
    const blob = await captureFrame(v, Math.min(1, duration / 2))
    comboThumb = await uploadThumb(blob, userId)
  } catch { /* thumbnail optional */ }
  const { data: combo, error: ce } = await supabase
    .from('moves')
    .insert({
      owner_id: userId, kind: 'combo', name: comboName, style,
      media_url: url, thumb_url: comboThumb, clip_start: 0, clip_end: duration,
      lesson_id: lessonId, video_id: videoId, visibility,
    })
    .select('id')
    .single()
  if (ce) throw ce
  await supabase.from('combo_items').insert(moveIds.map((mid, idx) => ({ combo_id: combo.id, move_id: mid, position: idx })))

  onMsg?.('Vorschau-Clip der Combo wird erstellt…')
  await genPreview(combo.id, 0, duration || COMBO_PREVIEW_MAX_SECONDS, COMBO_PREVIEW_MAX_SECONDS, 'Vorschau-Clip der Combo wird erstellt…')

  return { comboId: combo.id, moveIds }
}
