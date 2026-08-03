import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    // onAuthStateChange in AuthProvider picks up the new session and reveals the app.
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg('Anmeldung fehlgeschlagen. E-Mail/Passwort prüfen oder Zugang anfragen.')
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-6 text-center">
        <div className="text-5xl">💃</div>
        <h1 className="mt-3 text-2xl font-bold">
          Bachata<span className="text-accent">Moves</span>
        </h1>
        <p className="mt-1 text-sm text-text-dim">Private learning space · Invite only</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <button
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? '…' : 'Anmelden'}
        </button>
      </form>

      {msg && <p className="mt-3 text-center text-sm text-red-400">{msg}</p>}

      <div className="mt-8 rounded-2xl border border-border bg-card/50 p-4 text-center">
        <p className="text-sm leading-relaxed text-text-dim">
          BachataMoves is a private learning space — not open to the public. This is to protect the hard work
          and creativity of the teachers who share their moves with us, and as a small tribute to every instructor
          teaching offline, floor to floor, night after night.
        </p>
        <p className="mt-3 text-sm font-medium text-accent">Thank you for keeping this dance alive. 💃🕺</p>
      </div>
    </div>
  )
}
