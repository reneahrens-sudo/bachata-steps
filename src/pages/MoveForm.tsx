import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { extractYouTubeId } from '../lib/youtube'
import { CATEGORIES, LEVELS, STYLES } from '../lib/constants'
import { ComboBuilder } from '../components/combos/ComboBuilder'
import type { SourceLink, Visibility } from '../lib/types'

export function MoveForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const presetKind = searchParams.get('kind') === 'combo' ? 'combo' : 'move'
  const lessonParam = searchParams.get('lesson')
  const comboParam = searchParams.get('combo')
  const editing = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [kind, setKind] = useState<'move' | 'combo'>(presetKind)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('bachata')
  const [category, setCategory] = useState<string>('')
  const [level, setLevel] = useState<number | ''>('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [sourceUrl, setSourceUrl] = useState('')
  const [comboMoves, setComboMoves] = useState<{ id: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // clip trim (for lesson-derived moves)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [clipStart, setClipStart] = useState<number | null>(null)
  const [clipEnd, setClipEnd] = useState<number | null>(null)
  const [variationOf, setVariationOf] = useState<string | null>(null)
  const [variationName, setVariationName] = useState<string | null>(null)
  const [relQuery, setRelQuery] = useState('')
  const [relHits, setRelHits] = useState<{ id: string; name: string }[]>([])
  const trimRef = useRef<HTMLVideoElement>(null)

  // resolve the base move's name for display
  useEffect(() => {
    if (!variationOf) { setVariationName(null); return }
    supabase.from('moves').select('name').eq('id', variationOf).maybeSingle().then(({ data }) => setVariationName(data?.name ?? null))
  }, [variationOf])

  const searchBase = async (q: string) => {
    setRelQuery(q)
    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2)
    if (!words.length) { setRelHits([]); return }
    const orf = words.map((w) => `name.ilike.%${w.replace(/[%,()]/g, '')}%`).join(',')
    const { data } = await supabase.from('moves').select('id,name').eq('kind', 'move').or(orf).limit(6)
    setRelHits(((data ?? []) as { id: string; name: string }[]).filter((h) => h.id !== id))
  }

  const [mergeQuery, setMergeQuery] = useState('')
  const [mergeHits, setMergeHits] = useState<{ id: string; name: string }[]>([])
  const searchMerge = async (q: string) => {
    setMergeQuery(q)
    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2)
    if (!words.length) { setMergeHits([]); return }
    const orf = words.map((w) => `name.ilike.%${w.replace(/[%,()]/g, '')}%`).join(',')
    const { data } = await supabase.from('moves').select('id,name').eq('kind', 'move').or(orf).limit(6)
    setMergeHits(((data ?? []) as { id: string; name: string }[]).filter((h) => h.id !== id))
  }

  // Merge this move into an existing one: its clip(s) become extra videos on the target,
  // combo/collection references are repointed, then this (duplicate) move is deleted.
  const mergeInto = async (targetId: string, targetName: string) => {
    if (!id || !user || !confirm(`Diesen Move mit „${targetName}" zusammenführen? Der Ausschnitt wird als weiteres Video übernommen, dieser doppelte Move entfernt.`)) return
    setBusy(true)
    setErr(null)
    try {
      const { data: self } = await supabase.from('moves').select('*').eq('id', id).single()
      if (self && (self.media_url || self.youtube_id)) {
        await supabase.from('move_media').insert({
          move_id: targetId,
          owner_id: user.id,
          label: self.name,
          media_url: self.media_url,
          youtube_id: self.youtube_id,
          thumb_url: self.thumb_url,
          clip_start: self.clip_start,
          clip_end: self.clip_end,
        })
      }
      await supabase.from('move_media').update({ move_id: targetId }).eq('move_id', id)
      await supabase.from('combo_items').update({ move_id: targetId }).eq('move_id', id)
      const { data: cis } = await supabase.from('collection_items').select('id, collection_id').eq('move_id', id)
      for (const ci of cis ?? []) {
        const { count } = await supabase
          .from('collection_items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', ci.collection_id)
          .eq('move_id', targetId)
        if (count && count > 0) await supabase.from('collection_items').delete().eq('id', ci.id)
        else await supabase.from('collection_items').update({ move_id: targetId }).eq('id', ci.id)
      }
      await supabase.from('moves').delete().eq('id', id)
      for (const key of [['move'], ['family'], ['moves'], ['move_media'], ['collections'], ['lessons']]) {
        qc.invalidateQueries({ queryKey: key })
      }
      navigate(`/move/${targetId}`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!editing) return
    supabase
      .from('moves')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setKind(data.kind as 'move' | 'combo')
        setName(data.name)
        setDescription(data.description ?? '')
        setStyle(data.style)
        setCategory(data.category ?? '')
        setLevel(data.level ?? '')
        setYoutubeUrl(data.youtube_id ? `https://youtu.be/${data.youtube_id}` : '')
        setTags((data.tags ?? []).join(', '))
        setVisibility(data.visibility as Visibility)
        setMediaUrl(data.media_url ?? null)
        setClipStart(data.clip_start ?? null)
        setClipEnd(data.clip_end ?? null)
        setVariationOf(data.variation_of ?? null)
        const links = (data.source_links as SourceLink[] | null) ?? []
        setSourceUrl(links[0]?.url ?? '')
      })
  }, [editing, id])

  const isClip = !!mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl) && clipStart != null

  const nudgeClip = (field: 'start' | 'end', delta: number) => {
    const v = trimRef.current
    if (field === 'start') {
      const nv = Math.max(0, +(((clipStart ?? 0) + delta)).toFixed(2))
      setClipStart(nv)
      if (v) v.currentTime = nv
    } else {
      const nv = Math.max((clipStart ?? 0) + 0.2, +(((clipEnd ?? 0) + delta)).toFixed(2))
      setClipEnd(nv)
      if (v) v.currentTime = nv
    }
  }
  const playClip = () => {
    const v = trimRef.current
    if (!v || clipStart == null || clipEnd == null) return
    v.currentTime = clipStart
    v.play()
    const stop = () => {
      if (v.currentTime >= clipEnd!) {
        v.pause()
        v.removeEventListener('timeupdate', stop)
      }
    }
    v.addEventListener('timeupdate', stop)
  }

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um Moves zu erstellen.</p>
        <button onClick={() => navigate('/login')} className="mt-2 font-medium text-accent">
          Anmelden →
        </button>
      </div>
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const payload = {
        owner_id: user.id,
        kind,
        name: name.trim(),
        description: description.trim() || null,
        style,
        category: category || null,
        level: level === '' ? null : Number(level),
        youtube_id: extractYouTubeId(youtubeUrl),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility,
        source_links: sourceUrl.trim() ? [{ label: 'Tutorial', url: sourceUrl.trim() }] : [],
        ...(lessonParam && !editing ? { lesson_id: lessonParam } : {}),
        ...(isClip ? { clip_start: clipStart, clip_end: clipEnd } : {}),
        variation_of: variationOf,
      }

      let moveId = id
      if (editing) {
        const { error } = await supabase.from('moves').update(payload).eq('id', id!)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('moves').insert(payload).select('id').single()
        if (error) throw error
        moveId = data.id
      }

      // sync combo steps
      if (kind === 'combo' && moveId) {
        await supabase.from('combo_items').delete().eq('combo_id', moveId)
        if (comboMoves.length) {
          await supabase.from('combo_items').insert(
            comboMoves.map((m, i) => ({ combo_id: moveId!, move_id: m.id, position: i })),
          )
        }
      }

      // refresh caches so the edited move + its relationships show immediately
      for (const key of [['move'], ['family'], ['moves'], ['move_media'], ['related']]) {
        qc.invalidateQueries({ queryKey: key })
      }

      // append this new move to an existing combo (from ?combo=)
      if (comboParam && moveId && !editing) {
        const { count } = await supabase
          .from('combo_items')
          .select('*', { count: 'exact', head: true })
          .eq('combo_id', comboParam)
        await supabase.from('combo_items').insert({ combo_id: comboParam, move_id: moveId, position: count ?? 0 })
        navigate(`/move/${comboParam}`)
        return
      }

      if (lessonParam && !editing) {
        navigate(`/lessons/${lessonParam}`)
        return
      }

      navigate(`/move/${moveId}`)
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!editing || !confirm('Diesen Move wirklich löschen?')) return
    setBusy(true)
    const { error } = await supabase.from('moves').delete().eq('id', id!)
    if (error) { setErr(error.message); setBusy(false); return }
    navigate('/katalog')
  }

  const input = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'
  const nudgeBtn = 'rounded-md border border-border bg-bg px-2 py-1 text-xs font-medium text-text-dim hover:border-accent hover:text-accent'
  const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}.${Math.round((t % 1) * 10)}`

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">{editing ? 'Bearbeiten' : 'Neuer Eintrag'}</h1>

      {/* kind switch */}
      <div className="flex gap-2">
        {(['move', 'combo'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="flex-1 rounded-xl border py-2.5 font-medium transition"
            style={{
              borderColor: kind === k ? 'var(--color-accent)' : 'var(--color-border)',
              background: kind === k ? 'var(--color-accent-soft)' : 'transparent',
              color: kind === k ? 'var(--color-accent)' : 'var(--color-text-dim)',
            }}
          >
            {k === 'move' ? '💃 Einzel-Move' : '🎬 Combo'}
          </button>
        ))}
      </div>

      <input required placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} className={input} />

      <textarea
        placeholder="Beschreibung"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={input + ' resize-none'}
      />

      <div className="grid grid-cols-2 gap-3">
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={input}>
          {STYLES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
          <option value="">Kategorie…</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select value={level} onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))} className={input}>
          <option value="">Level…</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={input}>
          <option value="private">🔒 Privat</option>
          <option value="unlisted">🔗 Nicht gelistet</option>
          <option value="public">🌍 Öffentlich</option>
        </select>
      </div>

      <input placeholder="YouTube-Link (optional)" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className={input} />
      <input placeholder="Tutorial-/Quellen-Link (optional)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={input} />
      <input placeholder="Tags (Komma-getrennt)" value={tags} onChange={(e) => setTags(e.target.value)} className={input} />

      {kind === 'combo' && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Combo-Ablauf</h2>
          <ComboBuilder value={comboMoves} onChange={setComboMoves} />
        </div>
      )}

      {/* Clip trim — nachträgliches Anpassen des Ausschnitts (Lesson-Moves) */}
      {isClip && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Ausschnitt anpassen</h2>
          <video ref={trimRef} src={mediaUrl!} controls playsInline className="w-full rounded-xl bg-black" style={{ maxHeight: '45vh' }} />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button type="button" onClick={playClip} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white">
              ▶ Ausschnitt
            </button>
            <span className="text-xs text-text-dim">
              {clipStart != null && clipEnd != null ? `${fmt(clipStart)} – ${fmt(clipEnd)} (${(clipEnd - clipStart).toFixed(1)}s)` : ''}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <span className="w-10 text-xs text-text-dim">Start</span>
              <button type="button" onClick={() => nudgeClip('start', -1)} className={nudgeBtn}>−1s</button>
              <button type="button" onClick={() => nudgeClip('start', -0.5)} className={nudgeBtn}>−0,5</button>
              <button type="button" onClick={() => nudgeClip('start', 0.5)} className={nudgeBtn}>+0,5</button>
              <button type="button" onClick={() => nudgeClip('start', 1)} className={nudgeBtn}>+1s</button>
              <button type="button" onClick={() => trimRef.current && setClipStart(+trimRef.current.currentTime.toFixed(2))} className={nudgeBtn}>= jetzt</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-10 text-xs text-text-dim">Ende</span>
              <button type="button" onClick={() => nudgeClip('end', -1)} className={nudgeBtn}>−1s</button>
              <button type="button" onClick={() => nudgeClip('end', -0.5)} className={nudgeBtn}>−0,5</button>
              <button type="button" onClick={() => nudgeClip('end', 0.5)} className={nudgeBtn}>+0,5</button>
              <button type="button" onClick={() => nudgeClip('end', 1)} className={nudgeBtn}>+1s</button>
              <button type="button" onClick={() => trimRef.current && setClipEnd(+trimRef.current.currentTime.toFixed(2))} className={nudgeBtn}>= jetzt</button>
            </div>
          </div>
        </div>
      )}

      {/* Verwandt mit / Variante von — Moves miteinander verknüpfen */}
      {kind === 'move' && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Verwandt mit / Variante von</h2>
          {variationOf ? (
            <div className="flex items-center gap-2 rounded-xl border border-accent bg-accent-soft px-3 py-2 text-sm">
              <span className="text-accent">
                ≈ Variante von: <strong>{variationName ?? '…'}</strong>
              </span>
              <button
                type="button"
                onClick={() => navigate(`/move/${variationOf}`)}
                className="text-xs text-text-dim underline"
              >
                ansehen
              </button>
              <button
                type="button"
                onClick={() => { setVariationOf(null); setVariationName(null) }}
                className="ml-auto text-text-dim hover:text-red-400"
                title="Verknüpfung entfernen"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={relQuery}
                onChange={(e) => searchBase(e.target.value)}
                placeholder="Basis-Move suchen (Name tippen)…"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              {relHits.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  {relHits.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => { setVariationOf(h.id); setVariationName(h.name); setRelHits([]); setRelQuery('') }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-card-hover"
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-1 text-xs text-text-dim">
            Markiere diesen Move als Variante/verwandt mit einem bestehenden Move — sie werden dann gegenseitig verlinkt.
          </p>
        </div>
      )}

      {/* Mit bestehendem Move zusammenführen (Duplikate nachträglich verschmelzen) */}
      {editing && kind === 'move' && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Mit bestehendem Move zusammenführen</h2>
          <div className="relative">
            <input
              value={mergeQuery}
              onChange={(e) => searchMerge(e.target.value)}
              placeholder="Ziel-Move suchen (Name tippen)…"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {mergeHits.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                {mergeHits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => mergeInto(h.id, h.name)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-card-hover"
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-text-dim">
            Falls dieser Move ein Duplikat ist: Sein Videoausschnitt wandert als weiteres Video zum gewählten Move, dieser doppelte Move wird entfernt.
          </p>
        </div>
      )}

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => navigate(-1)} className="flex-1 rounded-xl border border-border py-3 font-medium text-text-dim">
          Abbrechen
        </button>
        <button disabled={busy} className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Speichert…' : editing ? 'Speichern' : 'Erstellen'}
        </button>
      </div>

      {editing && (
        <button type="button" onClick={del} disabled={busy} className="w-full rounded-xl border border-red-500/40 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10">
          🗑 Move löschen
        </button>
      )}
    </form>
  )
}
