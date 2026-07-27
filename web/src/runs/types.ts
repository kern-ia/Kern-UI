/** Mirrors projection.Run in the Go backend. Keep both sides in step. */
export type RunStatus = 'running' | 'finished' | 'failed'

/** How a node stands within its run, derived from the frontier and what came before. */
export type NodeStatus = 'pending' | 'active' | 'done' | 'failed'

export interface TopologyNode {
  id: string
  kind: 'tool' | 'agent' | 'subgraph'
  /**
   * The catalogue entry backing an agent node — the link between a run and the Grimoire.
   * Not the id: a node `greet` may run the skill `planner`. Tool nodes name a Go function
   * instead and declare none.
   */
  skill?: string
}

export interface TopologyEdge {
  from: string
  to?: string[]
  /** A router picks the targets at run time, so none are declared. */
  dynamic?: boolean
}

export interface Topology {
  entry: string
  nodes: TopologyNode[]
  edges?: TopologyEdge[]
}

export interface Failure {
  message: string
}

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
  /** Every node the run has reached so far, sorted. */
  visited?: string[]
  /**
   * The nodes whose model is generating right now, sorted. Empty between generations and
   * once the run is over — a run that is live is not necessarily one that is thinking.
   */
  generating?: string[]
  topology?: Topology
  error?: Failure
}

/** State of the browser's link to the server. */
export type Connection = 'connecting' | 'open' | 'error'
