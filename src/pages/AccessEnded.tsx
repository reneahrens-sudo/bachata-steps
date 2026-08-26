import { useAuth } from '../hooks/useAuth'

/** Shown to a signed-in account that is no longer a member — typically an expired guest link. */
export function AccessEnded({ isGuest }: { isGuest: boolean }) {
  const { signOut } = useAuth()
  return (
    <div className="grid min-h-svh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl">⏳</div>
        <h1 className="mt-3 text-2xl font-bold">
          {isGuest ? 'Dein Gast-Zugang ist abgelaufen' : 'Kein Zugriff (mehr)'}
        </h1>
        <p className="mt-2 text-sm text-text-dim">
          {isGuest
            ? 'Danke fürs Reinschauen! Wenn du weiter Zugriff möchtest, frag die Person, die dich eingeladen hat, nach einem neuen Link.'
            : 'Dieses Konto hat aktuell keinen Zugriff auf BachataMoves. Bitte den Betreiber kontaktieren.'}
        </p>
        <button onClick={signOut} className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-white">
          Abmelden
        </button>
      </div>
    </div>
  )
}
