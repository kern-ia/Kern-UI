import { useCallback, useEffect, useState } from 'react'
import type { Document, DocumentState } from './types'

/**
 * Fetches one document with its suggestions, and hands back a refetch so a resolved
 * suggestion's status can be re-read from kern-memory rather than guessed at locally.
 */
export function useDocument(baseUrl: string, id: string | null): [DocumentState, () => void] {
  const [state, setState] = useState<DocumentState>({ status: 'loading' })
  const [generation, setGeneration] = useState(0)

  const refetch = useCallback(() => setGeneration((g) => g + 1), [])

  useEffect(() => {
    if (id === null) return
    const controller = new AbortController()
    setState({ status: 'loading' })

    void (async () => {
      try {
        const response = await fetch(`${baseUrl}/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', document: (await response.json()) as Document })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [baseUrl, id, generation])

  return [state, refetch]
}
