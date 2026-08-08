import { fireEvent, render, screen } from '@testing-library/react'
import { DossiersView } from './DossiersView'
import { fr } from '../i18n/fr'
import type { Run } from '../runs/types'

function run(id: string, overrides: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'courtage-extraction',
    status: 'running',
    step: 2,
    frontier: ['extraction'],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:02Z',
    ...overrides,
  }
}

it('invites the reader to confide a dossier to an agent when there is nothing to show', () => {
  render(<DossiersView runs={[]} />)

  expect(screen.getByText(fr.dossiers.empty)).toBeInTheDocument()
  expect(screen.getByText(fr.dossiers.emptyHint)).toBeInTheDocument()
})

// A run with no dossier has nothing to group it under — see runs/dossiers.ts.
it('shows nothing for runs carrying no dossier', () => {
  render(<DossiersView runs={[run('r1')]} />)

  expect(screen.getByText(fr.dossiers.empty)).toBeInTheDocument()
})

it('shows one row per dossier, with its most recent run status', () => {
  render(<DossiersView runs={[run('r1', { dossier: 'AF-2288' })]} />)

  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(2) // header + one dossier
  expect(screen.getByText('AF-2288')).toBeInTheDocument()
  expect(screen.getByText(fr.runs.status.running, { exact: false })).toBeInTheDocument()
})

it('gives every dossier its own row, most recently updated first', () => {
  render(
    <DossiersView
      runs={[
        run('old', { dossier: 'AF-2270', updated_at: '2026-07-28T10:00:00Z' }),
        run('new', { dossier: 'AF-2288', updated_at: '2026-07-28T14:00:00Z' }),
      ]}
    />,
  )

  const rows = screen.getAllByRole('row').slice(1) // drop the header row
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining('AF-2288'),
    expect.stringContaining('AF-2270'),
  ])
})

it('calls onSelect with the dossier id when its card is picked', () => {
  const onSelect = vi.fn()
  render(<DossiersView runs={[run('r1', { dossier: 'AF-2288' })]} onSelect={onSelect} />)

  fireEvent.click(screen.getByRole('button', { name: fr.dossiers.open('AF-2288') }))

  expect(onSelect).toHaveBeenCalledWith('AF-2288')
})
