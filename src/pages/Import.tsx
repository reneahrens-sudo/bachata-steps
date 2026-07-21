import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { parseBachataUrl, parsedToMoveInsert, type ParsedEntry } from '../lib/parseBachata'
import { CATEGORIES, LEVELS, STYLES } from '../lib/constants'
import type { Visibility } from '../lib/types'
import { useQueryClient } from '@tanstack/react-query'

type Row = ParsedEntry & { include: boolean; category: string; level: number | '' }

export function Import() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const parse = () => {
    const urls = Array.from(new Set(text.split(/\s+/).map((s) => s.trim()).filter(Boolean)))
    setRows(
      urls.map((u) => {
        const p = parseBachataUrl(u)
        return { ...p, include: p.ok, category: '', level: '' as number | '' }
      }),
    )
    setResult(null)
  }

  const valid = useMemo(() => (rows ?? []).filter((r) => r.include && r.ok), [rows])

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs!.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const runImport = async () => {
    if (!user) return navigate('/login')
    setBusy(true)
    setResult(null)
    try {
      const payload = valid.map((r) =>
        parsedToMoveInsert(r, {
          owner_id: user.id,
          visibility,
          category: r.category || null,
          level: r.level === '' ? null : Number(r.level),
        }),
      )
      // dedupe via legacy_id where present; plain insert for the rest
      const withId = payload.filter((p) => p.legacy_id)
      const noId = payload.filter((p) => !p.legacy_id)
      if (withId.length) {
        const { error } = await supabase.from('moves').upsert(withId, { onConflict: 'legacy_id' })
        if (error) throw error
      }
      if (noId.length) {
        const { error } = await supabase.from('moves').insert(noId)
        if (error) throw error
      }
      qc.invalidateQueries({ queryKey: ['moves'] })
      setResult(`✓ ${payload.length} Einträge importiert.`)
      setRows(null)
      setText('')
    } catch (e) {
      setResult('Fehler: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Melde dich an, um zu importieren.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">
          Anmelden →
        </Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Aus bachatasteps.com importieren</h1>
        <p className="mt-1 text-sm text-text-dim">
          Füge einen oder mehrere Links ein (CDN-Video-URLs oder YouTube), einer pro Zeile. Name, Stil, ID,
          Datum und Choreograf:innen werden automatisch aus dem Dateinamen erkannt.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="https://balazsimibachatasteps.b-cdn.net/moves-as-media/bachata_moveid1952_..._withAudio.mp4"
        className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 font-mono text-xs outline-none focus:border-accent"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={parse} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white">
          Vorschau erzeugen
        </button>
        {rows && (
          <span className="text-sm text-text-dim">
            {valid.length} von {rows.length} auswählbar
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-text-dim">
          Sichtbarkeit
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="rounded-lg border border-border bg-card px-2 py-1.5"
          >
            <option value="private">🔒 Privat</option>
            <option value="unlisted">🔗 Nicht gelistet</option>
            <option value="public">🌍 Öffentlich</option>
          </select>
        </label>
      </div>

      {rows && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 ${r.ok ? 'border-border bg-card' : 'border-red-500/40 bg-red-500/5'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={r.include}
                  disabled={!r.ok}
                  onChange={(e) => update(i, { include: e.target.checked })}
                  className="mt-2 h-4 w-4 accent-[var(--color-accent)]"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={r.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      placeholder="Name"
                      className="min-w-40 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <select
                      value={r.style}
                      onChange={(e) => update(i, { style: e.target.value })}
                      className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
                    >
                      {STYLES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.category}
                      onChange={(e) => update(i, { category: e.target.value })}
                      className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
                    >
                      <option value="">Kategorie…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.level}
                      onChange={(e) => update(i, { level: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
                    >
                      <option value="">Lvl…</option>
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="truncate text-xs text-text-dim">
                    {r.legacy_id && <span className="mr-2 text-accent">#{r.legacy_id}</span>}
                    {r.dancers && <span className="mr-2">👤 {r.dancers}</span>}
                    {r.date && <span className="mr-2">📅 {r.date}</span>}
                    {r.note && <span className="text-amber-400">⚠ {r.note}</span>}
                    {!r.note && <span className="opacity-60">{r.raw}</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows && valid.length > 0 && (
        <button
          onClick={runImport}
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Importiert…' : `${valid.length} Einträge importieren`}
        </button>
      )}

      {result && (
        <p className={`text-center text-sm ${result.startsWith('✓') ? 'text-green-500' : 'text-red-400'}`}>
          {result}
        </p>
      )}
    </div>
  )
}
