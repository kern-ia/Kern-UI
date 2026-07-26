import { systemState } from './systemState'
import type { Run } from '../runs/types'

function run(status: Run['status']): Run {
  return {
    id: Math.random().toString(36).slice(2),
    graph: 'g',
    status,
    step: 1,
    frontier: status === 'running' ? ['a'] : [],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:00Z',
  }
}

it('rests when nothing runs', () => {
  expect(systemState([])).toBe('repos')
  expect(systemState([run('finished')])).toBe('repos')
})

it('acts as soon as one run is live', () => {
  expect(systemState([run('finished'), run('running')])).toBe('action')
})

// The mockup's palette has four states. Only two are reachable from what kern-orch
// reports today: nothing tells us an agent is thinking, and no run can fail yet.
// Inventing them would put a colour on screen that means nothing.
it('never claims a state no brick can report', () => {
  const reachable = new Set(['repos', 'action'])
  const samples = [[], [run('running')], [run('finished')], [run('running'), run('finished')]]

  for (const runs of samples) {
    expect(reachable.has(systemState(runs))).toBe(true)
  }
})
