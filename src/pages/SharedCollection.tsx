import { useParams, Link } from 'react-router-dom'
import { useCollectionBySlug } from '../hooks/useCollections'
import { MoveGrid } from '../components/moves/MoveGrid'

export function SharedCollection() {
  const { slug } = useParams()
  const { data, isLoading } = useCollectionBySlug(slug)

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!data)
    return (
      <div className="py-20 text-center text-text-dim">
        <p>Diese Sammlung existiert nicht oder ist privat.</p>
        <Link to="/" className="mt-2 inline-block font-medium text-accent">
          Zur Startseite →
        </Link>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-text-dim">Geteilte Sammlung</p>
        <h1 className="mt-1 text-2xl font-bold">{data.collection.name}</h1>
        {data.collection.description && (
          <p className="mt-2 text-text-dim">{data.collection.description}</p>
        )}
        <p className="mt-1 text-sm text-text-dim">{data.moves.length} Moves</p>
      </div>
      <MoveGrid moves={data.moves} />
    </div>
  )
}
