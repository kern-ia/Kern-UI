/** Mirrors projection.Run in the Go backend. Keep both sides in step. */
export type RunStatus = 'running' | 'finished' | 'failed'

/** How a node stands within its run, derived from the frontier and what came before. */
export type NodeStatus = 'pending' | 'active' | 'done' | 'failed'

export interface TopologyNode {
  id: string
  kind: 'tool' | 'agent' | 'subgraph' | 'approval'
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
  /**
   * The nodes of the reported frontier that actually broke. A node in that frontier and
   * absent from here completed — the producer waits for the whole level before giving up,
   * so this is fact, not inference. Absent entirely when the producer could not say.
   */
  nodes?: string[]
}

/** Points a nested run at the subgraph node it belongs to. */
export interface ParentRef {
  run_id: string
  node_id: string
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
  /** Set when this run is the nested graph of a subgraph node in another run. */
  parent?: ParentRef
  /** Who asked for this run (C6). Empty means open — steerable by anyone. */
  requester?: string
}

/** State of the browser's link to the server. */
export type Connection = 'connecting' | 'open' | 'error'
