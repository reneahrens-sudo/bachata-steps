import { useEffect, useRef, useState } from 'react'

function fmt(ms: number): string {
  if (ms <= 0) return 'abgelaufen'
  const totalMin = Math.floor(ms / 60_000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d >= 1) return `${d} Tg ${h} Std`
  if (h >= 1) return `${h} Std ${m} Min`
  if (totalMin >= 1) return `${m} Min`
  return 'unter 1 Min'
}

/** Live remaining-time label (ticks every 10s); fires onExpired once when the deadline passes. */
export function Countdown({ until, onExpired }: { until: string; onExpired?: () => void }) {
  const [, setTick] = useState(0)
  const fired = useRef(false)
  const ms = new Date(until).getTime() - Date.now()

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (ms <= 0 && !fired.current) {
      fired.current = true
      onExpired?.()
    }
  })

  return <>{fmt(ms)}</>
}
