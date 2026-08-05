import type { NodeStatus, Run, Topology } from './types'

// A frieze read left to right: rank (depth from the entry) is the X axis, and siblings in
// one rank stack down the Y axis at a fixed row height each. This replaced a fixed-width
// canvas that spread a rank's nodes evenly by COUNT alone — when several router-driven
// nodes (no declared static target) fell through to the same fallback rank, that crammed
// them onto one row regardless of how many there were, and their labels collided. Stacking
// at a fixed row height instead means a busy rank grows the frame taller, never crowds it.
const LEFT_MARGIN = 100
const COLUMN_WIDTH = 220
const RIGHT_MARGIN = 80
const TOP_MARGIN = 60
const ROW_HEIGHT = 110
const BOTTOM_MARGIN = 60

export interface PlacedNode {
  id: string
  kind: string
  x: number
  y: number
  /** Its successors are decided at run time, so the drawing stops short of the truth. */
  openEnded: boolean
}

export interface PlacedEdge {
  from: string
  to: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Arranges a declared topology as a horizontal timeline: the entry on the left, its targets
 * one column to the right, and so on. Depth comes from the declared edges, which is all we
 * have — a router-driven branch has no declared target, so the node it leaves is flagged
 * open-ended rather than drawn as a dead end.
 *
 * Deterministic by construction: columns, rows and order follow the declaration, never a
 * map walk.
 */
export function layoutHive(topology: Topology): {
  nodes: PlacedNode[]
  edges: PlacedEdge[]
  width: number
  height: number
} {
  const rank = rankNodes(topology)
  const byRank = new Map<number, string[]>()
  for (const node of topology.nodes) {
    const r = rank.get(node.id) ?? 0
    byRank.set(r, [...(byRank.get(r) ?? []), node.id])
  }

  const openEnded = new Set(
    (topology.edges ?? []).filter((e) => e.dynamic).map((e) => e.from),
  )

  const placed = new Map<string, PlacedNode>()
  let busiestRank = 1
  for (const [r, ids] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    busiestRank = Math.max(busiestRank, ids.length)
    ids.forEach((id, i) => {
      placed.set(id, {
        id,
        kind: topology.nodes.find((n) => n.id === id)?.kind ?? 'tool',
        x: LEFT_MARGIN + r * COLUMN_WIDTH,
        y: TOP_MARGIN + i * ROW_HEIGHT,
        openEnded: openEnded.has(id),
      })
    })
  }

  const edges: PlacedEdge[] = []
  for (const edge of topology.edges ?? []) {
    const from = placed.get(edge.from)
    if (!from) continue
    for (const target of edge.to ?? []) {
      const to = placed.get(target)
      // A dynamic route may reach a node the declaration never named: skip what we cannot place.
      if (!to) continue
      edges.push({ from: edge.from, to: target, x1: from.x, y1: from.y, x2: to.x, y2: to.y })
    }
  }

  // The frame follows the graph: width grows with depth, height with the busiest column —
  // a two-node run should not sit marooned in a wide, tall canvas either way.
  const deepest = Math.max(0, ...[...byRank.keys()])
  const width = LEFT_MARGIN + deepest * COLUMN_WIDTH + RIGHT_MARGIN
  const height = TOP_MARGIN + (busiestRank - 1) * ROW_HEIGHT + BOTTOM_MARGIN

  return { nodes: [...placed.values()], edges, width, height }
}

/** Depth of each node, following declared edges from the entry. */
function rankNodes(topology: Topology): Map<string, number> {
  const successors = new Map<string, string[]>()
  for (const edge of topology.edges ?? []) {
    successors.set(edge.from, [...(successors.get(edge.from) ?? []), ...(edge.to ?? [])])
  }

  const rank = new Map<string, number>([[topology.entry, 0]])
  const queue = [topology.entry]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of successors.get(current) ?? []) {
      if (rank.has(next)) continue // first path wins; cycles terminate here
      rank.set(next, (rank.get(current) ?? 0) + 1)
      queue.push(next)
    }
  }

  // A node nothing points at still belongs on screen: park it on the last rank.
  const deepest = Math.max(0, ...rank.values())
  for (const node of topology.nodes) {
    if (!rank.has(node.id)) rank.set(node.id, deepest + 1)
  }
  return rank
}

/**
 * How a node stands right now.
 *
 * A failure names the nodes that broke, and guarantees that any other node of the reported
 * frontier completed — the producer waits for the whole level before giving up. So a
 * neighbour of a broken node is drawn as done on reported fact, not on optimism.
 *
 * When no node is named the producer could not say, and the whole live frontier is marked
 * instead. That is deliberately coarse: singling one out with nothing to go on would be a
 * guess dressed as a fact.
 */
export function nodeStatus(run: Run, nodeId: string): NodeStatus {
  const inFrontier = run.frontier.includes(nodeId)

  if (run.status === 'failed') {
    const named = run.error?.nodes
    const broke = named && named.length > 0 ? named.includes(nodeId) : inFrontier

    return broke ? 'failed' : reached(run, nodeId) ? 'done' : 'pending'
  }
  if (run.status === 'running' && inFrontier) {
    return 'active'
  }
  return reached(run, nodeId) ? 'done' : 'pending'
}

function reached(run: Run, nodeId: string): boolean {
  return (run.visited ?? []).includes(nodeId)
}
