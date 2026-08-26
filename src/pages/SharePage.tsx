import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Countdown } from '../components/Countdown'
import { MediaGallery, MediaPlayer, moveToSource } from '../components/moves/MediaPreview'
import { categoryLabel } from '../lib/constants'
import type { Move, MoveMedia, Lesson, Collection, MediaSource } from '../lib/types'

type ShareData =
  | { type: 'move'; move: Move; media: MoveMedia[]; steps: Move[]; expires_at: string | null }
  | { type: 'lesson'; lesson: Lesson; combo: Move | null; moves: Move[]; expires_at: string | null }
  | { type: 'collection'; collection: Collection; moves: Move[]; expires_at: string | null }
  | { type: 'guest'; email: string; expires_at: string | null }

/** Public viewer for a share link: single content read-only, or guest entry to the whole platform. */
export function SharePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { isRealUser } = useAuth()
  const [entering, setEntering] = useState(false)
  const [enterErr, setEnterErr] = useState<string | null>(null)
  const [expiredNow, setExpiredNow] = useState(false) // flips when the countdown hits zero while viewing

  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<ShareData> => {
      const { data, error } = await supabase.functions.invoke('share', { body: { token } })
      if (error) {
        // Non-2xx: read the function's JSON body to distinguish "expired" from "not found".
        const ctx = (error as { context?: Response }).context
        try {
          const body = ctx ? await ctx.json() : null
          throw new Error(body?.error === 'expired' ? 'expired' : 'not_found')
        } catch (e) {
          throw e instanceof Error && e.message === 'expired' ? e : new Error('not_found')
        }
      }
      if (data?.error) throw new Error(data.error)
      return data as ShareData
    },
  })

  const linkExpiry = data && data.type !== 'guest' ? data.expires_at : null

  const shell = (content: React.ReactNode) => (
    <div className="min-h-svh bg-bg">
      <header className="border-b border-border bg-bg/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 font-bold tracking-tight">
          <span className="text-xl">💃</span>
          <span>Bachata<span className="text-accent">Moves</span></span>
          {linkExpiry && !expiredNow ? (
            <span className="ml-auto rounded-full border border-accent/50 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent" title="So lange ist dieser Link noch gültig">
              ⏳ noch <Countdown until={linkExpiry} onExpired={() => setExpiredNow(true)} />
            </span>
          ) : (
            <span className="ml-auto text-xs font-normal text-text-dim">Geteilter Inhalt</span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{content}</main>
    </div>
  )

  const expiredView = shell(
    <div className="py-20 text-center text-text-dim">
      <div className="text-5xl">⏳</div>
      <p className="mt-3 font-medium text-text">Dieser Link ist abgelaufen.</p>
      <p className="mt-1 text-sm">Bitte die Person fragen, die ihn geteilt hat — sie kann ihn verlängern oder neu erstellen.</p>
    </div>,
  )

  if (isLoading) return shell(<p className="py-20 text-center text-text-dim">Lädt…</p>)
  if (expiredNow) return expiredView
  if (error || !data) {
    if ((error as Error | null)?.message === 'expired') return expiredView
    return shell(
      <div className="py-20 text-center text-text-dim">
        <div className="text-5xl">🔒</div>
        <p className="mt-3 font-medium text-text">Dieser Link existiert nicht (mehr).</p>
        <p className="mt-1 text-sm">Bitte die Person fragen, die ihn geteilt hat.</p>
      </div>,
    )
  }

  if (data.type === 'guest') {
    const enter = async () => {
      setEntering(true)
      setEnterErr(null)
      // The guest account's password IS the link token (unguessable, expiry enforced via RLS).
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: token! })
      if (error) {
        setEnterErr('Gast-Zugang konnte nicht geöffnet werden. Bitte den Link erneut anfragen.')
        setEntering(false)
        return
      }
      navigate('/', { replace: true })
    }
    return shell(
      <div className="mx-auto max-w-sm py-14 text-center">
        <div className="text-5xl">🎟️</div>
        <h1 className="mt-3 text-2xl font-bold">Gast-Zugang</h1>
        <p className="mt-2 text-sm text-text-dim">
          Du wurdest eingeladen, BachataMoves als Gast zu erkunden
          {data.expires_at
            ? ` — gültig bis ${new Date(data.expires_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
            : '.'}
        </p>
        {data.expires_at && (
          <p className="mt-2 inline-block rounded-full border border-accent/50 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            ⏳ noch <Countdown until={data.expires_at} onExpired={() => setExpiredNow(true)} />
          </p>
        )}
        {isRealUser ? (
          <button onClick={() => navigate('/', { replace: true })} className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-white">
            Du bist bereits angemeldet — zur Plattform →
          </button>
        ) : (
          <button onClick={enter} disabled={entering} className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
            {entering ? 'Öffnet…' : 'Als Gast betreten'}
          </button>
        )}
        {enterErr && <p className="mt-3 text-sm text-red-400">{enterErr}</p>}
      </div>,
    )
  }

  if (data.type === 'move') {
    const sources: MediaSource[] = [
      moveToSource(data.move),
      ...data.media.map((m) => ({
        id: m.id, label: m.label, youtube_id: m.youtube_id, media_url: m.media_url,
        thumb_url: m.thumb_url, clip_start: m.clip_start, clip_end: m.clip_end,
      })),
    ]
    return shell(
      <div className="space-y-5">
        <MediaGallery sources={sources} name={data.move.name} />
        <div>
          <h1 className="text-2xl font-bold">{data.move.name}</h1>
          <p className="mt-1 text-sm text-text-dim">
            {categoryLabel(data.move.category)}{data.move.kind === 'combo' && ' · Combo'}
          </p>
          {data.move.description && <p className="mt-2 whitespace-pre-wrap text-sm text-text-dim">{data.move.description}</p>}
        </div>
        {data.steps.length > 0 && <MoveList title={`Ablauf (${data.steps.length} Moves)`} moves={data.steps} />}
      </div>,
    )
  }

  if (data.type === 'lesson') {
    return shell(
      <div className="space-y-5">
        <div>
          {(data.lesson.school || data.lesson.course) && (
            <p className="text-sm text-text-dim">
              {data.lesson.school ? `🏫 ${data.lesson.school} · ` : ''}{data.lesson.course ?? ''}
            </p>
          )}
          <h1 className="text-2xl font-bold">
            {data.lesson.lesson_number != null ? `Lektion ${data.lesson.lesson_number}` : data.lesson.title}
          </h1>
          {data.lesson.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-text-dim">{data.lesson.notes}</p>}
        </div>
        {data.combo && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-text-dim">Ganze Combo</h2>
            <MediaPlayer move={data.combo} />
          </div>
        )}
        <MoveList title={`Moves dieser Class (${data.moves.length})`} moves={data.moves} />
      </div>,
    )
  }

  return shell(
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-text-dim">Geteilte Sammlung</p>
        <h1 className="mt-1 text-2xl font-bold">{data.collection.name}</h1>
        {data.collection.description && <p className="mt-1 text-sm text-text-dim">{data.collection.description}</p>}
      </div>
      <MoveList title={`${data.moves.length} Moves`} moves={data.moves} />
    </div>,
  )
}

function MoveList({ title, moves }: { title: string; moves: Move[] }) {
  if (!moves.length) return null
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-text-dim">{title}</h2>
      {moves.map((m, i) => (
        <div key={m.id ?? i} className="rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
            <h3 className="font-semibold">{m.name}</h3>
            <span className="ml-auto text-xs text-text-dim">{categoryLabel(m.category)}</span>
          </div>
          <MediaPlayer move={m} />
        </div>
      ))}
    </section>
  )
}
