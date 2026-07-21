import type { StatusFlag } from './types'

export const STYLES = [
  { key: 'bachata', label: 'Bachata' },
  { key: 'salsa', label: 'Salsa' },
  { key: 'kizomba', label: 'Kizomba' },
  { key: 'zouk', label: 'Zouk' },
  { key: 'fitness', label: 'Fitness' },
] as const

export const CATEGORIES = [
  { key: 'basicstep', label: 'Basic Step' },
  { key: 'intro', label: 'Intro' },
  { key: 'footwork', label: 'Footwork' },
  { key: 'sensual', label: 'Sensual' },
  { key: 'bachazouk', label: 'BachaZouk' },
  { key: 'spectacular', label: 'Spectacular' },
  { key: 'ladystyle', label: 'Lady-Style' },
  { key: 'menstyle', label: 'Men-Style' },
  { key: 'step', label: 'Step' },
] as const

export const LEVELS = [1, 2, 3, 4, 5, 6] as const

/** Border/badge color per difficulty level (1 = easiest → 6 = hardest). */
export const LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
  6: '#a855f7',
}

export const STATUS_META: Record<
  StatusFlag,
  { label: string; icon: string; color: string; short: string }
> = {
  learned: { label: 'Gelernt', icon: '✓', color: '#22c55e', short: 'Gelernt' },
  practicing: { label: 'Üben', icon: '🔁', color: '#3b82f6', short: 'Üben' },
  favorite: { label: 'Favorit', icon: '♥', color: '#ff2d78', short: 'Favorit' },
  party: { label: 'Party', icon: '🎉', color: '#a855f7', short: 'Party' },
  next_up: { label: 'Als Nächstes', icon: '❯', color: '#f59e0b', short: 'Nächstes' },
}

export const STATUS_ORDER: StatusFlag[] = ['practicing', 'next_up', 'favorite', 'party', 'learned']

export function categoryLabel(key: string | null): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key ?? '—'
}
export function styleLabel(key: string | null): string {
  return STYLES.find((s) => s.key === key)?.label ?? key ?? '—'
}
