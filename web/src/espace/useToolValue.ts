import { useEffect, useState } from 'react'
import type { ToolValue, ToolValueState } from './types'

/**
 * Invokes one tool with no input and holds its display value.
 *
 * Only tools with no required param reach this hook (see EspaceView) — a widget the
 * reader has nothing to configure before it shows something, matching the mockup's cards,
 * which carry no input of their own.
 */
export function useToolValue(baseUrl: string, name: string): ToolValueState {
  const [state, setState] = useState<ToolValueState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    void (async () => {
      try {
        const response = await fetch(`${baseUrl}/${encodeURIComponent(name)}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: {} }),
          signal: controller.signal,
        })
        if (!response.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', result: (await response.json()) as ToolValue })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    })()

    return () => controller.abort()
  }, [baseUrl, name])

  return state
}
