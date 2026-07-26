import { render, screen } from '@testing-library/react'
import { MissingSource } from './MissingSource'
import { fr } from '../i18n/fr'

it('says a brick is missing, and why nothing is shown', () => {
  render(<MissingSource view="cerveau" source={{ kind: 'no-brick' }} />)

  expect(screen.getByText(fr.missing.noBrick)).toBeInTheDocument()
  expect(screen.getByText(fr.missing.why)).toBeInTheDocument()
})

it('names the brick when it exists but publishes no contract', () => {
  render(<MissingSource view="grimoire" source={{ kind: 'no-contract', brick: 'kern-orch' }} />)

  expect(screen.getByText(fr.missing.noContract('kern-orch'))).toBeInTheDocument()
})

it('titles the panel with the view it stands in for', () => {
  render(<MissingSource view="espace" source={{ kind: 'no-brick' }} />)

  expect(screen.getByRole('heading', { name: fr.views.espace })).toBeInTheDocument()
})

// The whole point of this component is that it shows no data. A future contributor
// tempted to "fill it in with something" should break this test.
it('renders no placeholder data of any kind', () => {
  const { container } = render(<MissingSource view="navigateur" source={{ kind: 'no-brick' }} />)

  expect(container.querySelectorAll('table, ul, ol, canvas, svg')).toHaveLength(0)
})
