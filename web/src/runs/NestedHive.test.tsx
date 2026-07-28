import { fireEvent, render, screen } from '@testing-library/react'
import { HiveGraph } from './HiveGraph'
import { fr } from '../i18n/fr'
import type { Run } from './types'

const parent: Run = {
  id: 'p1',
  graph: 'parent',
  status: 'running',
  step: 1,
  frontier: ['nested'],
  visited: ['prep', 'nested'],
  started_at: '2026-07-28T12:00:00Z',
  updated_at: '2026-07-28T12:00:01Z',
  topology: {
    entry: 'prep',
    nodes: [
      { id: 'prep', kind: 'tool' },
      { id: 'nested', kind: 'subgraph' },
    ],
    edges: [{ from: 'prep', to: ['nested'] }],
  },
}

const child: Run = {
  id: 'c1',
  graph: 'child',
  status: 'running',
  step: 1,
  frontier: ['verifie'],
  visited: ['redige', 'verifie'],
  started_at: '2026-07-28T12:00:02Z',
  updated_at: '2026-07-28T12:00:03Z',
  parent: { run_id: 'p1', node_id: 'nested' },
  topology: {
    entry: 'redige',
    nodes: [
      { id: 'redige', kind: 'agent', skill: 'Scribe' },
      { id: 'verifie', kind: 'tool' },
    ],
  },
}

// A sub-agent is a graph, and until now it was a dot. Opening it draws the run that
// actually happened inside, in the same visual language as its parent.
it('offers to open a subgraph node that has a nested run', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)

  expect(screen.getByRole('button', { name: fr.hive.openNested('nested') })).toBeInTheDocument()
})

it('draws the nested run once opened', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.hive.openNested('nested') }))

  expect(screen.getByLabelText(fr.hive.label('child', 2))).toBeInTheDocument()
})

it('closes again', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.hive.openNested('nested') }))
  fireEvent.click(screen.getByRole('button', { name: fr.hive.closeNested('nested') }))

  expect(screen.queryByLabelText(fr.hive.label('child', 2))).not.toBeInTheDocument()
})

// A subgraph that has not reported yet must not pretend to be openable: an empty panel
// would say "nothing happened in here", which is not the same as "we have not been told".
it('offers nothing for a subgraph node that never reported', () => {
  render(<HiveGraph run={parent} runs={[parent]} />)

  expect(screen.queryByRole('button', { name: fr.hive.openNested('nested') })).not.toBeInTheDocument()
})

// Only subgraph nodes nest. An agent or a tool has nothing inside it to show.
it('offers nothing on a node that is not a subgraph', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)

  expect(screen.queryByRole('button', { name: fr.hive.openNested('prep') })).not.toBeInTheDocument()
})

// The legend is a key to the colours, and one is enough on screen: repeating it inside
// every nested hive turns a reading aid into clutter.
it('does not repeat the legend inside a nested hive', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)
  fireEvent.click(screen.getByRole('button', { name: fr.hive.openNested('nested') }))

  expect(screen.getAllByText(fr.hive.status.active)).toHaveLength(1)
})
