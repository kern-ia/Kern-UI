import { useEffect, useState } from 'react'
import type { Budget, BudgetState } from './types'

/** How often the gauge refetches. One default, not a setting — see useBudget's own doc. */
const REFRESH_INTERVAL_MS = 15_000

/**
 * Fetches the consumption snapshot for Vigie's budget tile, and refreshes it on an
 * interval.
 *
 * A fetch on a timer, not a subscription: the C4 snapshot is a slowly-changing gauge
 * value, the same reasoning `useToolValue` already applies to a widget's own value — asked
 * for periodically rather than emitted on its own schedule. Live behavioural *events* are
 * a different concern entirely and travel over `useDecisions`'s SSE subscription instead.
 *
 * A 404 means no firewall source is configured on kern-ui — a different fact from the
 * firewall answering with a real, if empty, snapshot, so the view can say which one is true.
 */
export function useBudget(url: string): BudgetState {
  const [state, setState] = useState<BudgetState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function fetchOnce() {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (cancelled) return
        if (response.status === 404) {
          setState({ status: 'unconfigured' })
          return
        }
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', budget: (await response.json()) as Budget })
      } catch {
        if (cancelled || controller.signal.aborted) return
        setState({ status: 'error' })
      }
    }

    setState({ status: 'loading' })
    void fetchOnce()
    const interval = setInterval(() => void fetchOnce(), REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [url])

  return state
}
