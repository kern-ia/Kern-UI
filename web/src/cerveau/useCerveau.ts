import { useEffect, useState } from 'react'
import type { Cerveau, CerveauState } from './types'

/**
 * Fetches one neighbourhood: the broad initial view with no focus, or one node's
 * neighbourhood when focus ("kind:id") is set — the "double-clic pour plonger" dive
 * replaces the view rather than merging into it, so a change of focus is a fresh fetch,
 * not a client-side filter of what is already held.
 */
export function useCerveau(url: string, focus: string | null): CerveauState {
  const [state, setState] = useState<CerveauState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    const target = focus ? `${url}?from=${encodeURIComponent(focus)}` : url

    void (async () => {
      try {
        const response = await fetch(target, { signal: controller.signal })
        if (response.status === 404) {
          setState({ status: 'unconfigured' })
          return
        }
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', cerveau: (await response.json()) as Cerveau })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [url, focus])

  return state
}
