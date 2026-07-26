/** Mirrors projection.Run in the Go backend. Keep both sides in step. */
export type RunStatus = 'running' | 'finished'

export interface Run {
  id: string
  graph: string
  status: RunStatus
  step: number
  frontier: string[]
  state?: unknown
  started_at: string
  updated_at: string
  ended_at?: string
}

/** State of the browser's link to the server. */
export type Connection = 'connecting' | 'open' | 'error'
