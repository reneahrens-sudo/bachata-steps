import { useState } from 'react'

/** Combobox: click to pick an existing option from the dropdown, or type a new value to create one. */
export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  listId?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toLowerCase()
  const filtered = options.filter((o) => o.toLowerCase().includes(q))
  const base = className ?? 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={base + ' pr-9'}
      />
      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim"
        >
          ▾
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(o); setOpen(false) }}
              className="block w-full px-4 py-2.5 text-left text-sm hover:bg-card-hover"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
