import { fireEvent, render, screen, within } from '@testing-library/react'
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
// every nested hive turns a reading aid into clutter. Cards each carry their own status
// text too now (readable without relying on colour alone), so the count that matters is
// the legend's own list, not every "Actif" on screen.
it('does not repeat the legend inside a nested hive', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)
  fireEvent.click(screen.getByRole('button', { name: fr.hive.openNested('nested') }))

  expect(screen.getAllByRole('list')).toHaveLength(1)
  expect(within(screen.getByRole('list')).getAllByText(fr.hive.status.active)).toHaveLength(1)
})

// A mission is not just coloured dots — clicking a node shows what it actually produced,
// via the "display:<nodeId>" convention any node handler can opt into.
it('shows a node\'s real output once clicked', () => {
  const withOutput: Run = { ...parent, state: { 'display:prep': 'Bonjour, voici la fiche.' } }
  render(<HiveGraph run={withOutput} runs={[withOutput, child]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.hive.selectNode('prep') }))

  expect(screen.getByText('Bonjour, voici la fiche.')).toBeInTheDocument()
})

it('says a node has nothing to show yet, rather than nothing at all', () => {
  render(<HiveGraph run={parent} runs={[parent, child]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.hive.selectNode('prep') }))

  expect(screen.getByText(fr.hive.nodeOutputPending)).toBeInTheDocument()
})

it('closes the node detail again', () => {
  const withOutput: Run = { ...parent, state: { 'display:prep': 'Bonjour, voici la fiche.' } }
  render(<HiveGraph run={withOutput} runs={[withOutput, child]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.hive.selectNode('prep') }))
  fireEvent.click(screen.getByRole('button', { name: fr.hive.closeNode('prep') }))

  expect(screen.queryByText('Bonjour, voici la fiche.')).not.toBeInTheDocument()
})
