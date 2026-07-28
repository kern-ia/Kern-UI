import { render, screen } from '@testing-library/react'
import { MissingSource } from './MissingSource'
import { fr } from '../i18n/fr'

it('says which capability is missing, in the reader’s terms', () => {
  render(<MissingSource view="cerveau" source={{ kind: 'awaiting', capability: 'memoire' }} />)

  expect(screen.getByText(fr.missing.awaiting.memoire)).toBeInTheDocument()
  expect(screen.getByText(fr.missing.why)).toBeInTheDocument()
})

it('titles the panel with the view it stands in for', () => {
  render(<MissingSource view="espace" source={{ kind: 'awaiting', capability: 'outils' }} />)

  expect(screen.getByRole('heading', { name: fr.views.espace })).toBeInTheDocument()
})

// The whole point of this component is that it shows no data. A future contributor tempted
// to "fill it in with something" should break this test.
it('renders no placeholder data of any kind', () => {
  const { container } = render(
    <MissingSource view="navigateur" source={{ kind: 'awaiting', capability: 'navigateur' }} />,
  )

  expect(container.querySelectorAll('table, ul, ol, canvas, svg')).toHaveLength(0)
})

// A demo audience must not read our module layout off the screen, nor a file path.
it('names no brick, no contract and no file', () => {
  const { container } = render(
    <MissingSource view="redaction" source={{ kind: 'awaiting', capability: 'documents' }} />,
  )

  expect(container.textContent).not.toMatch(/kern-|brique|contrat|\.md|ROADMAP/i)
})
