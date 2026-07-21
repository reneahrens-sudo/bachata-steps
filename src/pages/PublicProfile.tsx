import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MoveGrid } from '../components/moves/MoveGrid'
import type { Move, Profile } from '../lib/types'

export function PublicProfile() {
  const { username } = useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['public_profile', username],
    enabled: !!username,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username!)
        .maybeSingle()
      if (!profile) return null
      const { data: moves } = await supabase
        .from('moves')
        .select('*')
        .eq('owner_id', profile.id)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
      return { profile: profile as Profile, moves: (moves ?? []) as Move[] }
    },
  })

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!data)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Profil nicht gefunden.</p>
        <Link to="/" className="mt-2 inline-block font-medium text-accent">
          Zur Startseite →
        </Link>
      </div>
    )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl font-bold text-white">
          {(data.profile.display_name || data.profile.username || 'U')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{data.profile.display_name || data.profile.username}</h1>
          <p className="text-sm text-text-dim">@{data.profile.username}</p>
          {data.profile.bio && <p className="mt-1 text-sm text-text-dim">{data.profile.bio}</p>}
        </div>
      </div>

      <h2 className="text-lg font-bold">Öffentliche Moves ({data.moves.length})</h2>
      <MoveGrid moves={data.moves} />
    </div>
  )
}
