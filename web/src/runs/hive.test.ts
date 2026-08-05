import { layoutHive, nodeStatus } from './hive'
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

// The frieze reads left to right: rank (depth from the entry) is now the X axis, not Y.
it('places the entry on the first column and its targets in the column after', () => {
  const { nodes } = layoutHive(topology)
  const at = (id: string) => nodes.find((n) => n.id === id)!

  expect(at('think').x).toBeLessThan(at('scribe').x)
  expect(at('scribe').x).toBeLessThan(at('done').x)
  expect(at('scribe').x).toBe(at('audit').x)
})

// Siblings in one column stack vertically now, at a fixed row height each — the fix for
// the overlap bug: a column with many nodes grows taller instead of crowding a fixed width
// regardless of count.
it('stacks siblings down the column instead of crowding a fixed width', () => {
  const { nodes } = layoutHive(topology)

  expect(nodes.find((n) => n.id === 'scribe')!.y).not.toBe(
    nodes.find((n) => n.id === 'audit')!.y,
  )
  expect(nodes.find((n) => n.id === 'scribe')!.x).toBe(
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

// The real bug this session: several router-driven nodes with no declared target all fall
// through to the same fallback rank, and got crammed onto one row by count alone.
// Reproduced here at the shape of the community-management-agency graph — 6 of 8 nodes
// park on the rank after strategiste.
it('gives every node parked on the fallback rank its own row, not a shared crowded one', () => {
  const routed: Topology = {
    entry: 'audience',
    nodes: [
      { id: 'audience', kind: 'agent' },
      { id: 'strategiste', kind: 'agent' },
      { id: 'confirm_strategie', kind: 'tool' },
      { id: 'strategie_refusee', kind: 'tool' },
      { id: 'redacteur', kind: 'agent' },
      { id: 'confirm_publication', kind: 'tool' },
      { id: 'publieur', kind: 'agent' },
      { id: 'refus_publication', kind: 'tool' },
    ],
    edges: [
      { from: 'audience', to: ['strategiste'] },
      { from: 'strategiste', dynamic: true },
      { from: 'confirm_strategie', dynamic: true },
      { from: 'redacteur', to: ['confirm_publication'] },
      { from: 'confirm_publication', dynamic: true },
    ],
  }

  const { nodes } = layoutHive(routed)
  const parked = nodes.filter((n) =>
    [
      'confirm_strategie',
      'strategie_refusee',
      'redacteur',
      'confirm_publication',
      'publieur',
      'refus_publication',
    ].includes(n.id),
  )
  const rows = new Set(parked.map((n) => n.y))

  expect(rows.size).toBe(parked.length)
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

// Width now follows depth (more ranks = wider frieze) and height follows the busiest
// column (more siblings = taller), instead of a fixed canvas either way.
it('sizes the width to how deep the graph runs', () => {
  const flat: Topology = { entry: 'a', nodes: [{ id: 'a', kind: 'tool' }], edges: [] }

  expect(layoutHive(flat).width).toBeLessThan(layoutHive(topology).width)
  expect(layoutHive(flat).width).toBeGreaterThan(0)
})

it('sizes the height to the busiest column', () => {
  const wide: Topology = {
    entry: 'a',
    nodes: [
      { id: 'a', kind: 'tool' },
      { id: 'b1', kind: 'tool' },
      { id: 'b2', kind: 'tool' },
      { id: 'b3', kind: 'tool' },
    ],
    edges: [{ from: 'a', to: ['b1', 'b2', 'b3'] }],
  }

  expect(layoutHive(wide).height).toBeGreaterThan(layoutHive(topology).height)
})

it('keeps every node inside the frame it computed', () => {
  const { nodes, width, height } = layoutHive(topology)

  expect(nodes.every((n) => n.x > 0 && n.x < width)).toBe(true)
  expect(nodes.every((n) => n.y > 0 && n.y < height)).toBe(true)
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
