import type { Cerveau, CerveauNode } from './types'

/** Matches HiveGraph's own viewBox convention (runs/HiveGraph.tsx) — a fixed coordinate
 * space the SVG scales to fit, not real pixels. */
export const CANVAS_WIDTH = 1000
export const CANVAS_HEIGHT = 600
const CENTER_X = CANVAS_WIDTH / 2
const CENTER_Y = CANVAS_HEIGHT / 2

/** Radial distance between consecutive hop rings. */
const RING_SPACING = 150
/** Roots sit close to the center rather than exactly on top of each other when there is
 * more than one — a small ring of its own, not hop 0's "radius zero" special case. */
const ROOT_RING_RADIUS = 36

export interface PositionedNode extends CerveauNode {
  x: number
  y: number
  /** Hops from the nearest root — 0 for a root itself. A node no root can reach at all
   * (a disconnected part of the graph) gets one ring past the farthest real hop, so it is
   * still drawn somewhere sane rather than crashing or stacking on the center. */
  hop: number
}

export interface CerveauLayout {
  nodes: PositionedNode[]
}

/**
 * Radial layout: root(s) at/near the center, each further hop on its own ring — matches
 * the mockup's actual look (a core with radiating satellites), and needs no force-directed
 * simulation or new dependency, the same "hand-rolled SVG, no charting library" posture
 * HiveGraph already established for the Ruche view.
 */
export function layoutCerveau(cerveau: Cerveau): CerveauLayout {
  const hops = computeHops(cerveau)
  const maxRealHop = Math.max(0, ...[...hops.values()].filter((h) => h !== Infinity))
  const orphanHop = maxRealHop + 1

  const byHop = new Map<number, CerveauNode[]>()
  for (const node of cerveau.nodes) {
    const hop = hops.get(node.id)
    const bucket = hop === undefined || hop === Infinity ? orphanHop : hop
    if (!byHop.has(bucket)) byHop.set(bucket, [])
    byHop.get(bucket)!.push(node)
  }

  const nodes: PositionedNode[] = []
  for (const [hop, group] of byHop) {
    if (hop === 0 && group.length === 1) {
      nodes.push({ ...group[0], x: CENTER_X, y: CENTER_Y, hop })
      continue
    }
    const radius = hop === 0 ? ROOT_RING_RADIUS : RING_SPACING * hop
    group.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2
      nodes.push({
        ...node,
        x: CENTER_X + radius * Math.cos(angle),
        y: CENTER_Y + radius * Math.sin(angle),
        hop,
      })
    })
  }

  return { nodes }
}

/** BFS from every root at once, over an undirected view of the edges — a graph edge's
 * direction is meaningful data (drawn as an arrow), but layout only cares about distance,
 * and treating edges as directed here would place a node kern-memory reached only via an
 * incoming edge as unreachable. */
function computeHops(cerveau: Cerveau): Map<string, number> {
  const adjacency = new Map<string, string[]>()
  for (const e of cerveau.edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, [])
    adjacency.get(e.from)!.push(e.to)
    if (!adjacency.has(e.to)) adjacency.set(e.to, [])
    adjacency.get(e.to)!.push(e.from)
  }

  const hops = new Map<string, number>()
  const queue: string[] = []
  for (const root of cerveau.roots) {
    if (hops.has(root)) continue
    hops.set(root, 0)
    queue.push(root)
  }

  let i = 0
  while (i < queue.length) {
    const current = queue[i]
    i += 1
    const currentHop = hops.get(current)!
    for (const neighbour of adjacency.get(current) ?? []) {
      if (hops.has(neighbour)) continue
      hops.set(neighbour, currentHop + 1)
      queue.push(neighbour)
    }
  }

  return hops
}
