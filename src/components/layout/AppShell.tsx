import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { BottomNav } from './BottomNav'

const desktopLinks = [
  { to: '/', label: 'Start', end: true },
  { to: '/katalog', label: 'Katalog' },
  { to: '/lessons', label: 'Lessons' },
  { to: '/sammlungen', label: 'Sammlungen' },
  { to: '/entdecken', label: 'Entdecken' },
  { to: '/import', label: 'Import' },
  { to: '/statistik', label: 'Statistik' },
]

export function AppShell() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-svh">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="text-xl">💃</span>
            <span>
              Bachata<span className="text-accent">Steps</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {desktopLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-card text-accent' : 'text-text-dim hover:text-text'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/neu"
              className="hidden rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 md:inline-block"
            >
              ＋ Neu
            </Link>
            {user ? (
              <button
                onClick={signOut}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-dim transition hover:text-text"
              >
                Abmelden
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent-soft"
              >
                Anmelden
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-10">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
