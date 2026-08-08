import { render, screen } from '@testing-library/react'
import { DossierDetailView } from './DossierDetailView'
import { fr } from '../i18n/fr'
import type { Run, Topology } from '../runs/types'

const topology: Topology = {
  entry: 'reception',
  nodes: [{ id: 'reception', kind: 'agent' }],
  edges: [],
}

function run(id: string, overrides: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'courtage-extraction',
    status: 'running',
    step: 1,
    frontier: ['reception'],
    visited: ['reception'],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:02Z',
    topology,
    ...overrides,
  }
}

it('says a dossier is not found rather than showing nothing unexplained', () => {
  render(<DossierDetailView runs={[]} dossierId="AF-2288" />)

  expect(screen.getByText(fr.dossierDetail.notFound)).toBeInTheDocument()
})

it('says a dossier is not found when no dossier is selected at all', () => {
  render(<DossierDetailView runs={[run('r1', { dossier: 'AF-2288' })]} dossierId={null} />)

  expect(screen.getByText(fr.dossierDetail.notFound)).toBeInTheDocument()
})

it('shows the dossier id and its current run graph once found', () => {
  render(<DossierDetailView runs={[run('r1', { dossier: 'AF-2288' })]} dossierId="AF-2288" />)

  expect(screen.getByText('AF-2288')).toBeInTheDocument()
  expect(screen.getByText('courtage-extraction')).toBeInTheDocument()
})

it('says the shape is on its way for a run with no topology yet', () => {
  render(
    <DossierDetailView
      runs={[run('r1', { dossier: 'AF-2288', topology: undefined, step: 0 })]}
      dossierId="AF-2288"
    />,
  )

  expect(screen.getByText(fr.hive.topologyPending)).toBeInTheDocument()
})
