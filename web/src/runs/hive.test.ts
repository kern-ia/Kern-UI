import { HIVE_WIDTH, layoutHive, nodeStatus } from './hive'
import type { Run, Topology } from './types'

const topology: Topology = {
  entry: 'think',
  nodes: [
    { id: 'think', kind: 'agent' },
    { id: 'scribe', kind: 'agent' },
    { id: 'audit', kind: 'tool' },
    { id: 'done', kind: 'tool' },
  ],
  edges: [
    { from: 'think', to: ['scribe', 'audit'] },
    { from: 'scribe', to: ['done'] },
  ],
}

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    graph: 'review',
    status: 'running',
    step: 2,
    frontier: ['scribe'],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:02Z',
    topology,
    visited: ['think'],
    ...over,
  }
}

it('places the entry on the first rank and its targets below', () => {
  const { nodes } = layoutHive(topology)
  const at = (id: string) => nodes.find((n) => n.id === id)!

  expect(at('think').y).toBeLessThan(at('scribe').y)
  expect(at('scribe').y).toBeLessThan(at('done').y)
  expect(at('scribe').y).toBe(at('audit').y)
})

it('spreads siblings across the width instead of stacking them', () => {
  const { nodes } = layoutHive(topology)

  expect(nodes.find((n) => n.id === 'scribe')!.x).not.toBe(
    nodes.find((n) => n.id === 'audit')!.x,
  )
})

it('lays out every declared node, even one nothing points at', () => {
  const orphaned: Topology = {
    entry: 'a',
    nodes: [
      { id: 'a', kind: 'tool' },
      { id: 'lonely', kind: 'tool' },
    ],
    edges: [],
  }

  expect(layoutHive(orphaned).nodes).toHaveLength(2)
})

it('keeps only the edges it can draw', () => {
  const { edges } = layoutHive(topology)

  expect(edges).toHaveLength(3)
  expect(edges.every((e) => e.from && e.to)).toBe(true)
})

// A router picks its targets at run time. Drawing nothing would read as a dead end, so the
// layout reports the node as open-ended and lets the view mark it.
it('flags a node whose successors are decided at run time', () => {
  const dynamic: Topology = {
    entry: 'a',
    nodes: [{ id: 'a', kind: 'tool' }],
    edges: [{ from: 'a', dynamic: true }],
  }

  expect(layoutHive(dynamic).nodes.find((n) => n.id === 'a')!.openEnded).toBe(true)
})

it('is stable: the same topology always lays out the same way', () => {
  expect(layoutHive(topology)).toEqual(layoutHive(topology))
})

it('marks the frontier active, what came before done, the rest pending', () => {
  const r = run()

  expect(nodeStatus(r, 'scribe')).toBe('active')
  expect(nodeStatus(r, 'think')).toBe('done')
  expect(nodeStatus(r, 'audit')).toBe('pending')
})

it('shows no node as active once the run is over', () => {
  const r = run({ status: 'finished', frontier: [], visited: ['think', 'scribe', 'done'] })

  expect(nodeStatus(r, 'scribe')).toBe('done')
  expect(nodeStatus(r, 'audit')).toBe('pending')
})

// We know the run failed, never which node broke: the error carries a message, not an id.
// Colouring one at random would be a guess dressed as a fact.
it('marks the nodes that were running when the run failed, and only those', () => {
  const r = run({ status: 'failed', error: { message: 'agent scribe: exit status 1' } })

  expect(nodeStatus(r, 'scribe')).toBe('failed')
  expect(nodeStatus(r, 'think')).toBe('done')
  expect(nodeStatus(r, 'audit')).toBe('pending')
})

it('sizes the frame to the graph rather than to a fixed canvas', () => {
  const flat: Topology = {
    entry: 'a',
    nodes: [{ id: 'a', kind: 'tool' }],
    edges: [],
  }

  expect(layoutHive(flat).height).toBeLessThan(layoutHive(topology).height)
  expect(layoutHive(flat).height).toBeGreaterThan(0)
})

it('draws into a fixed width so the viewBox can scale it', () => {
  const { nodes } = layoutHive(topology)

  expect(nodes.every((n) => n.x > 0 && n.x < HIVE_WIDTH)).toBe(true)
})

// The producer now says which node broke. Before, the whole live frontier was marked
// failed because naming one would have been a guess; now it is reported fact.
describe('a failure that names its nodes', () => {
  const failedRun = (nodes?: string[]): Run => ({
    id: 'r1',
    graph: 'hello',
    status: 'failed',
    step: 2,
    frontier: ['synthese', 'critique'],
    visited: ['greet', 'synthese', 'critique'],
    started_at: '2026-07-28T12:00:00Z',
    updated_at: '2026-07-28T12:00:02Z',
    error: { message: 'boom', nodes },
  })

  it('marks only the node the producer named', () => {
    const run = failedRun(['synthese'])

    expect(nodeStatus(run, 'synthese')).toBe('failed')
  })

  // The contract guarantees a node of the frontier absent from the list completed, so
  // saying it is done is reported fact rather than optimism.
  it('reports the rest of the frontier as done', () => {
    const run = failedRun(['synthese'])

    expect(nodeStatus(run, 'critique')).toBe('done')
  })

  it('marks every named node when several broke at once', () => {
    const run = failedRun(['critique', 'synthese'])

    expect(nodeStatus(run, 'synthese')).toBe('failed')
    expect(nodeStatus(run, 'critique')).toBe('failed')
  })

  // An older producer sends no list. Falling back to blaming the whole frontier is what
  // this code did before, and it stays the honest answer when nothing is known.
  it('falls back to the whole frontier when the producer named nothing', () => {
    const run = failedRun()

    expect(nodeStatus(run, 'synthese')).toBe('failed')
    expect(nodeStatus(run, 'critique')).toBe('failed')
  })

  it('leaves a node the run never reached alone', () => {
    const run = failedRun(['synthese'])

    expect(nodeStatus(run, 'jamais')).toBe('pending')
  })
})
