import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { isRealUser, isAnonymous } = useAuth()

  useEffect(() => {
    // Only bounce away real accounts — anonymous visitors must be able to reach the form.
    if (isRealUser) navigate('/', { replace: true })
  }, [isRealUser, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signup') {
        if (isAnonymous) {
          // Convert the current anonymous session into a permanent account →
          // keeps the same user id, so content created in this session stays yours.
          const { error } = await supabase.auth.updateUser({ email, password })
          if (error) throw error
          setMsg('Fast fertig! Bestätige die E-Mail in deinem Postfach — danach bist du dauerhaft angemeldet.')
        } else {
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          setMsg('Fast fertig! Bestätige die E-Mail in deinem Postfach.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      }
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl">💃</div>
        <h1 className="mt-3 text-2xl font-bold">
          Bachata<span className="text-accent">Steps</span>
        </h1>
        <p className="mt-1 text-sm text-text-dim">Deine Moves. Deine Combos. Dein Fortschritt.</p>
      </div>

      <button
        onClick={google}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 font-medium transition hover:bg-card-hover"
      >
        <span>🔵</span> Mit Google anmelden
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-text-dim">
        <div className="h-px flex-1 bg-border" /> oder <div className="h-px flex-1 bg-border" />
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
          minLength={6}
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <button
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? '…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </form>

      {msg && <p className="mt-3 text-center text-sm text-accent">{msg}</p>}

      <p className="mt-6 text-center text-sm text-text-dim">
        {mode === 'login' ? 'Noch kein Konto?' : 'Schon registriert?'}{' '}
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="font-medium text-accent"
        >
          {mode === 'login' ? 'Registrieren' : 'Anmelden'}
        </button>
      </p>
    </div>
  )
}
