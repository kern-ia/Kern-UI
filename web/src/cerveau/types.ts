/** Mirrors internal/memory.Cerveau in the Go backend. Keep both sides in step. */
export interface CerveauNode {
  id: string
  kind: string
  label: string
}

export interface CerveauEdge {
  from: string
  to: string
  relation: string
}

export interface Cerveau {
  nodes: CerveauNode[]
  edges: CerveauEdge[]
  /** The traversal's real starting point(s) — every graph root, or the one focus node on
   * a dive. Needed to lay the graph out around its actual center(s); deriving this from
   * the edge list alone would be a guess on a graph that can have cycles. */
  roots: string[]
}

/** What the browser knows about the memory graph right now. */
export type CerveauState =
  | { status: 'loading' }
  | { status: 'ready'; cerveau: Cerveau }
  /** No memory source configured on kern-ui — distinct from kern-memory answering with none. */
  | { status: 'unconfigured' }
  | { status: 'error' }
