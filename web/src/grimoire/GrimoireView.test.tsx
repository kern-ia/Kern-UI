import { render, screen } from '@testing-library/react'
import { GrimoireView } from './GrimoireView'
import { fr } from '../i18n/fr'
import type { Catalogue } from './types'
import type { Run } from '../runs/types'

const catalogue: Catalogue = {
  source: 'kern-orch',
  at: '2026-07-27T12:00:00Z',
  skills: [
    { name: 'Analyse', kind: 'tool', description: 'Décompose une demande.' },
    { name: 'Chercheur', kind: 'agent' },
    { name: 'Scribe', kind: 'agent', description: 'Rédige.' },
  ],
}

const runningScribe: Run = {
  id: 'r1',
  graph: 'hello',
  status: 'running',
  step: 1,
  frontier: ['greet'],
  started_at: '2026-07-27T12:00:00Z',
  updated_at: '2026-07-27T12:00:01Z',
  topology: {
    entry: 'greet',
    nodes: [{ id: 'greet', kind: 'agent', skill: 'Scribe' }],
  },
}

it('draws the mockup two columns', () => {
  render(<GrimoireView registry={{ status: 'ready', catalogue }} runs={[]} />)

  expect(screen.getByRole('heading', { name: fr.grimoire.competences })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: fr.grimoire.subAgents })).toBeInTheDocument()
})

it('sorts each skill into the column its kind names', () => {
  render(<GrimoireView registry={{ status: 'ready', catalogue }} runs={[]} />)

  const tools = screen.getByRole('list', { name: fr.grimoire.competences })
  const agents = screen.getByRole('list', { name: fr.grimoire.subAgents })

  expect(tools).toHaveTextContent('Analyse')
  expect(tools).not.toHaveTextContent('Scribe')
  expect(agents).toHaveTextContent('Scribe')
  expect(agents).toHaveTextContent('Chercheur')
})

it('shows a skill description when the producer sent one', () => {
  render(<GrimoireView registry={{ status: 'ready', catalogue }} runs={[]} />)

  expect(screen.getByText('Décompose une demande.')).toBeInTheDocument()
})

it('marks a sub-agent active when a run is exercising its skill', () => {
  render(<GrimoireView registry={{ status: 'ready', catalogue }} runs={[runningScribe]} />)

  const scribe = screen.getByRole('listitem', { name: /Scribe/ })
  expect(scribe).toHaveTextContent(fr.grimoire.activity.actif)

  // Nothing runs Chercheur, so it must not borrow its neighbour's state.
  const chercheur = screen.getByRole('listitem', { name: /Chercheur/ })
  expect(chercheur).toHaveTextContent(fr.grimoire.activity.repos)
})

it('marks a sub-agent blocked when the run running it failed', () => {
  const failed: Run = { ...runningScribe, status: 'failed', error: { message: 'boom' } }
  render(<GrimoireView registry={{ status: 'ready', catalogue }} runs={[failed]} />)

  expect(screen.getByRole('listitem', { name: /Scribe/ })).toHaveTextContent(
    fr.grimoire.activity.bloque,
  )
})

// The two empties are different facts and must read differently: nobody published, versus
// a producer that published nothing.
it('says so when no producer has published', () => {
  render(<GrimoireView registry={{ status: 'unpublished' }} runs={[]} />)

  expect(screen.getByText(fr.grimoire.unpublished)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: fr.grimoire.competences })).not.toBeInTheDocument()
})

it('says so when the catalogue is published and empty', () => {
  const bare: Catalogue = { source: 'kern-orch', at: '2026-07-27T12:00:00Z', skills: [] }
  render(<GrimoireView registry={{ status: 'ready', catalogue: bare }} runs={[]} />)

  expect(screen.getByText(fr.grimoire.empty)).toBeInTheDocument()
  expect(screen.queryByText(fr.grimoire.unpublished)).not.toBeInTheDocument()
})

it('reports a failed load without pretending the registry is empty', () => {
  render(<GrimoireView registry={{ status: 'error' }} runs={[]} />)

  expect(screen.getByText(fr.grimoire.error)).toBeInTheDocument()
  expect(screen.queryByText(fr.grimoire.empty)).not.toBeInTheDocument()
})

// Creating a skill or a sub-agent is a write path and waits for kern-pilot. The mockup's
// affordance is kept, disabled and explained — never a button that quietly does nothing.
it('offers creation as disabled, naming the brick it waits for', () => {
  render(<GrimoireView registry={{ status: 'ready', catalogue }} runs={[]} />)

  const create = screen.getByRole('button', { name: fr.grimoire.newSubAgent })
  expect(create).toBeDisabled()
  expect(create).toHaveAccessibleDescription(fr.grimoire.creationUnavailable)
})
