import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsAdmin } from '../hooks/useMembers'
import { useMyMoveData } from '../hooks/useMyMoveData'
import type { Profile as ProfileRow } from '../lib/types'

export function Profile() {
  const { user, signOut } = useAuth()
  const { data: isAdmin } = useIsAdmin()
  const { data: myData } = useMyMoveData()
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setDisplayName(data.display_name ?? '')
          setUsername(data.username ?? '')
        }
      })
  }, [user])

  if (!user)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Nicht angemeldet.</p>
        <Link to="/login" className="mt-2 inline-block font-medium text-accent">
          Anmelden →
        </Link>
      </div>
    )

  const save = async () => {
    // upsert (not update) so it also works when no profiles row exists yet (e.g. fresh/anon session)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName, username: username || null })
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      alert(error.message)
    }
  }

  const counts = Object.values(myData ?? {})
  const learned = counts.filter((x) => x.learned).length

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl font-bold text-white">
          {(displayName || user.email || 'U')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{displayName || 'Tänzer:in'}</h1>
          <p className="text-sm text-text-dim">{user.email}</p>
          <p className="text-sm text-text-dim">{learned} Moves gelernt</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Profil bearbeiten</h2>
        <label className="block text-sm text-text-dim">
          Anzeigename
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm text-text-dim">
          Benutzername (für öffentliches Profil)
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="z.B. rene"
            className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
          />
        </label>
        <button onClick={save} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white">
          {saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
      </div>

      <div className="space-y-2">
        <Link to="/sammlungen" className="block rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-card-hover md:hidden">
          📚 Meine Sammlungen
        </Link>
        <Link to="/entdecken" className="block rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-card-hover md:hidden">
          🌍 Entdecken
        </Link>
        {isAdmin && (
          <Link to="/mitglieder" className="block rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 font-medium text-accent transition hover:bg-accent-soft/70">
            👥 Mitglieder verwalten
          </Link>
        )}
        <Link to="/statistik" className="block rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-card-hover">
          📊 Meine Statistik
        </Link>
        <Link to="/videos" className="block rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-card-hover">
          🎞️ Meine Videos (privat/öffentlich)
        </Link>
        <Link to="/import" className="block rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-card-hover">
          📥 Aus bachatasteps.com importieren
        </Link>
        <Link to="/einstellungen" className="block rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-card-hover">
          ⚙️ Einstellungen
        </Link>
        <button
          onClick={signOut}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-red-400 transition hover:bg-card-hover"
        >
          Abmelden
        </button>
      </div>
      {profile?.username && (
        <p className="text-center text-sm text-text-dim">
          Öffentliches Profil:{' '}
          <Link to={`/profil/${profile.username}`} className="text-accent">
            /profil/{profile.username}
          </Link>
        </p>
      )}
    </div>
  )
}
