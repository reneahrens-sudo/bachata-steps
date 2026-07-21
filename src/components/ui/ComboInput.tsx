/** Input with a datalist dropdown of existing options — pick an existing value or type a new one. */
export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  listId,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  listId: string
  className?: string
}) {
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className ?? 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}
