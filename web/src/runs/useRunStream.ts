import { useEffect, useState } from 'react'
import { mergeRun, sortRuns } from './merge'
import type { Connection, Run } from './types'

interface RunStream {
  runs: Run[]
  connection: Connection
}

/**
 * Subscribes to the server's run stream.
 *
 * The server opens every connection with a full snapshot, then sends incremental updates.
 * That contract is what makes the backend's best-effort delivery safe: a browser that fell
 * behind and reconnects is resynchronised by the next snapshot, so a dropped update is a
 * transient gap rather than permanent drift.
 */
export function useRunStream(url: string): RunStream {
  const [runs, setRuns] = useState<Run[]>([])
  const [connection, setConnection] = useState<Connection>('connecting')

  useEffect(() => {
    const source = new EventSource(url)

    const onSnapshot = (event: MessageEvent) => {
      const parsed = parse<Run[] | null>(event.data)
      if (parsed === undefined) return
      setRuns(sortRuns(parsed ?? []))
      setConnection('open')
    }

    const onRun = (event: MessageEvent) => {
      const parsed = parse<Run>(event.data)
      if (parsed === undefined) return
      setRuns((current) => mergeRun(current, parsed))
      setConnection('open')
    }

    source.addEventListener('snapshot', onSnapshot)
    source.addEventListener('run', onRun)
    // EventSource retries on its own; surface the outage while it does.
    source.onerror = () => setConnection('error')

    return () => {
      source.removeEventListener('snapshot', onSnapshot)
      source.removeEventListener('run', onRun)
      source.close()
    }
  }, [url])

  return { runs, connection }
}

/** Returns undefined on a malformed frame: a bad payload must not take the view down. */
function parse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T
  } catch {
    return undefined
  }
}
