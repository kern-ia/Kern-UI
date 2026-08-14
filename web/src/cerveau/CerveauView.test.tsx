import { fireEvent, render, screen } from '@testing-library/react'
import { CerveauView } from './CerveauView'
import { fr } from '../i18n/fr'
import type { Cerveau } from './types'

const graph: Cerveau = {
  nodes: [
    { id: 'okf:a', kind: 'okf', label: 'Idée produit' },
    { id: 'vector:b', kind: 'vector', label: 'Recherche client' },
  ],
  edges: [{ from: 'okf:a', to: 'vector:b', relation: 'mène-à' }],
  roots: ['okf:a'],
}

it('shows the loading message before the graph arrives', () => {
  render(<CerveauView cerveau={{ status: 'loading' }} focus={null} onDive={() => {}} onBackToOverview={() => {}} />)
  expect(screen.getByText(fr.cerveau.loading)).toBeInTheDocument()
})

it('says what is missing when no memory source is configured', () => {
  render(<CerveauView cerveau={{ status: 'unconfigured' }} focus={null} onDive={() => {}} onBackToOverview={() => {}} />)
  expect(screen.getByText(fr.cerveau.unconfigured)).toBeInTheDocument()
})

it('says there is nothing recorded yet, distinct from unconfigured', () => {
  render(
    <CerveauView
      cerveau={{ status: 'ready', cerveau: { nodes: [], edges: [], roots: [] } }}
      focus={null}
      onDive={() => {}}
      onBackToOverview={() => {}}
    />,
  )
  expect(screen.getByText(fr.cerveau.empty)).toBeInTheDocument()
})

it('shows the real nodes and the active count', () => {
  render(<CerveauView cerveau={{ status: 'ready', cerveau: graph }} focus={null} onDive={() => {}} onBackToOverview={() => {}} />)

  expect(screen.getByText('Idée produit')).toBeInTheDocument()
  expect(screen.getByText('Recherche client')).toBeInTheDocument()
  expect(screen.getByText(fr.cerveau.activeCount(2))).toBeInTheDocument()
})

it('dives into a node on double-click', () => {
  const onDive = vi.fn()
  render(<CerveauView cerveau={{ status: 'ready', cerveau: graph }} focus={null} onDive={onDive} onBackToOverview={() => {}} />)

  fireEvent.doubleClick(screen.getByRole('button', { name: fr.cerveau.diveInto('Recherche client') }))

  expect(onDive).toHaveBeenCalledWith('vector:b')
})

it('shows a way back to the overview only while focused on a node', () => {
  const { rerender } = render(
    <CerveauView cerveau={{ status: 'ready', cerveau: graph }} focus={null} onDive={() => {}} onBackToOverview={() => {}} />,
  )
  expect(screen.queryByText(fr.cerveau.backToOverview)).not.toBeInTheDocument()

  rerender(
    <CerveauView cerveau={{ status: 'ready', cerveau: graph }} focus="vector:b" onDive={() => {}} onBackToOverview={() => {}} />,
  )
  expect(screen.getByText(fr.cerveau.backToOverview)).toBeInTheDocument()
})
