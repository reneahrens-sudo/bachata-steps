import { Link } from 'react-router-dom'
import { useShareLinksFor } from '../hooks/useShareLinks'
import { Countdown } from './Countdown'

/** Small banner on a shared target's page: shows that active share links exist and jumps to /links. */
export function ShareLinkInfo({ targetId }: { targetId: string | null | undefined }) {
  const { data: links = [], refetch } = useShareLinksFor(targetId)
  const active = links.filter((l) => !l.expires_at || new Date(l.expires_at) > new Date())
  if (!active.length) return null

  // soonest expiry among active links (null = at least one unlimited link)
  const withExpiry = active.filter((l) => l.expires_at)
  const soonest = withExpiry.length === active.length && withExpiry.length
    ? withExpiry.map((l) => l.expires_at!).sort()[0]
    : null

  return (
    <Link
      to="/links"
      className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent transition hover:brightness-110"
    >
      <span>🔗</span>
      <span className="min-w-0 flex-1 truncate">
        {active.length === 1 ? 'Aktiver geteilter Link' : `${active.length} aktive geteilte Links`}
        {soonest && (
          <span className="ml-1 text-xs opacity-80">
            · läuft ab in <Countdown until={soonest} onExpired={() => refetch()} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs font-medium">verwalten ›</span>
    </Link>
  )
}
