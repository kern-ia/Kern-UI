import { useEffect, useState } from 'react'
import type { Catalogue, RegistryState } from './types'

/**
 * Fetches the skills catalogue.
 *
 * It is a fetch and not a subscription on purpose: a registry changes when a skill is
 * installed, not when a graph advances. Riding the run stream would wake every open
 * browser on every level of every run to deliver a list that did not move.
 *
 * A 404 is not a failure. It is the server saying no producer has published yet, which is
 * a different screen from an empty catalogue — see `RegistryState`.
 */
export function useRegistry(url: string): RegistryState {
  const [state, setState] = useState<RegistryState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (response.status === 404) {
          setState({ status: 'unpublished' })
          return
        }
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', catalogue: (await response.json()) as Catalogue })
      } catch {
        // An aborted fetch is this effect being cleaned up, not an outage: leaving the
        // state alone avoids flashing an error on a view the user just left.
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [url])

  return state
}
