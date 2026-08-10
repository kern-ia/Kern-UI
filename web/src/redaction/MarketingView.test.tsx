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
  expect(screen.getByRole('button', { name: fr.marketing.selectItem('Bonjour.') })).toBeInTheDocument()
})

it('opens the full content, editable, when an item is selected', () => {
  const item = run({
    state: {
      brief_editorial: 'Plateforme(s) : Telegram',
      texte_redige: 'Titre court\n\nLe corps complet du message, plus long que le titre.',
    },
  })
  render(<MarketingView runs={[item]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Titre court') }))

  const dialog = screen.getByRole('dialog')
  const field = within(dialog).getByRole('textbox')
  expect(field).toHaveValue('Titre court\n\nLe corps complet du message, plus long que le titre.')
})

it('lets the reader edit the text before copying it', () => {
  const item = run({ state: { brief_editorial: 'Plateforme(s) : Telegram', texte_redige: 'Original.' } })
  render(<MarketingView runs={[item]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Original.') }))
  const field = within(screen.getByRole('dialog')).getByRole('textbox')
  fireEvent.change(field, { target: { value: 'Texte corrigé.' } })

  expect(field).toHaveValue('Texte corrigé.')
})

it('copies the current (possibly edited) text, not the original', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })

  const item = run({ state: { brief_editorial: 'Plateforme(s) : Telegram', texte_redige: 'Original.' } })
  render(<MarketingView runs={[item]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Original.') }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Texte corrigé.' } })
  fireEvent.click(within(dialog).getByRole('button', { name: fr.marketing.copy }))

  expect(writeText).toHaveBeenCalledWith('Texte corrigé.')
  expect(await within(dialog).findByText(fr.marketing.copied)).toBeInTheDocument()
})

it('resets the edit when a different item is opened', () => {
  const first = run({
    id: 'r1',
    state: { brief_editorial: 'Plateforme(s) : Telegram', texte_redige: 'Premier texte.' },
  })
  const second = run({
    id: 'r2',
    state: { brief_editorial: 'Plateforme(s) : Telegram', texte_redige: 'Second texte.' },
  })
  render(<MarketingView runs={[first, second]} />)

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Premier texte.') }))
  fireEvent.change(within(screen.getByRole('dialog')).getByRole('textbox'), {
    target: { value: 'Édité, mais je ferme sans copier.' },
  })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: fr.marketing.closeItem }))

  fireEvent.click(screen.getByRole('button', { name: fr.marketing.selectItem('Second texte.') }))

  expect(within(screen.getByRole('dialog')).getByRole('textbox')).toHaveValue('Second texte.')
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
