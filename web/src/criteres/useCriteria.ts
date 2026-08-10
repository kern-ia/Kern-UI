import { useEffect, useState } from 'react'
import type { Criterion, CriteriaState } from './types'

/** Fetches the declarative (.okf) layer of kern-memory — bank criteria, not a live stream:
 * a criterion changes when someone writes one, not on every render. */
export function useCriteria(url: string): CriteriaState {
  const [state, setState] = useState<CriteriaState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (response.status === 404) {
          setState({ status: 'unconfigured' })
          return
        }
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', criteria: (await response.json()) as Criterion[] })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [url])

  return state
}
