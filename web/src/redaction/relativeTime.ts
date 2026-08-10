/** What relativeUpdate found — fr.ts turns this into displayed text, never this module. */
export type RelativeUpdate = { unit: 'now' } | { unit: 'minutes' | 'hours' | 'days'; count: number }

/** Pure comparison of an ISO timestamp against "now" — no French, no formatting. */
export function relativeUpdate(iso: string, now: Date = new Date()): RelativeUpdate {
  const then = new Date(iso).getTime()
  const diffSeconds = Math.max(0, Math.round((now.getTime() - then) / 1000))

  if (diffSeconds < 60) return { unit: 'now' }
  const minutes = Math.round(diffSeconds / 60)
  if (minutes < 60) return { unit: 'minutes', count: minutes }
  const hours = Math.round(minutes / 60)
  if (hours < 24) return { unit: 'hours', count: hours }
  return { unit: 'days', count: Math.round(hours / 24) }
}
