import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useMyMoveData } from '../hooks/useMyMoveData'
import { MoveGrid } from '../components/moves/MoveGrid'
import type { Collection, Move } from '../lib/types'

export function CollectionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: myData } = useMyMoveData()
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['collection', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: col } = await supabase.from('collections').select('*').eq('id', id!).maybeSingle()
      const { data: items } = await supabase
        .from('collection_items')
        .select('position, move:moves(*)')
        .eq('collection_id', id!)
        .order('position', { ascending: true })
      const rows = (items ?? []) as unknown as Array<{ move: Move }>
      return {
        collection: col as Collection | null,
        moves: rows.map((i) => i.move),
      }
    },
  })

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from('collections').delete().eq('id', id!)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      navigate('/sammlungen')
    },
  })

  if (isLoading) return <div className="py-20 text-center text-text-dim">Lädt…</div>
  if (!data?.collection) return <div className="py-20 text-center text-text-dim">Sammlung nicht gefunden.</div>

  const share = async () => {
    const url = `${window.location.origin}/s/${data.collection!.share_slug}`
    try {
      if (navigator.share) await navigator.share({ title: data.collection!.name, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/sammlungen')} className="text-sm text-text-dim hover:text-text">
        ← Sammlungen
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.collection.name}</h1>
          <p className="text-sm text-text-dim">{data.moves.length} Moves</p>
        </div>
        <div className="flex gap-2">
          <button onClick={share} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
            {copied ? '✓ Kopiert' : '🔗 Teilen'}
          </button>
          <button
            onClick={() => confirm('Sammlung löschen?') && del.mutate()}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-red-400"
          >
            🗑
          </button>
        </div>
      </div>

      <MoveGrid moves={data.moves} myData={myData} />
    </div>
  )
}
