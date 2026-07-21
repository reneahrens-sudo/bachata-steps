import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Start', icon: '🏠', end: true },
  { to: '/katalog', label: 'Katalog', icon: '🔍' },
  { to: '/neu', label: 'Neu', icon: '＋', primary: true },
  { to: '/lessons', label: 'Lessons', icon: '🎬' },
  { to: '/profil', label: 'Profil', icon: '👤' },
]

export function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                isActive ? 'text-accent' : 'text-text-dim'
              }`
            }
          >
            {it.primary ? (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xl text-white shadow-lg">
                {it.icon}
              </span>
            ) : (
              <span className="text-xl">{it.icon}</span>
            )}
            <span>{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
