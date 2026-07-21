import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
        const links = (data.source_links as SourceLink[] | null) ?? []
        setSourceUrl(links[0]?.url ?? '')
      })
  }, [editing, id])

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

  const input = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

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

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 rounded-xl border border-border py-3 font-medium text-text-dim"
        >
          Abbrechen
        </button>
        <button
          disabled={busy}
          className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Speichert…' : editing ? 'Speichern' : 'Erstellen'}
        </button>
      </div>
    </form>
  )
}
