import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { categoryLabel } from '../../lib/constants'

export type MoveLink = { mode: 'assign' | 'variation'; moveId: string; moveName: string } | null
type Hit = { id: string; name: string; category: string | null; level: number | null }

/**
 * Name input with live suggestions of existing moves (matched by name parts).
 * - "→ Zuordnen": clip goes to the existing move (no new move) → name is irrelevant, show a chip.
 * - "≈ Variante": a NEW move is created, marked as variation of the picked one → keep the user's
 *   own name editable, just show a small "Variante von …" badge.
 */
export function MoveNameField({
  value,
  link,
  placeholder,
  onNameChange,
  onLink,
  onClearLink,
}: {
  value: string
  link: MoveLink
  placeholder?: string
  onNameChange: (name: string) => void
  onLink: (link: NonNullable<MoveLink>) => void
  onClearLink: () => void
}) {
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (q: string) => {
    onNameChange(q)
    if (timer.current) clearTimeout(timer.current)
    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2)
    if (!words.length) {
      setHits([])
      setOpen(false)
      return
    }
    timer.current = setTimeout(async () => {
      const orFilter = words.map((w) => `name.ilike.%${w.replace(/[%,()]/g, '')}%`).join(',')
      const { data } = await supabase
        .from('moves')
        .select('id,name,category,level')
        .eq('kind', 'move')
        .or(orFilter)
        .limit(6)
      setHits((data ?? []) as Hit[])
      setOpen((data ?? []).length > 0)
    }, 220)
  }

  // Assigned to an existing move → no name needed, show a chip.
  if (link?.mode === 'assign') {
    return (
      <div className="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-1.5 text-sm">
        <span className="text-accent">
          → zugeordnet: <strong>{link.moveName}</strong>
        </span>
        <button type="button" onClick={onClearLink} className="ml-auto text-text-dim hover:text-red-400" title="Verknüpfung entfernen">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="relative min-w-40 flex-1">
      <input
        value={value}
        onChange={(e) => search(e.target.value)}
        onFocus={() => hits.length && !link && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
      />

      {/* variation badge — name stays editable above */}
      {link?.mode === 'variation' && (
        <div className="mt-1 flex items-center gap-2 text-xs text-accent">
          <span>
            ≈ Variante von: <strong>{link.moveName}</strong>
          </span>
          <button type="button" onClick={onClearLink} className="text-text-dim hover:text-red-400" title="Variante-Verknüpfung entfernen">
            ✕
          </button>
        </div>
      )}

      {open && !link && hits.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <p className="border-b border-border px-3 py-1.5 text-[11px] text-text-dim">Bestehende Moves:</p>
          {hits.map((h) => (
            <div key={h.id} className="flex items-center gap-2 px-3 py-2 hover:bg-card-hover">
              <span className="min-w-0 flex-1 truncate text-sm">
                {h.name}
                <span className="ml-1 text-xs text-text-dim">
                  {categoryLabel(h.category)}
                  {h.level ? ` · L${h.level}` : ''}
                </span>
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onLink({ mode: 'assign', moveId: h.id, moveName: h.name }); setOpen(false) }}
                className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white"
                title="Diesen Ausschnitt als weiteres Video zum bestehenden Move hinzufügen"
              >
                → Zuordnen
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onLink({ mode: 'variation', moveId: h.id, moveName: h.name }); setOpen(false) }}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-text-dim hover:border-accent hover:text-accent"
                title="Neuen Move mit eigenem Namen anlegen, als Variante dieses Moves markiert"
              >
                ≈ Variante
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
