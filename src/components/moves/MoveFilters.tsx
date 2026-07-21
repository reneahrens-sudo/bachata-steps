import { CATEGORIES, LEVELS, STYLES, LEVEL_COLORS } from '../../lib/constants'
import type { MoveFilters } from '../../hooks/useMoves'

function Pill({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition"
      style={{
        borderColor: active ? color ?? 'var(--color-accent)' : 'var(--color-border)',
        background: active ? (color ?? 'var(--color-accent)') + '22' : 'transparent',
        color: active ? color ?? 'var(--color-accent)' : 'var(--color-text-dim)',
      }}
    >
      {children}
    </button>
  )
}

export function MoveFilters({
  filters,
  onChange,
}: {
  filters: MoveFilters
  onChange: (f: MoveFilters) => void
}) {
  const set = (patch: Partial<MoveFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="space-y-2">
      {/* Styles */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Pill active={!filters.style} onClick={() => set({ style: undefined })}>
          Alle Stile
        </Pill>
        {STYLES.map((s) => (
          <Pill key={s.key} active={filters.style === s.key} onClick={() => set({ style: s.key })}>
            {s.label}
          </Pill>
        ))}
      </div>

      {/* Categories */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Pill active={!filters.category} onClick={() => set({ category: undefined })}>
          Alle Kategorien
        </Pill>
        {CATEGORIES.map((c) => (
          <Pill
            key={c.key}
            active={filters.category === c.key}
            onClick={() => set({ category: filters.category === c.key ? undefined : c.key })}
          >
            {c.label}
          </Pill>
        ))}
      </div>

      {/* Levels + kind */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Pill active={!filters.level} onClick={() => set({ level: undefined })}>
          Alle Level
        </Pill>
        {LEVELS.map((l) => (
          <Pill
            key={l}
            active={filters.level === l}
            color={LEVEL_COLORS[l]}
            onClick={() => set({ level: filters.level === l ? undefined : l })}
          >
            Lvl {l}
          </Pill>
        ))}
        <span className="w-2" />
        <Pill
          active={filters.kind === 'combo'}
          color="#a855f7"
          onClick={() => set({ kind: filters.kind === 'combo' ? undefined : 'combo' })}
        >
          Nur Combos
        </Pill>
      </div>
    </div>
  )
}
