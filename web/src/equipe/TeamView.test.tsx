import { render, screen } from '@testing-library/react'
import { TeamView } from './TeamView'
import { fr } from '../i18n/fr'

it('shows the loading message before the roster arrives', () => {
  render(<TeamView team={{ status: 'loading' }} />)
  expect(screen.getByText(fr.team.loading)).toBeInTheDocument()
})

it('says the roster failed to load', () => {
  render(<TeamView team={{ status: 'error' }} />)
  expect(screen.getByText(fr.team.error)).toBeInTheDocument()
})

it('says there is no account yet', () => {
  render(<TeamView team={{ status: 'ready', names: [] }} />)
  expect(screen.getByText(fr.team.empty)).toBeInTheDocument()
})

it('shows a real account, with its initials — never a hash', () => {
  render(<TeamView team={{ status: 'ready', names: ['elise'] }} />)

  expect(screen.getByText('elise')).toBeInTheDocument()
  expect(screen.getByText('EL')).toBeInTheDocument()
})
