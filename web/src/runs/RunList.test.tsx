import { render, screen } from '@testing-library/react'
import { RunList } from './RunList'
import { fr } from '../i18n/fr'
import type { Run } from './types'

function run(id: string, overrides: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'review',
    status: 'running',
    step: 2,
    frontier: ['analyse', 'synthese'],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:02Z',
    ...overrides,
  }
}

it('invites the user to start a graph when there is nothing to show', () => {
  render(<RunList runs={[]} />)

  expect(screen.getByText(fr.runs.empty)).toBeInTheDocument()
  expect(screen.getByText(fr.runs.emptyHint)).toBeInTheDocument()
})

it('shows the graph name, the level and the frontier of a running run', () => {
  render(<RunList runs={[run('r1')]} />)

  expect(screen.getByText('review')).toBeInTheDocument()
  expect(screen.getByText(fr.runs.step(2))).toBeInTheDocument()
  expect(screen.getByText('analyse')).toBeInTheDocument()
  expect(screen.getByText('synthese')).toBeInTheDocument()
  expect(screen.getByText(fr.runs.status.running)).toBeInTheDocument()
})

it('marks a finished run and shows no frontier for it', () => {
  render(<RunList runs={[run('r1', { status: 'finished', frontier: [] })]} />)

  expect(screen.getByText(fr.runs.status.finished)).toBeInTheDocument()
  expect(screen.getByText(fr.runs.idle)).toBeInTheDocument()
})

it('renders one entry per run', () => {
  render(<RunList runs={[run('r1'), run('r2', { graph: 'triage' })]} />)

  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('triage')).toBeInTheDocument()
})

it('exposes the status to assistive technology, not only as a colour', () => {
  render(<RunList runs={[run('r1')]} />)

  const label = screen.getAllByRole('listitem')[0].getAttribute('aria-label') ?? ''
  expect(label).toContain('review')
  expect(label).toContain(fr.runs.status.running)
})
