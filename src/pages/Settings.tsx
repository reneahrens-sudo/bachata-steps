import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Settings() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Konto</h2>
        <p className="mt-1 text-sm text-text-dim">{user?.email ?? 'Nicht angemeldet'}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-text-dim">
        <h2 className="font-semibold text-text">Über</h2>
        <p className="mt-1">
          BachataSteps — moderne PWA zum Verwalten deiner Bachata-Moves &amp; Combos. Installierbar über das
          Browser-Menü („Zum Startbildschirm hinzufügen").
        </p>
      </div>

      {!user && (
        <Link to="/login" className="block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white">
          Anmelden
        </Link>
      )}
    </div>
  )
}
