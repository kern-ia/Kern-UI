import { render, screen } from '@testing-library/react'
import { VigieView } from './VigieView'
import { fr } from '../i18n/fr'
import type { Decision } from './types'

const budget = {
  spent_micros: 18000,
  limit_micros: 1_000_000,
  unpriced_calls: 2,
  unaccounted_calls: 1,
  window_resets_at: new Date(Date.now() + 3_600_000).toISOString(),
}

it('says what is missing when no firewall source is configured', () => {
  render(<VigieView budget={{ status: 'unconfigured' }} feed={{ decisions: [], connection: 'connecting' }} />)
  expect(screen.getByText(fr.vigie.unconfigured)).toBeInTheDocument()
})

it('says the snapshot failed to load', () => {
  render(<VigieView budget={{ status: 'error' }} feed={{ decisions: [], connection: 'connecting' }} />)
  expect(screen.getByText(fr.vigie.error)).toBeInTheDocument()
})

it('shows the loading message before the snapshot arrives', () => {
  render(<VigieView budget={{ status: 'loading' }} feed={{ decisions: [], connection: 'connecting' }} />)
  expect(screen.getByText(fr.vigie.loading)).toBeInTheDocument()
})

it('draws the budget tile once the snapshot is ready', () => {
  render(<VigieView budget={{ status: 'ready', budget }} feed={{ decisions: [], connection: 'open' }} />)

  const tile = screen.getByRole('article', { name: fr.vigie.budget.heading })
  expect(tile).toHaveTextContent(fr.vigie.budget.unpriced)
  expect(tile).toHaveTextContent('2')
  expect(tile).toHaveTextContent(fr.vigie.budget.unaccounted)
  expect(tile).toHaveTextContent('1')
})

it('says there are no decisions yet when the feed is empty', () => {
  render(<VigieView budget={{ status: 'ready', budget }} feed={{ decisions: [], connection: 'open' }} />)
  expect(screen.getByText(fr.vigie.decisions.empty)).toBeInTheDocument()
})

it('lists a fired decision in the feed', () => {
  const decisions: Decision[] = [
    { at: '2026-08-05T12:00:00Z', layer: 'behaviour', decision: 'warn', rule: 'too-many-calls', run_id: 'r1' },
  ]
  render(<VigieView budget={{ status: 'ready', budget }} feed={{ decisions, connection: 'open' }} />)

  const feed = screen.getByRole('article', { name: fr.vigie.decisions.heading })
  expect(feed).toHaveTextContent('too-many-calls')
  expect(feed).toHaveTextContent('r1')
})

it("shows the feed's own connection state even once the budget is ready", () => {
  render(<VigieView budget={{ status: 'ready', budget }} feed={{ decisions: [], connection: 'error' }} />)
  expect(screen.getByText(fr.connection.error)).toBeInTheDocument()
})
