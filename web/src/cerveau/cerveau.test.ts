import { layoutCerveau } from './cerveau'
import type { Cerveau } from './types'

const CENTER_X = 500
const CENTER_Y = 300

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x1 - x2, y1 - y2)
}

it('places a single root at the center', () => {
  const cerveau: Cerveau = { nodes: [{ id: 'okf:a', kind: 'okf', label: 'A' }], edges: [], roots: ['okf:a'] }

  const { nodes } = layoutCerveau(cerveau)

  expect(nodes).toHaveLength(1)
  expect(nodes[0].x).toBeCloseTo(CENTER_X)
  expect(nodes[0].y).toBeCloseTo(CENTER_Y)
  expect(nodes[0].hop).toBe(0)
})

it('places a direct neighbour one ring out from the root', () => {
  const cerveau: Cerveau = {
    nodes: [
      { id: 'okf:a', kind: 'okf', label: 'A' },
      { id: 'vector:b', kind: 'vector', label: 'B' },
    ],
    edges: [{ from: 'okf:a', to: 'vector:b', relation: 'mène-à' }],
    roots: ['okf:a'],
  }

  const { nodes } = layoutCerveau(cerveau)
  const root = nodes.find((n) => n.id === 'okf:a')!
  const neighbour = nodes.find((n) => n.id === 'vector:b')!

  expect(neighbour.hop).toBe(1)
  expect(root.hop).toBe(0)
  // A real ring: closer to the root than a hop-2 node would be, and not on top of it.
  const radius = dist(neighbour.x, neighbour.y, root.x, root.y)
  expect(radius).toBeGreaterThan(40)
})

it('spreads several roots around the center rather than stacking them', () => {
  const cerveau: Cerveau = {
    nodes: [
      { id: 'okf:a', kind: 'okf', label: 'A' },
      { id: 'okf:b', kind: 'okf', label: 'B' },
    ],
    edges: [],
    roots: ['okf:a', 'okf:b'],
  }

  const { nodes } = layoutCerveau(cerveau)
  const a = nodes.find((n) => n.id === 'okf:a')!
  const b = nodes.find((n) => n.id === 'okf:b')!

  expect(dist(a.x, a.y, b.x, b.y)).toBeGreaterThan(1)
})

it('places a node unreached by any root without crashing or overlapping the center', () => {
  const cerveau: Cerveau = {
    nodes: [
      { id: 'okf:a', kind: 'okf', label: 'A' },
      { id: 'vector:orphan', kind: 'vector', label: 'Orphelin' },
    ],
    edges: [],
    roots: ['okf:a'],
  }

  const { nodes } = layoutCerveau(cerveau)
  const orphan = nodes.find((n) => n.id === 'vector:orphan')!

  expect(orphan.hop).toBeGreaterThan(0)
  expect(Number.isFinite(orphan.x)).toBe(true)
  expect(Number.isFinite(orphan.y)).toBe(true)
})

it('handles an empty graph', () => {
  const { nodes } = layoutCerveau({ nodes: [], edges: [], roots: [] })
  expect(nodes).toEqual([])
})
