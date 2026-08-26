import { supabase } from './supabase'

const BUCKET = 'videos'

/** Per-user storage quota for uploaded class videos. */
export const STORAGE_QUOTA_BYTES = 10 * 1e9

export function publicVideoUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

/** Sum of the user's uploaded video sizes (bytes), for quota checks. */
export async function usedStorageBytes(userId: string): Promise<number> {
  const { data } = await supabase.from('videos').select('size_bytes').eq('owner_id', userId)
  return (data ?? []).reduce((a, v) => a + (v.size_bytes ?? 0), 0)
}

/** Uploads a class video to Storage and inserts a `videos` row. Returns the video row id + url. */
export async function uploadClassVideo(
  file: File,
  userId: string,
  opts: { title?: string; visibility?: string; durationS?: number; onProgress?: (pct: number) => void } = {},
): Promise<{ videoId: string; url: string; storagePath: string }> {
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
  const uuid = crypto.randomUUID()
  const storagePath = `${userId}/${uuid}.${ext}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || 'video/mp4',
    upsert: false,
  })
  if (upErr) throw upErr
  opts.onProgress?.(100)

  const { data, error } = await supabase
    .from('videos')
    .insert({
      owner_id: userId,
      title: opts.title ?? file.name,
      storage_path: storagePath,
      visibility: opts.visibility ?? 'unlisted',
      duration_s: opts.durationS ? Math.round(opts.durationS) : null,
      size_bytes: file.size,
    })
    .select('id')
    .single()
  if (error) throw error

  return { videoId: data.id, url: publicVideoUrl(storagePath), storagePath }
}

/** PUT with real upload-progress events (fetch can't report progress). */
function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2-Upload fehlgeschlagen (HTTP ${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('R2-Upload fehlgeschlagen (Netzwerkfehler).'))
    xhr.send(body)
  })
}

/** Uploads a class video to Cloudflare R2 via a presigned URL from the edge function. */
export async function uploadClassVideoR2(
  file: File,
  userId: string,
  opts: { title?: string; visibility?: string; durationS?: number; onProgress?: (pct: number) => void } = {},
): Promise<{ videoId: string; url: string; storagePath: string }> {
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { filename: file.name, contentType: file.type || 'video/mp4' },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  const { uploadUrl, publicUrl, contentType, key } = data as {
    uploadUrl: string; publicUrl: string; contentType: string; key: string
  }
  if (!publicUrl) throw new Error('R2 ohne öffentliche URL konfiguriert (R2_PUBLIC_BASE fehlt).')

  await putWithProgress(uploadUrl, file, contentType, opts.onProgress)

  const { data: v, error: e2 } = await supabase
    .from('videos')
    .insert({
      owner_id: userId,
      title: opts.title ?? file.name,
      storage_path: key,
      visibility: opts.visibility ?? 'unlisted',
      duration_s: opts.durationS ? Math.round(opts.durationS) : null,
      size_bytes: file.size,
    })
    .select('id')
    .single()
  if (e2) throw e2
  return { videoId: v.id, url: publicUrl, storagePath: key }
}

/** Picks the configured storage backend (R2 or Supabase) for class-video uploads. */
export async function uploadClassVideoSmart(
  file: File,
  userId: string,
  opts: { title?: string; visibility?: string; durationS?: number; onProgress?: (pct: number) => void } = {},
): Promise<{ videoId: string; url: string; storagePath: string }> {
  if (import.meta.env.VITE_STORAGE_BACKEND === 'r2') return uploadClassVideoR2(file, userId, opts)
  return uploadClassVideo(file, userId, opts)
}

/** Uploads a small preview clip and returns its public URL + storage key (for later cleanup). */
export async function uploadPreviewClip(blob: Blob, userId: string): Promise<{ url: string; key: string }> {
  if (import.meta.env.VITE_STORAGE_BACKEND === 'r2') {
    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: { filename: 'preview.mp4', contentType: 'video/mp4' },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    const { uploadUrl, publicUrl, key } = data as { uploadUrl: string; publicUrl: string; key: string }
    if (!publicUrl) throw new Error('R2 ohne öffentliche URL konfiguriert.')
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: blob })
    if (!put.ok) throw new Error(`Preview-Upload fehlgeschlagen (HTTP ${put.status}).`)
    return { url: publicUrl, key }
  }
  const key = `${userId}/previews/${crypto.randomUUID()}.mp4`
  const { error } = await supabase.storage.from(BUCKET).upload(key, blob, { contentType: 'video/mp4', upsert: false })
  if (error) throw error
  return { url: publicVideoUrl(key), key }
}

/** Deletes a stored video object from the active backend (R2 via edge fn, or Supabase Storage). */
export async function deleteVideoObject(storagePath: string): Promise<void> {
  if (!storagePath) return
  if (import.meta.env.VITE_STORAGE_BACKEND === 'r2') {
    const { data, error } = await supabase.functions.invoke('r2-delete', { body: { key: storagePath } })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return
  }
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw error
}

/** Uploads a JPEG thumbnail blob and returns its public URL. */
export async function uploadThumb(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/thumbs/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return publicVideoUrl(path)
}

/** Captures a JPEG frame from a video element at the given time. */
export function captureFrame(video: HTMLVideoElement, time: number, maxW = 480): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      const scale = Math.min(1, maxW / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.7)
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

/** Loads a File into a temp video, captures a JPEG thumbnail at ~1s, uploads it, returns the public URL. */
export async function generateThumbFromFile(file: File, userId: string): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res()
      v.onerror = () => rej(new Error('video load failed'))
    })
    const t = Math.min(1, (v.duration || 2) / 2)
    const blob = await captureFrame(v, t)
    URL.revokeObjectURL(url)
    return await uploadThumb(blob, userId)
  } catch {
    return null
  }
}

/** Reads a File's duration (seconds) via a temporary video element. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      resolve(v.duration || 0)
      URL.revokeObjectURL(v.src)
    }
    v.onerror = () => resolve(0)
    v.src = URL.createObjectURL(file)
  })
}
