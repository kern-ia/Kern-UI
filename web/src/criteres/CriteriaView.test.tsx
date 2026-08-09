import { render, screen } from '@testing-library/react'
import { CriteriaView } from './CriteriaView'
import { fr } from '../i18n/fr'

it('shows the loading message before the criteria arrive', () => {
  render(<CriteriaView criteria={{ status: 'loading' }} />)
  expect(screen.getByText(fr.criteria.loading)).toBeInTheDocument()
})

it('says what is missing when no memory source is configured', () => {
  render(<CriteriaView criteria={{ status: 'unconfigured' }} />)
  expect(screen.getByText(fr.criteria.unconfigured)).toBeInTheDocument()
})

it('says the criteria failed to load', () => {
  render(<CriteriaView criteria={{ status: 'error' }} />)
  expect(screen.getByText(fr.criteria.error)).toBeInTheDocument()
})

it('says there is nothing recorded yet, distinct from unconfigured', () => {
  render(<CriteriaView criteria={{ status: 'ready', criteria: [] }} />)
  expect(screen.getByText(fr.criteria.empty)).toBeInTheDocument()
})

it('shows a real criterion, and its tags', () => {
  render(
    <CriteriaView
      criteria={{
        status: 'ready',
        criteria: [
          {
            memory: {
              id: 'c1',
              kind: 'okf',
              text: "Le taux d'usure T3 2026 est 5,92%.",
              tags: ['taux-usure'],
            },
            similarity: 1,
          },
        ],
      }}
    />,
  )

  expect(screen.getByText("Le taux d'usure T3 2026 est 5,92%.")).toBeInTheDocument()
  expect(screen.getByText('taux-usure')).toBeInTheDocument()
})
