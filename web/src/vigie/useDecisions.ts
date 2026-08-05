import { useEffect, useState } from 'react'
import type { Connection } from '../runs/types'
import type { Decision } from './types'

/**
 * How many recent decisions the browser holds. A best-effort feed, not an event log (see
 * internal/stream.Hub's own doc comment) — a long session must not grow this without bound.
 */
const MAX_DECISIONS = 100

interface DecisionStream {
  decisions: Decision[]
  connection: Connection
}

/**
 * Subscribes to the server's relayed behavioural decision stream.
 *
 * Unlike `useRunStream`, this opens with no snapshot: a decision is a transient event with
 * no "current state" to summarise on connect, so the list starts empty and fills only from
 * decisions seen from this point forward. That is a deliberate difference from the run
 * stream's contract, not an oversight — see docs/index/vigie-view.md.
 */
export function useDecisions(url: string): DecisionStream {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [connection, setConnection] = useState<Connection>('connecting')

  useEffect(() => {
    const source = new EventSource(url)

    const onDecision = (event: MessageEvent) => {
      const parsed = parse<Decision>(event.data)
      if (parsed === undefined) return
      setDecisions((current) => [parsed, ...current].slice(0, MAX_DECISIONS))
      setConnection('open')
    }

    source.addEventListener('decision', onDecision)
    // EventSource retries on its own; surface the outage while it does.
    source.onerror = () => setConnection('error')

    return () => {
      source.removeEventListener('decision', onDecision)
      source.close()
    }
  }, [url])

  return { decisions, connection }
}

/** Returns undefined on a malformed frame: a bad payload must not take the view down. */
function parse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T
  } catch {
    return undefined
  }
}
