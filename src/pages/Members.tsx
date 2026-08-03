import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsAdmin, useMembers, useInviteMember, useRemoveMember } from '../hooks/useMembers'
import { useAuth } from '../hooks/useAuth'

export function Members() {
  const { user } = useAuth()
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin()
  const { data: members = [], isLoading, isError, error } = useMembers(!!isAdmin)
  const invite = useInviteMember()
  const remove = useRemoveMember()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  if (adminLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!isAdmin)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Diese Seite ist nur für Administrator:innen.</p>
        <Link to="/" className="mt-2 inline-block font-medium text-accent">Zur Startseite →</Link>
      </div>
    )

  const doInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      await invite.mutateAsync({ email: email.trim(), password, note: note.trim() || undefined })
      setMsg(`✓ ${email.trim()} eingeladen.`)
      setEmail(''); setPassword(''); setNote('')
    } catch (err) {
      setMsg('Fehler: ' + (err as Error).message)
    }
  }

  const input = 'w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent'

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mitglieder</h1>
        <p className="text-sm text-text-dim">Nur eingeladene Konten haben Zugriff. Lege hier neue an oder entziehe den Zugang.</p>
      </div>

      {/* invite */}
      <form onSubmit={doInvite} className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Person einladen</h2>
        <input type="email" required placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input type="text" required minLength={8} placeholder="Start-Passwort (min. 8 Zeichen)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        <input type="text" placeholder="Notiz (optional, z.B. Name)" value={note} onChange={(e) => setNote(e.target.value)} className={input} />
        <button disabled={invite.isPending} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
          {invite.isPending ? 'Lädt ein…' : 'Einladen & Konto anlegen'}
        </button>
        <p className="text-xs text-text-dim">Gib E-Mail + Passwort an die Person weiter. Sie kann sich damit sofort anmelden (E-Mail ist vorbestätigt).</p>
        {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
      </form>

      {/* list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-dim">{members.length} Mitglied{members.length === 1 ? '' : 'er'}</h2>
        {isError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-center text-red-400">Fehler: {(error as Error).message}</div>
        ) : isLoading ? (
          <p className="text-text-dim">Lädt…</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.email ?? '(ohne E-Mail)'}</p>
                <p className="truncate text-xs text-text-dim">
                  {m.note || '—'}
                  {m.is_admin && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">Admin</span>}
                  {m.id === user?.id && <span className="ml-2 text-[10px] text-text-dim">(du)</span>}
                </p>
              </div>
              {m.id !== user?.id && (
                <button
                  onClick={() => confirm(`Zugang für ${m.email ?? 'dieses Konto'} entfernen? Das Konto wird gelöscht.`) && remove.mutate(m.id)}
                  disabled={remove.isPending}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-red-400 hover:border-red-400/60 disabled:opacity-50"
                >
                  Entfernen
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
