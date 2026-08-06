import { fireEvent, render, screen, within } from '@testing-library/react'
import { MarketingView } from './MarketingView'
import { fr } from '../i18n/fr'
import type { Run } from '../runs/types'

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    graph: 'community-management-agency',
    status: 'finished',
    step: 6,
    frontier: [],
    visited: ['audience', 'strategiste', 'confirm_strategie', 'redacteur', 'confirm_publication', 'publieur'],
    started_at: '2026-08-06T10:00:00Z',
    updated_at: '2026-08-06T10:02:00Z',
    ...over,
  }
}

it('says there is nothing to show when no comm run exists', () => {
  render(<MarketingView runs={[run({ graph: 'prospection' })]} />)

  expect(screen.getByText(fr.marketing.empty)).toBeInTheDocument()
})

it('ignores runs from unrelated skills', () => {
  render(<MarketingView runs={[run({ graph: 'prospection' })]} />)

  expect(screen.getByText(fr.marketing.empty)).toBeInTheDocument()
})

it('lists a dateless item under "sans date" rather than dropping it', () => {
  const withoutDate = run({
    state: { brief_editorial: 'Plateforme(s) : email froid', texte_redige: 'Bonjour.' },
  })
  render(<MarketingView runs={[withoutDate]} />)

  expect(screen.getByText(fr.marketing.unscheduled)).toBeInTheDocument()
  expect(screen.getByText('Bonjour.')).toBeInTheDocument()
})

it('opens the full content when an item is selected', () => {
  const item = run({
    state: {
      brief_editorial: 'Plateforme(s) : Telegram',
      texte_redige: 'Titre court\n\nLe corps complet du message, plus long que le titre.',
    },
  })
  render(<MarketingView runs={[item]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Titre court') }))

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Le corps complet du message, plus long que le titre.')).toBeInTheDocument()
})

it('closes the detail on Escape', () => {
  const item = run({
    state: { brief_editorial: 'Plateforme(s) : Telegram', texte_redige: 'Un message.' },
  })
  render(<MarketingView runs={[item]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Un message.') }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows the platform once an item is opened', () => {
  const item = run({
    state: { brief_editorial: 'Plateforme(s) : LinkedIn', texte_redige: 'Post.' },
  })
  render(<MarketingView runs={[item]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Post.') }))

  expect(within(screen.getByRole('dialog')).getByText(/LinkedIn/)).toBeInTheDocument()
})
