import { useEffect, useState } from 'react'
import type { DocumentsState, DocumentSummary } from './types'

/**
 * Fetches the document catalogue for Rédaction.
 *
 * A fetch, not a subscription, same reasoning as the Grimoire's registry and the Espace's
 * tool catalogue: this changes when a document is seeded, not on the run stream's schedule.
 *
 * A 404 means no document source is configured on kern-ui — a different fact from
 * kern-memory answering with an empty list, so the view can say which one is true.
 */
export function useDocuments(url: string): DocumentsState {
  const [state, setState] = useState<DocumentsState>({ status: 'loading' })

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
        setState({ status: 'ready', documents: (await response.json()) as DocumentSummary[] })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [url])

  return state
}
