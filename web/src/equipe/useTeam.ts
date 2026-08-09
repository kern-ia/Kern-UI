import { useEffect, useState } from 'react'

export type TeamState =
  | { status: 'loading' }
  | { status: 'ready'; names: string[] }
  | { status: 'error' }

/** Fetches the account roster — names only, never a hash (see internal/httpapi/accounts.go). */
export function useTeam(url: string): TeamState {
  const [state, setState] = useState<TeamState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', names: (await response.json()) as string[] })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [url])

  return state
}
