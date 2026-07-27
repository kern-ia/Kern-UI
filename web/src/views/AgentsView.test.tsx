import { render, screen } from '@testing-library/react'
import { AgentsView } from './AgentsView'
import { fr } from '../i18n/fr'
import type { Run } from '../runs/types'

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    graph: 'hello',
    status: 'running',
    step: 1,
    frontier: ['finish'],
    started_at: '2026-07-27T12:00:00Z',
    updated_at: '2026-07-27T12:00:01Z',
    ...over,
  }
}

// A run now becomes visible the moment an agent starts working, which is before its first
// level completes and so before its shape has been sent. "Never declared" would be a
// statement about the producer; at step 0 the truth is only that it has not arrived yet.
it('says the topology is still on its way before the first level', () => {
  render(<AgentsView runs={[run({ step: 0, frontier: [], generating: ['greet'] })]} />)

  expect(screen.getByText(fr.hive.topologyPending)).toBeInTheDocument()
  expect(screen.queryByText(fr.hive.noTopology)).not.toBeInTheDocument()
})

// Past the first level, a missing topology really is something the producer never sent.
it('says the topology was never declared once a level has completed', () => {
  render(<AgentsView runs={[run({ step: 2 })]} />)

  expect(screen.getByText(fr.hive.noTopology)).toBeInTheDocument()
  expect(screen.queryByText(fr.hive.topologyPending)).not.toBeInTheDocument()
})

it('draws the hive as soon as a topology is known', () => {
  const withShape = run({
    topology: { entry: 'greet', nodes: [{ id: 'greet', kind: 'agent' }] },
  })

  render(<AgentsView runs={[withShape]} />)

  expect(screen.queryByText(fr.hive.noTopology)).not.toBeInTheDocument()
  expect(screen.queryByText(fr.hive.topologyPending)).not.toBeInTheDocument()
})
