import { STATUS_META, STATUS_ORDER } from '../../lib/constants'
import type { MoveUserData, StatusFlag } from '../../lib/types'
import { useToggleStatus } from '../../hooks/useMyMoveData'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export function StatusChips({
  moveId,
  data,
  size = 'md',
}: {
  moveId: string
  data?: MoveUserData
  size?: 'sm' | 'md'
}) {
  const { user } = useAuth()
  const toggle = useToggleStatus()
  const navigate = useNavigate()

  const pad = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_ORDER.map((flag: StatusFlag) => {
        const meta = STATUS_META[flag]
        const active = !!data?.[flag]
        return (
          <button
            key={flag}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!user) return navigate('/login')
              toggle.mutate({ moveId, flag, value: !active })
            }}
            className={`inline-flex items-center gap-1 rounded-full border font-medium transition ${pad}`}
            style={{
              borderColor: active ? meta.color : 'var(--color-border)',
              background: active ? meta.color + '22' : 'transparent',
              color: active ? meta.color : 'var(--color-text-dim)',
            }}
            title={meta.label}
          >
            <span>{meta.icon}</span>
            <span>{meta.short}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Compact status dots for cards — shows only active flags. */
export function StatusDots({ data }: { data?: MoveUserData }) {
  const active = STATUS_ORDER.filter((f) => data?.[f])
  if (!active.length) return null
  return (
    <div className="flex gap-1">
      {active.map((f) => (
        <span
          key={f}
          className="grid h-5 w-5 place-items-center rounded-full text-[10px]"
          style={{ background: STATUS_META[f].color + '33', color: STATUS_META[f].color }}
          title={STATUS_META[f].label}
        >
          {STATUS_META[f].icon}
        </span>
      ))}
    </div>
  )
}
