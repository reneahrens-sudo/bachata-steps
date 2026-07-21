import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'

type Item = { id: string; name: string }

function SortableRow({ item, index, onRemove }: { item: Item; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-xl border border-border bg-bg p-2"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab px-1 text-text-dim" title="Ziehen">
        ⠿
      </button>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
        {index + 1}
      </span>
      <span className="flex-1 text-sm">{item.name}</span>
      <button type="button" onClick={onRemove} className="px-2 text-text-dim hover:text-red-400">
        ✕
      </button>
    </li>
  )
}

export function ComboBuilder({
  value,
  onChange,
}: {
  value: Item[]
  onChange: (items: Item[]) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const search = async (text: string) => {
    setQ(text)
    if (text.trim().length < 2) return setResults([])
    const { data } = await supabase
      .from('moves')
      .select('id, name')
      .eq('kind', 'move')
      .ilike('name', `%${text.trim()}%`)
      .limit(8)
    setResults((data ?? []) as Item[])
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldI = value.findIndex((i) => i.id === active.id)
      const newI = value.findIndex((i) => i.id === over.id)
      onChange(arrayMove(value, oldI, newI))
    }
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {value.map((item, i) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  index={i}
                  onRemove={() => onChange(value.filter((x) => x.id !== item.id))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div className="relative">
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Move zur Combo hinzufügen…"
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...value, r])
                    setQ('')
                    setResults([])
                  }}
                  className="w-full px-3 py-2 text-left text-sm transition hover:bg-card-hover"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
