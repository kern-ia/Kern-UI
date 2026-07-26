import type { NodeStatus, Run, Topology } from './types'

/** Drawing width; the view scales it with a viewBox. Height follows the content. */
export const HIVE_WIDTH = 1000

const TOP_MARGIN = 70
const RANK_HEIGHT = 130
const BOTTOM_MARGIN = 50

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
 * Arranges a declared topology as the mockup's hive: the entry on top, its targets on the
 * rank below, and so on. Depth comes from the declared edges, which is all we have — a
 * router-driven branch has no declared target, so the node it leaves is flagged open-ended
 * rather than drawn as a dead end.
 *
 * Deterministic by construction: ranks and order follow the declaration, never a map walk.
 */
export function layoutHive(topology: Topology): {
  nodes: PlacedNode[]
  edges: PlacedEdge[]
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
  for (const [r, ids] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    const slot = HIVE_WIDTH / (ids.length + 1)
    ids.forEach((id, i) => {
      placed.set(id, {
        id,
        kind: topology.nodes.find((n) => n.id === id)?.kind ?? 'tool',
        x: Math.round(slot * (i + 1)),
        y: TOP_MARGIN + r * RANK_HEIGHT,
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

  // The frame follows the graph: a two-node run should not sit marooned in a tall canvas.
  const deepest = Math.max(0, ...[...byRank.keys()])
  const height = TOP_MARGIN + deepest * RANK_HEIGHT + BOTTOM_MARGIN

  return { nodes: [...placed.values()], edges, height }
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
 * When a run fails we know it failed, never which node broke — the contract carries a
 * message, not an id. So the nodes that were running at that moment are marked failed, and
 * no other: colouring a specific one would be a guess dressed as a fact.
 */
export function nodeStatus(run: Run, nodeId: string): NodeStatus {
  const inFrontier = run.frontier.includes(nodeId)

  if (run.status === 'failed') {
    return inFrontier ? 'failed' : reached(run, nodeId) ? 'done' : 'pending'
  }
  if (run.status === 'running' && inFrontier) {
    return 'active'
  }
  return reached(run, nodeId) ? 'done' : 'pending'
}

function reached(run: Run, nodeId: string): boolean {
  return (run.visited ?? []).includes(nodeId)
}
