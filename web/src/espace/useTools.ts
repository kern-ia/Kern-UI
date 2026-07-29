import { useEffect, useState } from 'react'
import type { ToolSpec, ToolsState } from './types'

/**
 * Fetches the tool catalogue for the Espace.
 *
 * A fetch, not a subscription, for the same reason as the Grimoire's registry: the
 * catalogue changes when a tool is installed, not on the run stream's schedule.
 *
 * A 404 means no tool source is configured on kern-ui — a different fact from kern-orch
 * answering with an empty list, so the view can say which one is true.
 */
export function useTools(url: string): ToolsState {
  const [state, setState] = useState<ToolsState>({ status: 'loading' })

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
        setState({ status: 'ready', specs: (await response.json()) as ToolSpec[] })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [url])

  return state
}
