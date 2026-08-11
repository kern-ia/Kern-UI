import { render, screen } from '@testing-library/react'
import { ExtractionDossierPanel } from './ExtractionDossierPanel'
import { parseInterpretation } from './interpretation'
import { fr } from '../i18n/fr'

const interpretation = parseInterpretation(
  JSON.stringify({
    revenus: [
      { source: 'Salaire', montant_mensuel: 2400, document_source: 'page 2', statut: 'confirmé' },
    ],
    credits_en_cours: [
      {
        etablissement: 'Crédit Agricole',
        mensualite: 310,
        capital_restant_du: 18000,
        document_source: 'page 3',
        statut: 'à vérifier',
      },
    ],
    incidents: [],
    reste_a_vivre: { montant: 950, methode_calcul: 'revenus - charges', statut: 'à vérifier' },
    pieces_manquantes: ['Dernier relevé de compte'],
  }),
)!

it('shows each revenu line with its amount, statut and source', () => {
  render(<ExtractionDossierPanel interpretation={interpretation} />)

  expect(screen.getByText('Salaire')).toBeInTheDocument()
  expect(screen.getByText('2 400 € / mois')).toBeInTheDocument()
  expect(screen.getByText(fr.runs.dossierExtraction.statutConfirme)).toBeInTheDocument()
  expect(screen.getByText('Source : page 2')).toBeInTheDocument()
})

it('shows each credit line, distinguishing statut from the revenus one', () => {
  render(<ExtractionDossierPanel interpretation={interpretation} />)

  expect(screen.getByText('Crédit Agricole')).toBeInTheDocument()
  expect(screen.getAllByText(fr.runs.dossierExtraction.statutAVerifier).length).toBeGreaterThan(0)
  expect(screen.getByText('Capital restant dû : 18 000 €')).toBeInTheDocument()
})

it('shows reste à vivre and pièces manquantes', () => {
  render(<ExtractionDossierPanel interpretation={interpretation} />)

  expect(screen.getByText('950 €')).toBeInTheDocument()
  expect(screen.getByText('Dernier relevé de compte')).toBeInTheDocument()
})

it('shows nothing for an empty section instead of an empty heading', () => {
  const empty = parseInterpretation(JSON.stringify({}))!
  render(<ExtractionDossierPanel interpretation={empty} />)

  expect(screen.queryByText(fr.runs.dossierExtraction.incidents)).not.toBeInTheDocument()
  expect(screen.queryByText(fr.runs.dossierExtraction.piecesManquantes)).not.toBeInTheDocument()
})
