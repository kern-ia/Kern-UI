import { childRunOf, topLevelRuns } from './nested'
import type { Run } from './types'

function run(id: string, over: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'g',
    status: 'running',
    step: 1,
    frontier: [],
    started_at: '2026-07-28T12:00:00Z',
    updated_at: '2026-07-28T12:00:00Z',
    ...over,
  }
}

describe('the runs worth listing', () => {
  // A nested run is already drawn inside the node that produced it. Listing it again would
  // show the same work twice and hide which of the two is the whole story.
  it('leaves nested runs out of the list', () => {
    const runs = [run('a'), run('b', { parent: { run_id: 'a', node_id: 'sub' } })]

    expect(topLevelRuns(runs).map((r) => r.id)).toEqual(['a'])
  })

  it('keeps every run when none is nested', () => {
    expect(topLevelRuns([run('a'), run('b')])).toHaveLength(2)
  })
})

describe('the run inside a node', () => {
  it('finds the run a subgraph node produced', () => {
    const runs = [run('a'), run('child', { parent: { run_id: 'a', node_id: 'sub' } })]

    expect(childRunOf(runs, 'a', 'sub')?.id).toBe('child')
  })

  it('finds nothing for a node that ran no subgraph', () => {
    const runs = [run('a'), run('child', { parent: { run_id: 'a', node_id: 'sub' } })]

    expect(childRunOf(runs, 'a', 'autre')).toBeUndefined()
  })

  it('does not confuse two parents', () => {
    const runs = [
      run('x', { parent: { run_id: 'a', node_id: 'sub' } }),
      run('y', { parent: { run_id: 'b', node_id: 'sub' } }),
    ]

    expect(childRunOf(runs, 'b', 'sub')?.id).toBe('y')
  })

  // A node running its subgraph twice is two runs; the freshest is what is happening now.
  it('prefers the most recent execution', () => {
    const runs = [
      run('first', {
        parent: { run_id: 'a', node_id: 'sub' },
        started_at: '2026-07-28T12:00:00Z',
      }),
      run('second', {
        parent: { run_id: 'a', node_id: 'sub' },
        started_at: '2026-07-28T13:00:00Z',
      }),
    ]

    expect(childRunOf(runs, 'a', 'sub')?.id).toBe('second')
  })
})
